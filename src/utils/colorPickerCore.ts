/**
 * Locates hex colour strings in the JSON files that configure identifier colours, so that
 * VS Code can show colour swatches and the colour picker on them.
 */

export interface HexColorMatch {
    line: number;
    start: number;
    end: number;
    /** Components in 0..1. */
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

const HEX_STRING = /"(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))"/gi;

/** Parses "#rgb", "#rgba", "#rrggbb" or "#rrggbbaa" into 0..1 components. */
export function hexToRgba(hex: string): { red: number; green: number; blue: number; alpha: number } {
    let digits = hex.slice(1);
    if (digits.length <= 4) digits = digits.split('').map(d => d + d).join('');
    const n = (i: number) => parseInt(digits.substring(i, i + 2), 16) / 255;
    return { red: n(0), green: n(2), blue: n(4), alpha: digits.length === 8 ? n(6) : 1 };
}

/** Formats 0..1 components as "#rrggbb", adding "aa" only when alpha is not 1. */
export function rgbaToHex(red: number, green: number, blue: number, alpha: number): string {
    const h = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${h(red)}${h(green)}${h(blue)}${alpha < 1 ? h(alpha) : ''}`;
}

/**
 * Finds every hex colour string in `text`. When `onlyUnderKey` is given (e.g. "xpp-ode.identifierColors"),
 * only strings inside the JSON object that follows that key are returned, so that a settings.json
 * only gets swatches in the extension's own section.
 */
export function findHexColors(text: string, onlyUnderKey?: string): HexColorMatch[] {
    const region = onlyUnderKey ? objectRegionAfterKey(text, onlyUnderKey) : { start: 0, end: text.length };
    if (!region) return [];
    const results: HexColorMatch[] = [];
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
    const toLine = (offset: number) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
        }
        return lo;
    };
    HEX_STRING.lastIndex = region.start;
    let match: RegExpExecArray | null;
    while ((match = HEX_STRING.exec(text)) !== null && match.index < region.end) {
        const startOffset = match.index + 1;
        const line = toLine(startOffset);
        const col = startOffset - lineStarts[line];
        results.push({ line, start: col, end: col + match[1].length, ...hexToRgba(match[1]) });
    }
    return results;
}

/** Offsets of the `{ ... }` object that follows `"key":`, or undefined when absent. */
function objectRegionAfterKey(text: string, key: string): { start: number; end: number } | undefined {
    const keyIndex = text.indexOf(`"${key}"`);
    if (keyIndex === -1) return undefined;
    const open = text.indexOf('{', keyIndex + key.length + 2);
    if (open === -1) return undefined;
    let depth = 0;
    let inString = false;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (ch === '\\') i++;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return { start: open, end: i };
    }
    return { start: open, end: text.length };
}
