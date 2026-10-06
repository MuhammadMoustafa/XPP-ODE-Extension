import { XppModel, Declaration, isKeywordLikeName } from './xppModel';
import { numericOptionNames } from './constants';

export interface SemanticResult {
    message: string;
    line: number;
    start: number;
    end: number;
    severity: 'error' | 'warning' | 'information';
    type: 'undefined' | 'unused' | 'init-target' | 'ignored-line' | 'keyword-name' | 'option' | 'option-value' | 'syntax'
        | 'init-value' | 'initcond-formula' | 'markov-duplicate' | 'derived-frozen' | 'hash-comment' | 'array-member-duplicate';
    /** A page that explains the finding; the diagnostic's code links to it. */
    href?: string;
    /** What the diagnostic's code link shows, when it should read differently from `type`. */
    codeLabel?: string;
    /** Render the range faded (VS Code "unnecessary" tag). */
    unnecessary?: boolean;
    /** A sure fix: replace this span (which may be on another line than the finding) with `text`. */
    fix?: { title: string; line: number; start: number; end: number; text: string };
}

/** Declarations that never need to be referenced to be useful. */
const NEVER_UNUSED: Set<Declaration['kind']> = new Set(['state', 'aux', 'solv', 'array']);

/** Declarations whose names may be targets of "init" / "x(0)=". */
const INIT_TARGETS: Set<Declaration['kind']> = new Set(['state', 'markov', 'array', 'solv']);

export const IGNORED_LINE_MESSAGE =
    'XPP does not recognise this line and silently ignores it. Declarations start with ' +
    'p(ar), i(nit), au(x), w(iener), n(umber), g(lobal), b(dry), v(olt), ma(rkov), ta(ble), se(t), so(lv), ' +
    'sp(ecial), ex(port), im(port), on(ly), o(ptions) or d(one), followed by a space (tabs do not count); ' +
    'equations look like x\'=, dx/dt=, x(t+1)=, x(0)=, f(x)=, name=, !name= or 0=.';

/**
 * Semantic checks on a parsed file.
 * `externalNames` are names declared elsewhere (e.g. in #include'd files or, for an .inc file,
 * in the .ode that includes it); when `skipUndefined` is set, undefined-name checks are disabled.
 */
export function checkSemantics(
    model: XppModel,
    externalNames: Set<string> = new Set(),
    skipUndefined = false
): SemanticResult[] {
    const results: SemanticResult[] = [];
    const declaredByName = new Map<string, Declaration[]>();
    for (const decl of model.declarations) {
        const list = declaredByName.get(decl.nameLower) ?? [];
        list.push(decl);
        declaredByName.set(decl.nameLower, list);
    }
    // Array families: a reference "v[j]" arrives as its base "v"; it is defined when members such as
    // "v1" exist. Conversely a member "v0=..." counts as used when the base "v" is referenced.
    const memberBases = new Set<string>();
    for (const decl of model.declarations) {
        const m = /^(.+?)\d+$/.exec(decl.nameLower);
        if (m) memberBases.add(m[1]);
    }
    const isDeclared = (nameLower: string) =>
        declaredByName.has(nameLower) || externalNames.has(nameLower) || memberBases.has(nameLower);
    const baseIsArrayOnly = (base: string) =>
        (declaredByName.get(base) ?? []).every(d => d.kind === 'array');

    // Line-level problems and ignored lines
    for (const info of model.lineInfos) {
        for (const p of info.problems) {
            results.push({
                message: p.message, line: info.line, start: p.start, end: p.end, severity: p.severity,
                type: p.type ?? 'syntax', href: p.href, codeLabel: p.codeLabel,
                fix: p.type === 'hash-comment' ? moveCommentAbove(model, info.line, p.start) : undefined,
            });
        }
        if (info.kind === 'ignored') {
            const text = model.lines[info.line];
            results.push({
                message: IGNORED_LINE_MESSAGE,
                line: info.line,
                start: text.search(/\S|$/),
                end: text.length,
                severity: 'warning',
                type: 'ignored-line',
            });
        }
    }

    // Options
    for (const opt of model.options) {
        if (opt.badSpacing) {
            results.push({
                message: `Option "${opt.name}" is ignored by XPP and its default is used. On an "@" line each option ` +
                    `must be exactly "name=value" with no spaces around the "=" and a value present; ` +
                    `spaces and commas both separate one option from the next, so "@ dt = 0.1" is read as ` +
                    `the three unrelated words "dt", "=" and "0.1" and dropped.`,
                line: opt.line, start: opt.start, end: opt.end, severity: 'error', type: 'option',
            });
        } else if (!opt.known) {
            results.push({
                message: `Unknown option "${opt.name}"`,
                line: opt.line, start: opt.start, end: opt.end, severity: 'warning', type: 'option',
            });
        } else if (NUMERIC_OPTIONS.has(opt.nameLower) && !PLAIN_NUMBER.test(opt.value)) {
            results.push({
                message: optionValueMessage(opt.name, opt.value),
                line: opt.line,
                start: opt.value === '' ? opt.start : opt.valueStart,
                end: opt.value === '' ? opt.end : opt.valueEnd,
                // An error, like the spacing case beside it: XPP runs, but there is no legitimate
                // reason to write a numeric option this way, so it is always a mistake.
                severity: 'error',
                type: 'option-value',
            });
        }
    }

    results.push(...checkInitialValues(model));
    results.push(...checkDerivedParameters(model, declaredByName));

    // A second "markov" with a name already used: XPP stops loading ("Bad expression z[0][0]")
    const markovNames = new Set<string>();
    for (const decl of model.declarations.filter(d => d.kind === 'markov')) {
        if (markovNames.has(decl.nameLower)) {
            results.push({
                message: `A Markov chain "${decl.name}" is already declared. XPP makes a second chain but no second ` +
                    `variable, and the model does not load ("Bad expression ${decl.name}[0][0]"). Give each chain its own name.`,
                line: decl.line, start: decl.start, end: decl.end, severity: 'error', type: 'markov-duplicate',
            });
        }
        markovNames.add(decl.nameLower);
    }

    // "x[1..3]" declares x1, x2, x3: a second declaration of one of them stops XPP ("Duplicate name X2")
    const members = new Set(model.declarations.filter(d => d.fromArray && d.kind !== 'array').map(d => d.nameLower));
    for (const decl of model.declarations.filter(d => !d.fromArray && members.has(d.nameLower))) {
        results.push({
            message: `Duplicate name ${decl.name.toUpperCase()}: "${decl.name}" is already a member of an array, so XPP stops ` +
                `loading the model. Reading it (aux a=${decl.name}) is fine; declaring it again is not.`,
            line: decl.line, start: decl.start, end: decl.end, severity: 'error', type: 'array-member-duplicate',
        });
    }

    // Keyword-like names on fixed-variable lines: "p=1" is a variable, "p a=1" a declaration
    for (const decl of model.declarations) {
        if (decl.kind === 'fixed' && !decl.fromArray && isKeywordLikeName(decl.name)) {
            results.push({
                message: `"${decl.name}" is also an XPP declaration keyword. XPP treats "${decl.name}=..." as a fixed variable ` +
                    `because "=" follows the name, but "${decl.name} x=1" would be a declaration, so this line is easy to misread.`,
                line: decl.line, start: decl.start, end: decl.end, severity: 'warning', type: 'keyword-name',
            });
        }
    }

    // References
    const used = new Set<string>();
    const reported = new Set<string>();
    for (const ref of model.references) {
        used.add(ref.nameLower);
        if (ref.role === 'init') {
            const targets = declaredByName.get(ref.nameLower) ?? [];
            const ok = targets.some(d => INIT_TARGETS.has(d.kind)) || externalNames.has(ref.nameLower);
            if (!ok && !skipUndefined) {
                results.push({
                    message: `"${ref.name}" is not a state variable, so this initial condition has no effect`,
                    line: ref.line, start: ref.start, end: ref.end, severity: 'warning', type: 'init-target',
                });
            }
            continue;
        }
        if (skipUndefined || isDeclared(ref.nameLower)) continue;
        const key = `${ref.line}:${ref.start}`;
        if (reported.has(key)) continue;
        reported.add(key);
        results.push({
            message: `"${ref.name}" is not defined`,
            line: ref.line, start: ref.start, end: ref.end, severity: 'warning', type: 'undefined',
        });
    }

    // Unused declarations
    for (const decl of model.declarations) {
        if (NEVER_UNUSED.has(decl.kind) || decl.fromArray) continue;
        if (used.has(decl.nameLower)) continue;
        const member = /^(.+?)\d+$/.exec(decl.nameLower);
        if (member && used.has(member[1]) && baseIsArrayOnly(member[1])) continue;
        results.push({
            message: `${capitalize(decl.kind)} "${decl.name}" is never used`,
            line: decl.line, start: decl.start, end: decl.end, severity: 'warning', type: 'unused', unnecessary: true,
        });
    }

    return results;
}

/**
 * The fix for a "#" comment after a name list: the comment moves to lines above, written
 * "# name: text" because that is the form that describes a name there. "a: x; b: y" parts
 * become one line each; any other comment is repeated for every name on the line.
 */
function moveCommentAbove(model: XppModel, line: number, hash: number): SemanticResult['fix'] {
    const raw = model.lines[line];
    const indent = raw.substring(0, raw.length - raw.trimStart().length);
    const code = raw.substring(0, hash).trimEnd();
    const comment = raw.substring(hash).replace(/^#+\s*/, '').trim();
    const names = [...new Set([
        ...model.declarations.filter(d => d.line === line && !d.fromArray).map(d => d.name),
        ...model.references.filter(r => r.line === line && r.role === 'init').map(r => r.name),
    ])];
    const parts = comment.split(';').map(part => /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(\S.*?)\s*$/.exec(part));
    const keyed = parts.every(m => m && names.some(n => n.toLowerCase() === m[1].toLowerCase()));
    // One line, as the author wrote it, when the comment is already "name: text; ..." or can be
    // shared as "a: text; b: text"; a plain comment holding ";" would be split wrongly, so it gets a line per name.
    const oneLine = keyed ? comment
        : names.length > 0 && !comment.includes(';') ? names.map(n => `${n}: ${comment}`).join('; ')
        : undefined;
    const lines = oneLine !== undefined ? [`# ${oneLine}`]
        : names.length > 0 ? names.map(n => `# ${n}: ${comment}`) : [`# ${comment}`];
    return {
        title: 'Move the comment to its own line above',
        line, start: 0, end: raw.length,
        text: [...lines.map(l => indent + l), code].join('\n'),
    };
}

const NUMERIC_OPTIONS = new Set(numericOptionNames);

/** Exactly what `atof()` consumes: an optional sign, digits with an optional ".", an exponent. */
const PLAIN_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * What `atof()` makes of a value: the number it actually uses and a clause saying why. atof stops
 * at the first character that cannot be part of a number and never reports an error, so "2*3" is
 * 2 and "a" is 0.
 */
function atofReading(value: string): { used: string; hint: string } {
    const prefix = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(value);
    const used = prefix ? prefix[0] : '0';
    const hint = prefix
        ? `XPP reads the value with "atof", which stops at "${value.substring(used.length)}"`
        : `XPP reads the value with "atof", which finds no number in "${value}"`;
    return { used, hint };
}

/** A numeric "@" option is read with `atof()`: "@ total=2*3" is 2, not 6. */
function optionValueMessage(name: string, value: string): string {
    const { used, hint } = atofReading(value);
    return `Option "${name}" is silently set to ${used}, not "${value}". ${hint}, and reports nothing. ` +
        `"@" options take a plain number: they are not expressions, so "@ total=2*3" is 2, not 6. ` +
        `Work the value out yourself, or put it in a "par" and use that in your equations.`;
}

/**
 * "init x=VALUE" and "x(0)=VALUE" are read with `atof()` too (xppautX core/form_ode.cpp):
 * "init y=2*3" starts y at 2 and "init y=a" at 0. An "x(0)=" formula is not an error, since XPP
 * keeps it as the history of x for delay equations, but x still starts at the atof value.
 * An array's "x[1..9](0)=" is the exception: XPP evaluates it ("=a*[j]" works), so it is left alone.
 */
function checkInitialValues(model: XppModel): SemanticResult[] {
    const hasDelays = model.expressions.some(e => /\bdelay\s*\(/i.test(e.text));
    return model.initialValues
        .filter(init => !(init.form === 'initcond' && init.name.includes('[')))
        .filter(init => !PLAIN_NUMBER.test(init.value.replace(/\s+/g, '')))
        .map(init => {
            const value = init.value.replace(/\s+/g, '');
            const { used, hint } = atofReading(value);
            const span = { line: init.line, start: init.start, end: init.end };
            if (init.form === 'init') {
                return {
                    ...span,
                    message: `"${init.name}" silently starts at ${used}, not "${value}". ${hint}, and reports nothing. ` +
                        `"init" takes a plain number: it is not an expression, so "init y=2*3" is 2, not 6. ` +
                        `Work the value out yourself.`,
                    severity: 'error',
                    type: 'init-value',
                };
            }
            return {
                ...span,
                message: `XPP starts "${init.name}" at ${used} here, not at "${value}": ${hint}. An initial condition ` +
                    `is a plain number; a formula is only kept as the history of "${init.name}" for delay equations.` +
                    (hasDelays ? '' : ' Work the value out yourself.'),
                // With delays in the model, a formula here is likely meant as history.
                severity: hasDelays ? 'information' : 'warning',
                type: 'initcond-formula',
            };
        });
}

/** Declarations whose value changes during a run. */
const CHANGING: Set<Declaration['kind']> = new Set(['state', 'aux', 'fixed', 'markov', 'solv', 'array', 'wiener']);

/**
 * A derived parameter "!d=..." is worked out at a run's start and after a parameter change
 * (xppautX derived.cpp, evaluate_derived), so what it reads is frozen there. Measured: with
 * y'=1, y(0)=1, "!d=y" stays 1, "!e=t" stays 0 and "!r=ran(1)" keeps one draw.
 */
function checkDerivedParameters(model: XppModel, declaredByName: Map<string, Declaration[]>): SemanticResult[] {
    const results: SemanticResult[] = [];
    for (const derived of model.declarations.filter(d => d.kind === 'derived')) {
        // The formula, with any "\\" continuation lines joined
        const segment = model.expressions.find(e => e.positions[0]?.line === derived.line);
        const inFormula = (ref: { line: number; start: number }) =>
            !!segment?.positions.some(p => p.line === ref.line && p.col === ref.start);
        const variable = model.references.find(ref => ref.role === 'expression' && inFormula(ref) &&
            (declaredByName.get(ref.nameLower) ?? []).some(d => CHANGING.has(d.kind)));
        let found: { name: string; line: number; start: number; end: number; what: string } | undefined = variable && {
            name: variable.name, line: variable.line, start: variable.start, end: variable.end,
            what: `keeps the value "${variable.name}" has then, so "!${derived.name}" does not follow "${variable.name}"`,
        };
        if (!found) {
            const m = segment && /\b(?:(t)\b(?!\s*\()|(ran|normal)\s*\()/i.exec(segment.text);
            if (segment && m) {
                const name = m[1] ?? m[2];
                const at = segment.positions[m.index];
                found = {
                    name, line: at.line, start: at.col, end: at.col + name.length,
                    what: m[1] ? `keeps the value of t then (0 at the start), not the running time`
                        : `makes one draw of "${name}" for the whole run, not a new one each step`,
                };
            }
        }
        if (!found) continue;
        const bang = model.lines[derived.line].lastIndexOf('!', derived.start);
        results.push({
            message: `"!${derived.name}" is worked out once, at the start of a run and after a parameter changes, ` +
                `so it ${found.what}. Measured: with y'=1 and y(0)=1, "!d=y" stays 1. ` +
                `Write it without the "!" ("${derived.name}=...") to have it worked out every step.`,
            line: found.line, start: found.start, end: found.end, severity: 'warning', type: 'derived-frozen',
            fix: { title: `Write "${derived.name}=..." (worked out every step)`, line: derived.line, start: bang, end: derived.start, text: '' },
        });
    }
    return results;
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}
