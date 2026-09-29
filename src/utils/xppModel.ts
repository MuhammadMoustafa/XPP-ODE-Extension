/**
 * A structural model of an XPP .ode/.inc file: which kind of line each line is, which names
 * it declares, and which names it references. Everything else (diagnostics, rename, colors)
 * should be built on this rather than on its own regexes.
 *
 * The line classification follows what xppaut 8.0 actually does (verified by running it):
 *  - "word name ..." is a declaration keyed by the first letters of "word"
 *    (p→par, i→init, w→wiener, n→number, g→global, b→bdry, v→volt, o→options,
 *     au→aux, ma→markov, ta→table, se→set, so→solv, sp→special, ex→export, im→import, on→only);
 *    the separator must be a space (tabs do not count);
 *  - "word=..." is always a fixed variable, whatever the word is;
 *  - "x'=", "dx/dt=", "x(t+1)=", "x(t)=" define state variables, "x(0)=" an initial condition,
 *    "f(a,b)=" a function, "!a=" a derived parameter, "0=" an algebraic condition;
 *  - "@" lines set options, "#" and '"' lines are comments, "{...}" lines are Markov rows,
 *    "%[a..b]" / "%" delimit an array block, "\" at the end of a line continues it;
 *  - any other line is silently ignored by XPP.
 */
import { builtinFunctions, builtinConstants, specialFunctions, declarationKeywords, optionNames } from './constants';
import { codeLines, codePart, isDoneLine } from './lineUtils';

export type LineKind =
    | 'blank' | 'comment' | 'option' | 'done'
    | 'parameter' | 'init' | 'aux' | 'wiener' | 'global' | 'bdry' | 'volterra' | 'markov' | 'table'
    | 'set' | 'solv' | 'special' | 'export' | 'import' | 'only' | 'options-file'
    | 'derived' | 'algebraic' | 'state' | 'initcond' | 'function' | 'fixed'
    | 'markov-row' | 'array-block' | 'continuation' | 'ignored';

export type DeclKind =
    | 'parameter' | 'derived' | 'fixed' | 'state' | 'function' | 'aux'
    | 'wiener' | 'markov' | 'table' | 'special' | 'solv' | 'array';

export interface TextSpan {
    line: number;
    start: number;
    end: number;
}

export interface Declaration extends TextSpan {
    name: string;
    nameLower: string;
    kind: DeclKind;
    /** Set when the name was produced by an array expansion such as x[1..4]. */
    fromArray?: boolean;
    /** Parameter names for function declarations. */
    parameters?: string[];
}

/**
 * The value given to a variable by "init x=VALUE" or "x(0)=VALUE", with the span of the value.
 * XPP reads both as a plain number, so anything else is a mistake (see semanticCheckerCore).
 */
export interface InitialValue extends TextSpan {
    name: string;
    value: string;
    form: 'init' | 'initcond';
}

export interface Reference extends TextSpan {
    name: string;
    nameLower: string;
    /** "init" targets must be state variables; "expression" references must be declared names. */
    role: 'expression' | 'init';
}

/**
 * A stretch of a line that XPP parses as an expression, with comments removed and
 * "\\" continuations joined. `positions[i]` is the physical (line, column) of `text[i]`,
 * so a finding inside the text can be mapped back to the document exactly.
 */
export interface ExpressionSegment {
    text: string;
    positions: { line: number; col: number }[];
}

export interface OptionEntry extends TextSpan {
    name: string;
    nameLower: string;
    /** True when there is whitespace around "=", which makes XPP ignore the option. */
    badSpacing: boolean;
    known: boolean;
    /** The text after "=", trimmed, and where it sits on the line. */
    value: string;
    valueStart: number;
    valueEnd: number;
}

export interface LineInfo {
    line: number;
    kind: LineKind;
    /** The keyword span for keyword-form lines. */
    keyword?: TextSpan;
    /** Line-level problems found while parsing. */
    problems: { message: string; start: number; end: number; severity: 'error' | 'warning' }[];
}

export interface XppModel {
    lines: string[];
    lineInfos: LineInfo[];
    declarations: Declaration[];
    references: Reference[];
    options: OptionEntry[];
    initialValues: InitialValue[];
    /** Expression right-hand sides, for checks that need the text rather than the names in it. */
    expressions: ExpressionSegment[];
    /** Files named on "#include" lines. */
    includes: { path: string; line: number }[];
}

const IDENT = '[a-zA-Z_][a-zA-Z0-9_]*';
const ARRAY_SUFFIX = '(?:\\[[^\\]]*\\])?';
const MAX_ARRAY_EXPANSION = 10000;

/** Names that never need a declaration: builtins, "special" function names and their type words, and XPP's internal flags. */
const RESERVED_TOKENS = new Set<string>([
    ...builtinFunctions, ...builtinConstants, ...specialFunctions,
    'gill', 'even', 'periodic', 'period', 'zero',
    'arret', 'out_put',
]);
const KNOWN_OPTIONS = new Set(optionNames);

/** Maps a keyword word (already lower-cased) to the line kind XPP gives it. */
export function keywordKind(word: string): LineKind | undefined {
    const twoLetter: Record<string, LineKind> = {
        au: 'aux', ma: 'markov', ta: 'table', se: 'set', so: 'solv', sp: 'special',
        ex: 'export', im: 'import', on: 'only',
    };
    const oneLetter: Record<string, LineKind> = {
        p: 'parameter', n: 'parameter', i: 'init', w: 'wiener', g: 'global', b: 'bdry', v: 'volterra', o: 'options-file',
    };
    return twoLetter[word.substring(0, 2)] ?? oneLetter[word.charAt(0)];
}

/** True when a declared name coincides with an XPP keyword or keyword abbreviation. */
export function isKeywordLikeName(name: string): boolean {
    const lower = name.toLowerCase();
    return declarationKeywords.includes(lower) || /^[piwngbvod]$/.test(lower);
}

interface LogicalLine {
    /** Physical line of the first segment. */
    line: number;
    /** Joined code text (comments removed, continuation backslashes dropped). */
    text: string;
    /** Physical (line, column) for each character of `text`. */
    map: { line: number; col: number }[];
}

function buildLogicalLines(lines: string[]): { logical: LogicalLine[]; continuationLines: Set<number> } {
    const logical: LogicalLine[] = [];
    const continuationLines = new Set<number>();
    let current: LogicalLine | undefined;

    lines.forEach((rawLine, lineNumber) => {
        const code = codePart(rawLine);
        const continues = /\\\s*$/.test(code);
        const body = continues ? code.replace(/\\\s*$/, '') : code;

        if (!current) {
            current = { line: lineNumber, text: '', map: [] };
        } else {
            continuationLines.add(lineNumber);
        }
        for (let col = 0; col < body.length; col++) {
            current.text += body[col];
            current.map.push({ line: lineNumber, col });
        }
        if (!continues) {
            logical.push(current);
            current = undefined;
        }
    });
    if (current) logical.push(current);
    return { logical, continuationLines };
}

/** Expands "x[1..4]" into ["x1","x2","x3","x4"]; returns undefined for names without a range. */
function expandArrayName(name: string, blockRange?: [number, number]): { base: string; members: string[] } | undefined {
    const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\[([^\]]*)\]$/.exec(name);
    if (!match) return undefined;
    const base = match[1];
    const rangeMatch = /^\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*$/.exec(match[2]);
    const range = rangeMatch ? [Number(rangeMatch[1]), Number(rangeMatch[2])] as [number, number] : blockRange;
    const members: string[] = [];
    if (range) {
        const [lo, hi] = range;
        if (hi >= lo && hi - lo < MAX_ARRAY_EXPANSION) {
            for (let i = lo; i <= hi; i++) members.push(`${base}${i}`);
        }
    }
    return { base, members };
}

export function parseXpp(text: string): XppModel {
    const rawLines = text.split(/\r?\n/);
    const lines = codeLines(rawLines);
    const lineInfos: LineInfo[] = rawLines.map((_, i) => ({ line: i, kind: 'blank', problems: [] }));
    const declarations: Declaration[] = [];
    const references: Reference[] = [];
    const options: OptionEntry[] = [];
    const initialValues: InitialValue[] = [];
    const expressions: ExpressionSegment[] = [];
    const includes: { path: string; line: number }[] = [];
    let arrayBlockRange: [number, number] | undefined;

    // Lines after "done" and the "done" line itself
    const doneIndex = lines.findIndex((line, i) => rawLines[i] === line && isDoneLine(line));
    rawLines.forEach((raw, i) => {
        if (doneIndex !== -1 && i > doneIndex) lineInfos[i].kind = raw.trim() === '' ? 'blank' : 'comment';
    });
    if (doneIndex !== -1) lineInfos[doneIndex].kind = 'done';

    const { logical, continuationLines } = buildLogicalLines(lines.map((line, i) => (doneIndex !== -1 && i >= doneIndex ? '' : line)));
    continuationLines.forEach(i => { lineInfos[i].kind = 'continuation'; });

    const declare = (kind: DeclKind, name: string, span: TextSpan, extra: Partial<Declaration> = {}) => {
        const expanded = expandArrayName(name, arrayBlockRange);
        if (expanded) {
            declarations.push({ kind: 'array', name: expanded.base, nameLower: expanded.base.toLowerCase(), ...span, fromArray: true });
            expanded.members.forEach(member => {
                declarations.push({ kind, name: member, nameLower: member.toLowerCase(), ...span, fromArray: true, ...extra });
            });
            return;
        }
        declarations.push({ kind, name, nameLower: name.toLowerCase(), ...span, ...extra });
    };

    for (const logicalLine of logical) {
        if (doneIndex !== -1 && logicalLine.line > doneIndex) continue;
        const info = lineInfos[logicalLine.line];
        const text = logicalLine.text;
        const at = (index: number) => logicalLine.map[Math.min(index, logicalLine.map.length - 1)] ?? { line: logicalLine.line, col: index };
        const span = (start: number, end: number): TextSpan => {
            const s = at(start);
            const e = at(Math.max(start, end - 1));
            return { line: s.line, start: s.col, end: e.col + 1 };
        };
        const addExpression = (segmentStart: number, segmentEnd: number) => {
            if (segmentEnd <= segmentStart) return;
            expressions.push({
                text: text.substring(segmentStart, segmentEnd),
                positions: logicalLine.map.slice(segmentStart, segmentEnd),
            });
        };
        const addRefs = (segmentStart: number, segmentEnd: number, role: Reference['role'] = 'expression') => {
            addExpression(segmentStart, segmentEnd);
            scanReferences(text.substring(segmentStart, segmentEnd)).forEach(ref => {
                references.push({ ...ref, ...span(segmentStart + ref.start, segmentStart + ref.end), role });
            });
        };
        const problem = (message: string, start: number, end: number, severity: 'error' | 'warning') => {
            const s = span(start, end);
            lineInfos[s.line].problems.push({ message, start: s.start, end: s.end, severity });
        };

        const rawFirst = rawLines[logicalLine.line] ?? '';
        if (rawFirst.trim() === '') { info.kind = 'blank'; continue; }
        const trimmedRaw = rawFirst.trimStart();
        if (trimmedRaw.startsWith('#')) {
            info.kind = 'comment';
            const inc = /^#include\s+(\S+)/i.exec(trimmedRaw);
            if (inc) includes.push({ path: inc[1], line: logicalLine.line });
            continue;
        }
        if (trimmedRaw.startsWith('"')) { info.kind = 'comment'; continue; }
        if (info.kind === 'done') continue;

        const indent = text.search(/\S|$/);
        const body = text.substring(indent);
        if (body.trim() === '') { info.kind = 'blank'; continue; }

        // @ options
        if (body.startsWith('@')) {
            info.kind = 'option';
            parseOptions(body.substring(1), indent + 1).forEach(opt => {
                const value = span(opt.valueStart, opt.valueEnd);
                options.push({
                    ...opt,
                    ...span(opt.start, opt.end),
                    valueStart: value.start,
                    valueEnd: opt.value === '' ? value.start : value.end,
                });
            });
            continue;
        }
        // Array blocks and markov rows
        if (body.startsWith('%')) {
            info.kind = 'array-block';
            const range = /^%\s*\[\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*\]/.exec(body);
            arrayBlockRange = range ? [Number(range[1]), Number(range[2])] : undefined;
            continue;
        }
        if (body.startsWith('{')) {
            info.kind = 'markov-row';
            // XPP copies a cell up to its "}" (markov.cpp, markov_cell) and never stops at the
            // line's end: without the "}" it reads on into whatever memory follows.
            const open = /\{[^}]*$/.exec(body);
            if (open) {
                problem('This Markov cell has no closing "}". XPP reads a cell up to its "}" and does not stop ' +
                    'at the end of the line, so it reads on past it and the rate is undefined. Write it as "{a}".',
                    indent + open.index, text.length, 'error');
            }
            addRefs(indent, text.length);
            continue;
        }
        // !name=expr  (derived parameter)
        const derived = new RegExp(`^!\\s*(${IDENT})\\s*=`).exec(body);
        if (derived) {
            info.kind = 'derived';
            const nameStart = indent + body.indexOf(derived[1]);
            declare('derived', derived[1], span(nameStart, nameStart + derived[1].length));
            addRefs(indent + derived[0].length, text.length);
            continue;
        }
        // 0=expr  (algebraic condition)
        if (/^0\s*=/.test(body)) {
            info.kind = 'algebraic';
            addRefs(indent + body.indexOf('=') + 1, text.length);
            continue;
        }

        // Keyword form: word, at least one space, then something that is not "="
        const keywordForm = new RegExp(`^(${IDENT}) +(?!=)(\\S)`).exec(body);
        if (keywordForm) {
            const word = keywordForm[1];
            const kind = keywordKind(word.toLowerCase());
            const restStart = indent + keywordForm[0].length - 1;
            info.keyword = span(indent, indent + word.length);
            if (!kind) {
                info.kind = 'ignored';
                continue;
            }
            info.kind = kind;
            const rest = text.substring(restStart);
            switch (kind) {
                case 'parameter':
                    // items may be separated by commas or just spaces: "par a=1, b=2" / "par a=1  b=2"
                    forEachNameValue(rest, restStart, (name, nameStart) => {
                        declare('parameter', name, span(nameStart, nameStart + name.length));
                    });
                    break;
                case 'init':
                    forEachNameValue(rest, restStart, (name, nameStart, value, valueStart) => {
                        const expanded = expandArrayName(name, arrayBlockRange);
                        const target = expanded ? expanded.base : name;
                        references.push({ name: target, nameLower: target.toLowerCase(), role: 'init', ...span(nameStart, nameStart + target.length) });
                        if (value) initialValues.push({ name, value, form: 'init', ...span(valueStart, valueStart + value.length) });
                    });
                    break;
                case 'aux': {
                    // aux names are display labels and may contain almost anything: "aux P.E.=pe", "aux log(CFU)=..."
                    const assign = /^(\s*)([^=\s]+)\s*=\s*/.exec(rest);
                    if (!assign) { problem(`Expected "name=expression" after "${word}"`, indent, text.length, 'error'); break; }
                    const nameStart = restStart + assign[1].length;
                    declare('aux', assign[2], span(nameStart, nameStart + assign[2].length));
                    addRefs(restStart + assign[0].length, text.length);
                    break;
                }
                case 'volterra':
                case 'solv': {
                    const assign = new RegExp(`^(\\s*)(${IDENT}${ARRAY_SUFFIX})(?:(\\s*)=(\\s*))?`).exec(rest);
                    if (!assign || (kind === 'volterra' && assign[3] === undefined)) {
                        problem(`Expected "name=expression" after "${word}"`, indent, text.length, 'error');
                        break;
                    }
                    const nameStart = restStart + assign[1].length;
                    declare(kind === 'volterra' ? 'state' : 'solv', assign[2], span(nameStart, nameStart + assign[2].length));
                    if (kind === 'solv' && (assign[3] || assign[4])) {
                        problem('XPP requires "solv name=expression" without spaces around "="', nameStart, restStart + assign[0].length, 'error');
                    }
                    addRefs(restStart + assign[0].length, text.length);
                    break;
                }
                case 'export':
                case 'import':
                    // export {x1,x2,...} {y1,...}: everything listed is a use of that name
                    addRefs(restStart, text.length);
                    break;
                case 'wiener': {
                    const nameRegex = new RegExp(IDENT, 'g');
                    let m;
                    while ((m = nameRegex.exec(rest)) !== null) {
                        declare('wiener', m[0], span(restStart + m.index, restStart + m.index + m[0].length));
                    }
                    break;
                }
                case 'markov':
                case 'table': {
                    const nameMatch = new RegExp(`^\\s*(${IDENT})`).exec(rest);
                    if (!nameMatch) { problem(`Expected a name after "${word}"`, indent, text.length, 'error'); break; }
                    const nameStart = restStart + nameMatch[0].length - nameMatch[1].length;
                    declare(kind, nameMatch[1], span(nameStart, nameStart + nameMatch[1].length));
                    if (kind === 'table' && /^\s*@/.test(rest.substring(nameMatch[0].length))) {
                        // expr_symbols.cpp, add_2d_table: not implemented, it always fails
                        problem('XPP has no two-dimensional tables: "table name @ file" stops the model from loading ' +
                            '("TWO D NOT HERE YET"). Use a file table ("table name file") or a formula table ' +
                            '("table name % npts xlo xhi formula").', indent, text.length, 'error');
                    }
                    if (kind === 'table') {
                        // "table name % npts xlo xhi formula": the formula may reference parameters
                        const formula = /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s+%\s+\S+\s+\S+\s+\S+\s+/.exec(rest);
                        if (formula) addRefs(restStart + formula[0].length, text.length);
                    }
                    break;
                }
                case 'global': {
                    // global sign condition {name=expr;name=expr}   (the condition itself may be braced)
                    const braceStart = rest.lastIndexOf('{');
                    const condMatch = /^\s*\S+\s+/.exec(rest);
                    const condStart = restStart + (condMatch ? condMatch[0].length : 0);
                    addRefs(condStart, braceStart === -1 ? text.length : restStart + braceStart);
                    if (braceStart !== -1) {
                        const inner = rest.substring(braceStart + 1).replace(/}\s*$/, '');
                        forEachAssignment(inner, restStart + braceStart + 1, (name, nameStart, valueStart, valueEnd) => {
                            const expanded = expandArrayName(name, arrayBlockRange);
                            const target = expanded ? expanded.base : name;
                            if (!RESERVED_TOKENS.has(target.toLowerCase())) {
                                references.push({ name: target, nameLower: target.toLowerCase(), role: 'expression', ...span(nameStart, nameStart + target.length) });
                            }
                            addRefs(valueStart, valueEnd);
                        }, ';');
                    }
                    break;
                }
                case 'bdry':
                    addRefs(restStart, text.length);
                    break;
                case 'special': {
                    const assign = new RegExp(`^(\\s*)(${IDENT}${ARRAY_SUFFIX})\\s*=\\s*(${IDENT})\\s*\\(`).exec(rest);
                    if (!assign) { problem(`Expected "name=FUNCTION(...)" after "${word}"`, indent, text.length, 'error'); break; }
                    const nameStart = restStart + assign[1].length;
                    declare('special', assign[2], span(nameStart, nameStart + assign[2].length));
                    addRefs(restStart + assign[0].length, text.length);
                    break;
                }
                default:
                    // set / export / import / only / options-file: nothing to check
                    break;
            }
            continue;
        }

        // Equation forms
        const arrayName = `${IDENT}${ARRAY_SUFFIX}`;
        const forms: { regex: RegExp; kind: LineKind; declKind?: DeclKind; nameOffset?: number }[] = [
            { regex: new RegExp(`^(${arrayName})\\s*'\\s*=`), kind: 'state', declKind: 'state' },
            { regex: new RegExp(`^d(${arrayName})/dt\\s*=`, 'i'), kind: 'state', declKind: 'state', nameOffset: 1 },
            { regex: new RegExp(`^(${arrayName})\\s*\\(\\s*t\\s*\\+\\s*1\\s*\\)\\s*=`, 'i'), kind: 'state', declKind: 'state' },
            { regex: new RegExp(`^(${IDENT})\\s*\\(\\s*t\\s*\\)\\s*=`, 'i'), kind: 'state', declKind: 'state' },
            { regex: new RegExp(`^(${arrayName})\\s*\\(\\s*0\\s*\\)\\s*=`), kind: 'initcond' },
        ];
        let matched = false;
        for (const form of forms) {
            const m = form.regex.exec(body);
            if (!m) continue;
            matched = true;
            info.kind = form.kind;
            const nameStart = indent + (form.nameOffset ?? 0);
            if (form.declKind) {
                declare(form.declKind, m[1], span(nameStart, nameStart + m[1].length));
            } else {
                const expanded = expandArrayName(m[1], arrayBlockRange);
                const target = expanded ? expanded.base : m[1];
                references.push({ name: target, nameLower: target.toLowerCase(), role: 'init', ...span(nameStart, nameStart + target.length) });
                const valueStart = indent + m[0].length + body.substring(m[0].length).search(/\S|$/);
                const value = text.substring(valueStart).trimEnd();
                if (value) initialValues.push({ name: m[1], value, form: 'initcond', ...span(valueStart, valueStart + value.length) });
            }
            addRefs(indent + m[0].length, text.length);
            break;
        }
        if (matched) continue;

        const func = new RegExp(`^(${IDENT})\\s*\\(([^)]*)\\)\\s*=`).exec(body);
        if (func) {
            info.kind = 'function';
            const params = func[2].split(',').map(p => p.trim()).filter(Boolean);
            declare('function', func[1], span(indent, indent + func[1].length), { parameters: params });
            const paramSet = new Set(params.map(p => p.toLowerCase()));
            addExpression(indent + func[0].length, text.length);
            scanReferences(text.substring(indent + func[0].length)).forEach(ref => {
                if (paramSet.has(ref.nameLower)) return;
                const s = indent + func[0].length;
                references.push({ ...ref, ...span(s + ref.start, s + ref.end), role: 'expression' });
            });
            continue;
        }

        const fixed = new RegExp(`^(${arrayName})\\s*=`).exec(body);
        if (fixed) {
            info.kind = 'fixed';
            declare('fixed', fixed[1], span(indent, indent + fixed[1].length));
            addRefs(indent + fixed[0].length, text.length);
            continue;
        }

        info.kind = 'ignored';
    }

    return { lines: rawLines, lineInfos, declarations, references, options, initialValues, expressions, includes };
}

/**
 * Calls `fn(name, nameStart, value, valueStart)` for every "name=value" pair in a par/init list.
 * XPP accepts commas or plain spaces between the pairs, and tolerates spaces around "=".
 */
function forEachNameValue(
    text: string,
    offset: number,
    fn: (name: string, nameStart: number, value: string, valueStart: number) => void
): void {
    // a bare name ("par ind") is allowed too: XPP gives it the value 0, and `value` is ""
    const pairRegex = new RegExp(`(${IDENT}${ARRAY_SUFFIX})(?:\\s*=\\s*([^,\\s]*))?`, 'g');
    let m;
    while ((m = pairRegex.exec(text)) !== null) {
        const value = m[2] ?? '';
        fn(m[1], offset + m.index, value, offset + m.index + m[0].length - value.length);
    }
}

/** Calls `fn(name, nameStart, valueStart, valueEnd)` for each "name=value" item in a delimited list. */
function forEachAssignment(
    text: string,
    offset: number,
    fn: (name: string, nameStart: number, valueStart: number, valueEnd: number) => void,
    delimiter: ',' | ';' = ','
): void {
    let chunkOffset = 0;
    for (const chunk of text.split(delimiter)) {
        const m = new RegExp(`^(\\s*)(${IDENT}${ARRAY_SUFFIX})\\s*=`).exec(chunk);
        if (m) {
            const nameStart = offset + chunkOffset + m[1].length;
            fn(m[2], nameStart, offset + chunkOffset + m[0].length, offset + chunkOffset + chunk.length);
        }
        chunkOffset += chunk.length + 1;
    }
}

/**
 * Splits an "@" line the way XPP does. Commas and spaces both separate options — "@ dt=.05
 * meth=cvode total=100" sets all three, verified by running such a file — and each piece must be
 * exactly "name=value". A piece that is not (because spaces were left around the "=", which
 * splits it into "name", "=" and "value") is dropped by XPP without a word, which is why
 * "@ dt = 0.1" silently leaves dt at its default.
 */
function parseOptions(text: string, offset: number): (Omit<OptionEntry, 'line'> & { start: number; end: number })[] {
    const entries: (Omit<OptionEntry, 'line'> & { start: number; end: number })[] = [];
    const pieces: { text: string; start: number }[] = [];
    const pieceRegex = /[^,\s]+/g;
    let m: RegExpExecArray | null;
    while ((m = pieceRegex.exec(text)) !== null) {
        pieces.push({ text: m[0], start: offset + m.index });
    }

    pieces.forEach((piece, index) => {
        const assignment = new RegExp(`^(${IDENT})=(.*)$`).exec(piece.text);
        if (assignment) {
            const nameLower = assignment[1].toLowerCase();
            // "dt= 0.1": the "=" is there but the value was split off, so XPP still drops it.
            const badSpacing = assignment[2] === '';
            const valueStart = piece.start + assignment[1].length + 1;
            entries.push({
                name: assignment[1],
                nameLower,
                start: piece.start,
                end: piece.start + assignment[1].length,
                badSpacing,
                known: KNOWN_OPTIONS.has(nameLower),
                value: assignment[2],
                valueStart,
                valueEnd: valueStart + assignment[2].length,
            });
            return;
        }
        // "dt = 0.1" arrives as "dt", "=", "0.1"; report it once, on the name.
        const bareName = new RegExp(`^(${IDENT})$`).exec(piece.text);
        const next = pieces[index + 1];
        if (bareName && next && next.text.startsWith('=')) {
            const nameLower = bareName[1].toLowerCase();
            const value = next.text.substring(1);
            entries.push({
                name: bareName[1],
                nameLower,
                start: piece.start,
                end: piece.start + bareName[1].length,
                badSpacing: true,
                known: KNOWN_OPTIONS.has(nameLower),
                value,
                valueStart: next.start + 1,
                valueEnd: next.start + 1 + value.length,
            });
        }
    });
    return entries;
}

/**
 * Finds identifiers used in an expression. Skips numbers (including "1e-3"), builtins,
 * indices inside [...] and names followed by "'" (sum indices, Volterra "t'", bdry end values).
 * Handles "name{a-b}" brace expansion by referencing name+a..name+b.
 */
export function scanReferences(expression: string): { name: string; nameLower: string; start: number; end: number }[] {
    const refs: { name: string; nameLower: string; start: number; end: number }[] = [];
    // blank out [...] index expressions but keep offsets
    const masked = expression.replace(/\[[^\]]*\]/g, m => ' '.repeat(m.length));
    const tokenRegex = /(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?/g;
    let m;
    while ((m = tokenRegex.exec(masked)) !== null) {
        if (m[1] !== undefined) continue;
        const name = m[2];
        const start = m.index;
        const end = start + name.length;
        if (masked[end] === "'") continue;
        const lower = name.toLowerCase();
        if (RESERVED_TOKENS.has(lower)) continue;
        if (m[3]) {
            const range = /^\{\s*(\d+)\s*-\s*(\d+)\s*\}$/.exec(m[3]);
            if (range) {
                const [lo, hi] = [Number(range[1]), Number(range[2])];
                for (let i = lo; i <= hi && i - lo < MAX_ARRAY_EXPANSION; i++) {
                    refs.push({ name: `${name}${i}`, nameLower: `${lower}${i}`, start, end });
                }
                continue;
            }
        }
        refs.push({ name, nameLower: lower, start, end });
    }
    return refs;
}
