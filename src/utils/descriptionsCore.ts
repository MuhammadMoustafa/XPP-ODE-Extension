/**
 * Descriptions of XPP names, written in "#" comments like docstrings, shown when hovering a name.
 *
 * A comment after the code of a declaration line describes the names on that line: as a whole
 * ("par gna=120  # sodium conductance"), or split into "name: text" parts separated by ";".
 * The "# name: text" comment lines directly above a declaration line describe its names too.
 * Keys may select array members: "x7", "x[3..5]", "x[1..3, 7]".
 */
import { commentStart, isCommentLine } from './lineUtils';
import { parseXpp, Declaration, DeclKind, LineInfo } from './xppModel';

export type DescriptionLevel = 'exact' | 'selection' | 'inherited';

export interface DescriptionEntry {
    /** Trimmed description text. */
    text: string;
    /** The key as written ("x[1..3]", "gna"); for a plain comment, the name it was attached to. */
    key: string;
    level: DescriptionLevel;
    line: number;
    /** Column span of the whole entry: "key: text", or the comment text of a plain comment. */
    start: number;
    end: number;
    placement: 'trailing' | 'above';
}

export interface DescriptionConflict {
    /** Lower-case name both entries describe. */
    name: string;
    loser: DescriptionEntry;
    winner: DescriptionEntry;
}

export interface DescriptionProblem {
    message: string;
    /** Span of the offending key. */
    line: number;
    start: number;
    end: number;
}

export interface DocumentDescriptions {
    /** Lower-case name -> entries, highest level first, then later in the file first. */
    byName: Map<string, DescriptionEntry[]>;
    conflicts: DescriptionConflict[];
    problems: DescriptionProblem[];
}

/** Human-readable name of each declaration kind. */
export const KIND_LABELS: Record<DeclKind, string> = {
    parameter: 'parameter', derived: 'derived parameter', fixed: 'fixed variable', state: 'state variable',
    function: 'function', aux: 'aux quantity', wiener: 'wiener variable', markov: 'markov variable',
    table: 'table', special: 'special', solv: 'solv variable', array: 'array',
};

const LEVEL_RANK: Record<DescriptionLevel, number> = { exact: 3, selection: 2, inherited: 1 };
const KEY = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\[([^\]]*)\])?$/;
const KEYED_TEXT = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]*\])?)\s*:\s*(\S.*?)\s*$/;
const MAX_SELECTION = 10000;

/** "x[1..3, 7]" -> { base: "x", indices: [1,2,3,7] } (sorted, unique); "gna" -> { base: "gna" }; invalid -> undefined. */
export function parseDescriptionKey(key: string): { base: string; indices?: number[] } | undefined {
    const match = KEY.exec(key.trim());
    if (!match) return undefined;
    if (match[2] === undefined) return { base: match[1] };
    const indices = new Set<number>();
    for (const item of match[2].split(',')) {
        const range = /^\s*(-?\d+)\s*(?:\.\.\s*(-?\d+)\s*)?$/.exec(item);
        if (!range) return undefined;
        const lo = Number(range[1]);
        const hi = range[2] === undefined ? lo : Number(range[2]);
        if (hi < lo || hi - lo >= MAX_SELECTION) return undefined;
        for (let i = lo; i <= hi; i++) indices.add(i);
    }
    return { base: match[1], indices: [...indices].sort((a, b) => a - b) };
}

interface ArrayFamily {
    array: Declaration;
    /** Member index -> member declaration. */
    members: Map<number, Declaration>;
}

/** The names declared by one logical line (a line and its "\" continuations). */
interface DeclarationLine {
    first: number;
    last: number;
    /** The names as a plain comment counts them: an array is one name. */
    units: Declaration[];
    /** Lower-case array name -> its family. */
    arrays: Map<string, ArrayFamily>;
    /** Every lower-case name on the line, array members included. */
    names: Set<string>;
}

interface Target {
    nameLower: string;
    level: DescriptionLevel;
}

interface KeyedText {
    key: string;
    text: string;
    /** Span of "key: text" on its line. */
    start: number;
    end: number;
}

type AddEntry = (target: Target, entry: Omit<DescriptionEntry, 'level'>) => void;

/** Every description written in the comments of an .ode/.inc file, with its duplicates and bad keys. */
export function collectDescriptions(text: string): DocumentDescriptions {
    const model = parseXpp(text);
    const found: { nameLower: string; entry: DescriptionEntry }[] = [];
    const problems: DescriptionProblem[] = [];
    const add: AddEntry = (target, entry) => found.push({ nameLower: target.nameLower, entry: { ...entry, level: target.level } });

    for (const declLine of declarationLines(model.declarations, model.lineInfos)) {
        collectAbove(model.lines, declLine, add, problems);
        for (let line = declLine.first; line <= declLine.last; line++) {
            collectTrailing(model.lines[line], line, declLine, add);
        }
    }
    const byName = groupByName(found);
    return { byName, conflicts: findConflicts(byName), problems };
}

/** Declarations grouped by logical line, in file order. */
function declarationLines(declarations: Declaration[], lineInfos: LineInfo[]): DeclarationLine[] {
    const isContinuation = (line: number) => lineInfos[line]?.kind === 'continuation';
    const byFirst = new Map<number, DeclarationLine>();
    const families = arrayFamilies(declarations);
    for (const decl of declarations) {
        let first = decl.line;
        while (isContinuation(first)) first--;
        let declLine = byFirst.get(first);
        if (!declLine) {
            let last = first;
            while (isContinuation(last + 1)) last++;
            declLine = { first, last, units: [], arrays: new Map(), names: new Set() };
            byFirst.set(first, declLine);
        }
        declLine.names.add(decl.nameLower);
        if (decl.kind === 'array') declLine.arrays.set(decl.nameLower, families.get(decl)!);
        if (decl.kind === 'array' || !decl.fromArray) declLine.units.push(decl);
    }
    return [...byFirst.values()];
}

/** Each array declaration with its members, which the parser lists right after it. */
function arrayFamilies(declarations: Declaration[]): Map<Declaration, ArrayFamily> {
    const families = new Map<Declaration, ArrayFamily>();
    let current: ArrayFamily | undefined;
    for (const decl of declarations) {
        if (decl.kind === 'array') {
            current = { array: decl, members: new Map() };
            families.set(decl, current);
        } else if (decl.fromArray && current) {
            current.members.set(Number(decl.nameLower.substring(current.array.nameLower.length)), decl);
        } else {
            current = undefined;
        }
    }
    return families;
}

/** "x[1..10]", from the members the parser produced. */
function familyRange(family: ArrayFamily): string {
    const indices = [...family.members.keys()];
    if (indices.length === 0) return family.array.name;
    return `${family.array.name}[${Math.min(...indices)}..${Math.max(...indices)}]`;
}

/** The names a key describes on a declaration line, and why part of it describes nothing. */
function resolveKey(key: string, declLine: DeclarationLine): { targets: Target[]; problem?: string } {
    const parsed = parseDescriptionKey(key);
    if (!parsed) return { targets: [] };
    const base = parsed.base.toLowerCase();
    const family = declLine.arrays.get(base);
    if (parsed.indices) {
        if (!family) return { targets: [] };
        const inside = parsed.indices.filter(i => family.members.has(i));
        const outside = parsed.indices.filter(i => !family.members.has(i));
        return {
            targets: inside.map(i => ({ nameLower: family.members.get(i)!.nameLower, level: 'selection' })),
            problem: outside.length > 0 ? notMembers(outside.map(i => `${family.array.name}${i}`), family) : undefined,
        };
    }
    if (family) return { targets: [{ nameLower: base, level: 'exact' }, ...inheritedMembers(family)] };
    if (declLine.names.has(base)) return { targets: [{ nameLower: base, level: 'exact' }] };
    const owner = [...declLine.arrays.values()].find(f => isMemberLike(base, f.array.nameLower));
    return { targets: [], problem: owner ? notMembers([parsed.base], owner) : undefined };
}

function isMemberLike(nameLower: string, arrayLower: string): boolean {
    return nameLower.startsWith(arrayLower) && /^-?\d+$/.test(nameLower.substring(arrayLower.length));
}

function notMembers(names: string[], family: ArrayFamily): string {
    const verb = names.length === 1 ? 'is not a member' : 'are not members';
    return `${names.join(', ')} ${verb} of ${familyRange(family)}`;
}

function inheritedMembers(family: ArrayFamily): Target[] {
    return [...family.members.values()].map(m => ({ nameLower: m.nameLower, level: 'inherited' }));
}

/** "key: text" at `offset` of its line, or undefined when `text` is not of that form. */
function parseKeyed(text: string, offset: number): KeyedText | undefined {
    const match = KEYED_TEXT.exec(text);
    if (!match || !parseDescriptionKey(match[2])) return undefined;
    const start = offset + match[1].length;
    return { key: match[2], text: match[3], start, end: offset + text.trimEnd().length };
}

/** The "# key: text" lines of the comment block directly above the declaration line. */
function collectAbove(lines: string[], declLine: DeclarationLine, add: AddEntry, problems: DescriptionProblem[]): void {
    for (let line = declLine.first - 1; line >= 0 && isCommentLine(lines[line]); line--) {
        const hash = lines[line].indexOf('#');
        const keyed = parseKeyed(lines[line].substring(hash + 1), hash + 1);
        if (!keyed) continue;
        const { targets, problem } = resolveKey(keyed.key, declLine);
        if (problem) problems.push({ message: problem, line, start: keyed.start, end: keyed.start + keyed.key.length });
        const { key, text, start, end } = keyed;
        targets.forEach(target => add(target, { text, key, line, start, end, placement: 'above' }));
    }
}

/** The comment after the code on one physical line of the declaration line. */
function collectTrailing(rawLine: string, line: number, declLine: DeclarationLine, add: AddEntry): void {
    const hash = commentStart(rawLine);
    if (hash === -1 || rawLine.substring(hash + 1).trim() === '') return;
    const parts = splitParts(rawLine, hash + 1);
    const keyedParts = parts
        .map(part => keyedPart(part.text, part.start, declLine))
        .filter((part): part is KeyedPart => part !== undefined);
    if (keyedParts.length < parts.length) {
        addPlain(rawLine, hash + 1, line, declLine, add);
        return;
    }
    for (const { keyed: { key, text, start, end }, targets } of keyedParts) {
        targets.forEach(target => add(target, { text, key, line, start, end, placement: 'trailing' }));
    }
}

interface KeyedPart {
    keyed: KeyedText;
    targets: Target[];
}

/** A "key: text" part whose key fully describes names on the line, or undefined. */
function keyedPart(text: string, offset: number, declLine: DeclarationLine): KeyedPart | undefined {
    const keyed = parseKeyed(text, offset);
    if (!keyed) return undefined;
    const { targets, problem } = resolveKey(keyed.key, declLine);
    return targets.length > 0 && !problem ? { keyed, targets } : undefined;
}

/** The ";"-separated parts of the comment starting at `offset`. */
function splitParts(rawLine: string, offset: number): { text: string; start: number }[] {
    const parts: { text: string; start: number }[] = [];
    let start = offset;
    for (const text of rawLine.substring(offset).split(';')) {
        parts.push({ text, start });
        start += text.length + 1;
    }
    return parts;
}

/** A comment without keys: the description of the line's only name, or shared by all of them. */
function addPlain(rawLine: string, offset: number, line: number, declLine: DeclarationLine, add: AddEntry): void {
    const comment = rawLine.substring(offset);
    const start = offset + comment.search(/\S/);
    const text = comment.trim();
    const shared = declLine.units.length > 1;
    for (const unit of declLine.units) {
        const entry = { text, key: unit.name, line, start, end: start + text.length, placement: 'trailing' as const };
        add({ nameLower: unit.nameLower, level: shared ? 'inherited' : 'exact' }, entry);
        const family = declLine.arrays.get(unit.nameLower);
        if (family) inheritedMembers(family).forEach(target => add(target, entry));
    }
}

/** Entries per name, highest level first, then later in the file first. */
function groupByName(found: { nameLower: string; entry: DescriptionEntry }[]): Map<string, DescriptionEntry[]> {
    const byName = new Map<string, DescriptionEntry[]>();
    for (const { nameLower, entry } of found) {
        byName.set(nameLower, [...(byName.get(nameLower) ?? []), entry]);
    }
    byName.forEach(entries => entries.sort((a, b) =>
        LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.line - a.line || b.start - a.start));
    return byName;
}

/** Two exact or two selection entries for one name: the later wins, every other one loses to it. */
function findConflicts(byName: Map<string, DescriptionEntry[]>): DescriptionConflict[] {
    const conflicts: DescriptionConflict[] = [];
    byName.forEach((entries, name) => {
        for (const level of ['exact', 'selection'] as const) {
            const [winner, ...losers] = entries.filter(e => e.level === level);
            losers.forEach(loser => conflicts.push({ name, loser, winner }));
        }
    });
    return conflicts;
}

/** What the hover says about a declared name. */
export interface NameInfo {
    /** The declaration kind; for an array, the kind of its members. */
    kind: DeclKind;
    kindLabel: string;
    /** Lower-case array name, for an array member. */
    arrayBase?: string;
}

/** Describes a declared name, or returns undefined when `declarations` does not declare it. */
export function describeName(declarations: Declaration[], nameLower: string): NameInfo | undefined {
    const families = [...arrayFamilies(declarations).values()];
    const array = families.find(f => f.array.nameLower === nameLower);
    if (array) {
        const kind = array.members.values().next().value?.kind ?? 'array';
        return { kind, kindLabel: `array ${familyRange(array)} of ${KIND_LABELS[kind]}s` };
    }
    const decl = declarations.find(d => d.nameLower === nameLower);
    if (!decl) return undefined;
    const owner = decl.fromArray ? families.find(f => [...f.members.values()].includes(decl)) : undefined;
    if (!owner) return { kind: decl.kind, kindLabel: KIND_LABELS[decl.kind] };
    return {
        kind: decl.kind,
        kindLabel: `${KIND_LABELS[decl.kind]} (array ${familyRange(owner)})`,
        arrayBase: owner.array.nameLower,
    };
}

/** Markdown for the hover: the name and kind, then the comment descriptions, then the configured ones. */
export function formatDescriptionHover(input: {
    name: string;
    kindLabel: string;
    entries: DescriptionEntry[];
    configDescriptions: { text: string; key: string }[];
    /** Entries written in "#include"d files, shown after the file's own. */
    includedEntries?: { file: string; entries: DescriptionEntry[] }[];
}): string {
    const nameLower = input.name.toLowerCase();
    const describe = (entry: DescriptionEntry, where: string) =>
        `${entry.text} (${where})${entry.key.toLowerCase() === nameLower ? '' : ` — from ${entry.key}`}`;
    return [
        `**${input.name}** — ${input.kindLabel}`,
        ...input.entries.map(e => describe(e, `line ${e.line + 1}`)),
        ...(input.includedEntries ?? []).flatMap(inc => inc.entries.map(e => describe(e, `${inc.file}, line ${e.line + 1}`))),
        ...input.configDescriptions.map(d => `${d.text} (.xppsettings.json: ${d.key})`),
    ].join('\n\n');
}

/** Start and end (exclusive) of the text to delete to remove a description entry. */
export interface EntryRemoval {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

/**
 * What removing an entry deletes: a comment line above the declaration entirely; a keyed part of
 * a trailing comment with its ";"; otherwise the whole trailing comment with the spaces before it.
 */
export function entryRemoval(lines: string[], entry: DescriptionEntry): EntryRemoval {
    const at = (character: number, line = entry.line) => ({ line, character });
    if (entry.placement === 'above') return { start: at(0), end: at(0, entry.line + 1) };
    const text = lines[entry.line];
    const separatorAfter = /^\s*;\s*/.exec(text.substring(entry.end));
    if (separatorAfter) return { start: at(entry.start), end: at(entry.end + separatorAfter[0].length) };
    const separatorBefore = /\s*;\s*$/.exec(text.substring(0, entry.start));
    if (separatorBefore) return { start: at(separatorBefore.index), end: at(entry.end) };
    return { start: at(text.substring(0, commentStart(text)).trimEnd().length), end: at(text.length) };
}
