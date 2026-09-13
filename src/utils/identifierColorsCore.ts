/**
 * User-defined colours for identifiers ("x" in red, "a" bold green, ...), independent of the
 * theme. The configuration is a map from identifier name (or "@group") to a hex colour or a
 * style object, coming from the "xpp-ode.identifierColors" setting and/or ".xppcolors.json" files.
 */
import { codeLines, codePart } from './lineUtils';
import { parseXpp, DeclKind } from './xppModel';
import { builtinFunctions, builtinConstants, specialFunctions } from './constants';

/** Visual properties; all optional so that a theme variant can override just one of them. */
export interface ThemeStyle {
    /** CSS hex colour: #rgb, #rgba, #rrggbb or #rrggbbaa. */
    color?: string;
    backgroundColor?: string;
    fontStyle?: 'normal' | 'italic';
    fontWeight?: 'normal' | 'bold';
    /** CSS text-decoration, e.g. "underline", "line-through", "underline wavy". */
    textDecoration?: string;
    /** 0 (invisible) to 1 (opaque). */
    opacity?: number;
    /** Box around the name; a colour alone gives a 1px solid box. */
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
    /** CSS length, e.g. "1px". */
    borderWidth?: string;
    /** CSS length, e.g. "3px". */
    borderRadius?: string;
}

export interface IdentifierStyle extends ThemeStyle {
    /** Overrides applied only in light themes. */
    light?: ThemeStyle;
    /** Overrides applied only in dark themes. */
    dark?: ThemeStyle;
}

/** Categories that can be styled as a whole with an "@name" key. */
export const GROUP_NAMES = [
    '@states', '@parameters', '@fixed', '@functions', '@aux', '@wiener', '@markov', '@tables',
    '@options', '@builtins', '@keywords',
] as const;
export type GroupName = typeof GROUP_NAMES[number];

export interface WildcardStyle {
    /** The key as written, lower-cased, e.g. "v_*". */
    pattern: string;
    regex: RegExp;
    style: IdentifierStyle;
}

export interface ColorConfig {
    /** Lower-cased identifier name -> style. */
    styles: Map<string, IdentifierStyle>;
    /** Keys containing "*", in definition order; the last matching one wins. */
    wildcards: WildcardStyle[];
    /** Group name ("@states", "@parameters", ...) -> style. */
    groups: Map<GroupName, IdentifierStyle>;
    /** Human readable problems found while reading the configuration. */
    errors: string[];
}

export interface ColoredRange {
    line: number;
    start: number;
    end: number;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
/** A name with "*" wildcards, e.g. "v_*", "*_syn", "u*x". */
const WILDCARD = /^(?=.*\*)(?=.*[a-z0-9_])[a-z0-9_*]+$/i;
/** Plain CSS words and numbers only, so a value cannot smuggle extra CSS declarations in. */
const CSS_VALUE = /^[a-z0-9#%.\s-]+$/i;
const FONT_STYLES = new Set(['normal', 'italic']);
const FONT_WEIGHTS = new Set(['normal', 'bold']);
const THEME_KEYS: (keyof ThemeStyle)[] = [
    'color', 'backgroundColor', 'fontStyle', 'fontWeight', 'textDecoration', 'opacity',
    'borderColor', 'borderStyle', 'borderWidth', 'borderRadius',
];
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double']);
/** A CSS length such as "1px", "0.5em" or "2". */
const CSS_LENGTH = /^\d+(\.\d+)?(px|em|rem|%)?$/;
const HEX_MESSAGE = 'must be a hex colour (#rgb, #rrggbb or #rrggbbaa)';

const GROUP_OF_KIND: Partial<Record<DeclKind, GroupName>> = {
    state: '@states', solv: '@states',
    parameter: '@parameters', derived: '@parameters',
    fixed: '@fixed', function: '@functions', aux: '@aux', wiener: '@wiener', markov: '@markov',
    table: '@tables', special: '@tables',
};
const BUILTIN_NAMES = new Set<string>([...builtinFunctions, ...builtinConstants, ...specialFunctions]);

/**
 * Validates a raw configuration object `{ name | "@group": "#rrggbb" | { color, fontWeight, ..., light, dark } }`.
 * Invalid entries are skipped and described in `errors`; `source` names where the config came from.
 */
export function parseColorConfig(raw: unknown, source = 'settings'): ColorConfig {
    const styles = new Map<string, IdentifierStyle>();
    const wildcards: WildcardStyle[] = [];
    const groups = new Map<GroupName, IdentifierStyle>();
    const errors: string[] = [];
    if (raw === undefined || raw === null) return { styles, wildcards, groups, errors };
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push(`${source}: expected an object mapping identifier names to colours`);
        return { styles, wildcards, groups, errors };
    }
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        const kind = name.startsWith('@') ? 'group' : name.includes('*') ? 'wildcard' : 'name';
        if (kind === 'group' && !(GROUP_NAMES as readonly string[]).includes(name.toLowerCase())) {
            errors.push(`${source}: "${name}" is not a known group (expected one of ${GROUP_NAMES.join(', ')})`);
            continue;
        }
        if (kind === 'wildcard' && !WILDCARD.test(name)) {
            errors.push(`${source}: "${name}" is not a valid wildcard (letters, digits, "_" and "*" only, e.g. "v_*")`);
            continue;
        }
        if (kind === 'name' && !IDENTIFIER.test(name)) {
            errors.push(`${source}: "${name}" is not a valid identifier name`);
            continue;
        }
        const style = toStyle(value);
        if (typeof style === 'string') {
            errors.push(`${source}: "${name}": ${style}`);
            continue;
        }
        const lower = name.toLowerCase();
        if (kind === 'group') groups.set(lower as GroupName, style);
        else if (kind === 'wildcard') wildcards.push({ pattern: lower, regex: wildcardToRegex(lower), style });
        else styles.set(lower, style);
    }
    return { styles, wildcards, groups, errors };
}

function wildcardToRegex(pattern: string): RegExp {
    return new RegExp('^' + pattern.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9_]*') + '$');
}

function toStyle(value: unknown): IdentifierStyle | string {
    if (typeof value === 'string') {
        return HEX_COLOR.test(value.trim()) ? { color: value.trim() } : `"${value}" ${HEX_MESSAGE}`;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'expected a hex colour string or a style object';
    }
    const obj = value as Record<string, unknown>;
    const base = toThemeStyle(obj);
    if (typeof base === 'string') return base;
    const style: IdentifierStyle = base;
    for (const theme of ['light', 'dark'] as const) {
        if (obj[theme] === undefined) continue;
        if (typeof obj[theme] !== 'object' || obj[theme] === null || Array.isArray(obj[theme])) {
            return `"${theme}" must be a style object`;
        }
        const variant = toThemeStyle(obj[theme] as Record<string, unknown>);
        if (typeof variant === 'string') return `"${theme}": ${variant}`;
        style[theme] = variant;
    }
    const hasAnything = (s: ThemeStyle) => THEME_KEYS.some(k => s[k] !== undefined);
    if (!hasAnything(style) && !(style.light && hasAnything(style.light)) && !(style.dark && hasAnything(style.dark))) {
        return 'style object has no properties (expected color, backgroundColor, fontWeight, fontStyle, textDecoration, opacity, borderColor, borderStyle, borderWidth or borderRadius)';
    }
    return style;
}

function toThemeStyle(obj: Record<string, unknown>): ThemeStyle | string {
    const style: ThemeStyle = {};
    for (const key of ['color', 'backgroundColor'] as const) {
        if (obj[key] === undefined) continue;
        if (typeof obj[key] !== 'string' || !HEX_COLOR.test((obj[key] as string).trim())) {
            return `"${key}" ${HEX_MESSAGE}, got ${JSON.stringify(obj[key])}`;
        }
        style[key] = (obj[key] as string).trim();
    }
    if (obj.fontStyle !== undefined) {
        if (typeof obj.fontStyle !== 'string' || !FONT_STYLES.has(obj.fontStyle)) return '"fontStyle" must be "normal" or "italic"';
        style.fontStyle = obj.fontStyle as ThemeStyle['fontStyle'];
    }
    if (obj.fontWeight !== undefined) {
        if (typeof obj.fontWeight !== 'string' || !FONT_WEIGHTS.has(obj.fontWeight)) return '"fontWeight" must be "normal" or "bold"';
        style.fontWeight = obj.fontWeight as ThemeStyle['fontWeight'];
    }
    if (obj.textDecoration !== undefined) {
        if (typeof obj.textDecoration !== 'string' || !CSS_VALUE.test(obj.textDecoration.trim())) {
            return '"textDecoration" must be a CSS text-decoration such as "underline" or "line-through"';
        }
        style.textDecoration = obj.textDecoration.trim();
    }
    if (obj.opacity !== undefined) {
        const n = typeof obj.opacity === 'string' ? Number(obj.opacity) : obj.opacity;
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) return '"opacity" must be a number between 0 and 1';
        style.opacity = n;
    }
    if (obj.borderColor !== undefined) {
        if (typeof obj.borderColor !== 'string' || !HEX_COLOR.test(obj.borderColor.trim())) {
            return `"borderColor" ${HEX_MESSAGE}, got ${JSON.stringify(obj.borderColor)}`;
        }
        style.borderColor = obj.borderColor.trim();
    }
    if (obj.borderStyle !== undefined) {
        if (typeof obj.borderStyle !== 'string' || !BORDER_STYLES.has(obj.borderStyle)) {
            return '"borderStyle" must be "solid", "dashed", "dotted" or "double"';
        }
        style.borderStyle = obj.borderStyle as ThemeStyle['borderStyle'];
    }
    for (const key of ['borderWidth', 'borderRadius'] as const) {
        if (obj[key] === undefined) continue;
        const value = typeof obj[key] === 'number' ? `${obj[key]}px` : obj[key];
        if (typeof value !== 'string' || !CSS_LENGTH.test(value.trim())) {
            return `"${key}" must be a length such as "1px" or "0.2em"`;
        }
        style[key] = value.trim();
    }
    return style;
}

/** Merges configurations; later ones override earlier ones for the same name or group. */
export function mergeColorConfigs(...configs: ColorConfig[]): ColorConfig {
    const styles = new Map<string, IdentifierStyle>();
    const wildcardsByPattern = new Map<string, WildcardStyle>();
    const groups = new Map<GroupName, IdentifierStyle>();
    const errors: string[] = [];
    for (const config of configs) {
        config.styles.forEach((style, name) => styles.set(name, style));
        for (const w of config.wildcards) {
            wildcardsByPattern.delete(w.pattern);
            wildcardsByPattern.set(w.pattern, w);
        }
        config.groups.forEach((style, name) => groups.set(name, style));
        errors.push(...config.errors);
    }
    return { styles, wildcards: [...wildcardsByPattern.values()], groups, errors };
}

/** A stable key for a style, so equal styles share one decoration type. */
export function styleKey(style: IdentifierStyle): string {
    const part = (s: ThemeStyle | undefined) =>
        s ? THEME_KEYS.map(k => (typeof s[k] === 'string' ? (s[k] as string).toLowerCase() : s[k] ?? '')).join('|') : '';
    return [part(style), part(style.light), part(style.dark)].join('||');
}

const WORD = /\b[a-z_][a-z0-9_]*/gi;
const D_DT = /^\s*d([a-z_][a-z0-9_]*)\/dt/i;

/**
 * Finds every whole-word occurrence of the given (lower-cased) names in the code part of the
 * file: comments and text after "done" are skipped, and "dx/dt" counts as an occurrence of "x".
 * Returns the ranges grouped by name.
 */
export function findIdentifierRanges(lines: string[], names: Set<string>): Map<string, ColoredRange[]> {
    const result = new Map<string, ColoredRange[]>();
    if (names.size === 0) return result;
    const add = (name: string, line: number, start: number, end: number) => {
        const list = result.get(name) ?? [];
        list.push({ line, start, end });
        result.set(name, list);
    };
    codeLines(lines).forEach((rawLine, lineIndex) => {
        const code = codePart(rawLine);
        if (!code.trim()) return;
        const derivative = D_DT.exec(code);
        if (derivative) {
            const name = derivative[1].toLowerCase();
            const start = derivative[0].indexOf(derivative[1]);
            if (names.has(name)) add(name, lineIndex, start, start + name.length);
        }
        WORD.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = WORD.exec(code)) !== null) {
            const name = match[0].toLowerCase();
            const isDerivativeWord = derivative !== null && match.index === derivative[0].search(/\S/);
            if (names.has(name) && !isDerivativeWord) {
                add(name, lineIndex, match.index, match.index + name.length);
            }
        }
    });
    return result;
}

export interface StyledRanges {
    key: string;
    style: IdentifierStyle;
    ranges: ColoredRange[];
}

/** Every distinct lower-cased word in the code part of the file. */
function allWords(lines: string[]): Set<string> {
    const words = new Set<string>();
    for (const rawLine of codeLines(lines)) {
        const code = codePart(rawLine);
        WORD.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = WORD.exec(code)) !== null) words.add(match[0].toLowerCase());
    }
    return words;
}

/**
 * Everything to decorate in a file, grouped by style. Precedence, most specific first:
 * a name with its own entry (which also covers the members "u0", "u1", ... of an array "u"),
 * then "*" wildcards (the last matching one wins), then "@group" entries resolved through the
 * parser. Option names on "@" lines belong to "@options" when it is styled.
 */
export function collectStyledRanges(text: string, config: ColorConfig): StyledRanges[] {
    const byKey = new Map<string, StyledRanges>();
    const add = (style: IdentifierStyle, ranges: ColoredRange[]) => {
        if (ranges.length === 0) return;
        const key = styleKey(style);
        const entry = byKey.get(key) ?? { key, style, ranges: [] };
        entry.ranges.push(...ranges);
        byKey.set(key, entry);
    };
    if (config.styles.size === 0 && config.wildcards.length === 0 && config.groups.size === 0) return [];

    const lines = text.split(/\r?\n/);
    const model = parseXpp(text);

    // Array families: base "u" (kind 'array') followed by its members "u0", "u1", ...
    const membersByBase = new Map<string, string[]>();
    const groupOfBase = new Map<string, GroupName | undefined>();
    for (const decl of model.declarations) {
        if (!decl.fromArray) continue;
        if (decl.kind === 'array') {
            membersByBase.set(decl.nameLower, []);
            continue;
        }
        const base = /^(.+?)\d+$/.exec(decl.nameLower)?.[1];
        if (base !== undefined && membersByBase.has(base)) {
            membersByBase.get(base)!.push(decl.nameLower);
            if (!groupOfBase.has(base)) groupOfBase.set(base, GROUP_OF_KIND[decl.kind]);
        }
    }

    // Name -> style, from explicit entries (plus array members) and wildcards
    const resolved = new Map<string, IdentifierStyle>(config.styles);
    config.styles.forEach((style, name) => {
        for (const member of membersByBase.get(name) ?? []) {
            if (!resolved.has(member)) resolved.set(member, style);
        }
    });
    if (config.wildcards.length > 0) {
        for (const word of allWords(lines)) {
            if (resolved.has(word)) continue;
            for (let i = config.wildcards.length - 1; i >= 0; i--) {
                if (config.wildcards[i].regex.test(word)) {
                    resolved.set(word, config.wildcards[i].style);
                    break;
                }
            }
        }
    }
    const explicit = findIdentifierRanges(lines, new Set(resolved.keys()));
    resolved.forEach((style, name) => add(style, explicit.get(name) ?? []));
    if (config.groups.size === 0) return [...byKey.values()];

    const optionStyle = config.groups.get('@options');
    const optionSpans = new Set(model.options.map(o => `${o.line}:${o.start}`));

    // Names per group, from the declarations and the builtin list
    const namesByGroup = new Map<GroupName, Set<string>>();
    const addName = (group: GroupName | undefined, name: string) => {
        if (!group || !config.groups.has(group) || resolved.has(name)) return;
        const set = namesByGroup.get(group) ?? new Set<string>();
        set.add(name);
        namesByGroup.set(group, set);
    };
    for (const decl of model.declarations) {
        addName(decl.kind === 'array' ? groupOfBase.get(decl.nameLower) : GROUP_OF_KIND[decl.kind], decl.nameLower);
    }
    if (config.groups.has('@builtins')) BUILTIN_NAMES.forEach(name => addName('@builtins', name));

    const allGroupNames = new Set<string>();
    namesByGroup.forEach(names => names.forEach(n => allGroupNames.add(n)));
    const groupRanges = findIdentifierRanges(lines, allGroupNames);
    namesByGroup.forEach((names, group) => {
        const ranges: ColoredRange[] = [];
        names.forEach(name => {
            for (const r of groupRanges.get(name) ?? []) {
                if (optionStyle && optionSpans.has(`${r.line}:${r.start}`)) continue;
                ranges.push(r);
            }
        });
        add(config.groups.get(group)!, ranges);
    });

    if (optionStyle) {
        add(optionStyle, model.options
            .filter(o => !resolved.has(o.nameLower))
            .map(o => ({ line: o.line, start: o.start, end: o.end })));
    }
    const keywordStyle = config.groups.get('@keywords');
    if (keywordStyle) {
        const ranges: ColoredRange[] = [];
        for (const info of model.lineInfos) {
            if (info.keyword && info.kind !== 'ignored') {
                ranges.push({ line: info.line, start: info.keyword.start, end: info.keyword.end });
            }
            if (info.kind === 'done') {
                const m = /^(\s*)(#?[a-z0-9_]+)/i.exec(lines[info.line]);
                if (m) ranges.push({ line: info.line, start: m[1].length, end: m[1].length + m[2].length });
            }
        }
        add(keywordStyle, ranges.filter(r => !resolved.has(lines[r.line].substring(r.start, r.end).toLowerCase())));
    }
    return [...byKey.values()];
}
