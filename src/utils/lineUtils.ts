/**
 * Line-level helpers shared by diagnostics, rename, and highlighting.
 *
 * XPP rules encoded here:
 *  - "#" starts a comment, except inside braces where it is the convolution operator
 *    of Volterra equations, e.g. "y(t)=int{exp(-t)#x}".
 *  - Parsing stops at the "done" line (".inc" files end with "#done"); anything after it is
 *    free text and must be ignored.
 */

/** Index of the character that starts the comment on this line, or -1 if there is none. */
export function commentStart(line: string): number {
    let braceDepth = 0;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (char === '#' && braceDepth === 0) return i;
    }
    return -1;
}

/** True when `position` is inside the comment part of the line. */
export function isInComment(line: string, position: number): boolean {
    const start = commentStart(line);
    return start !== -1 && position > start;
}

/** True when the whole line is a comment (ignoring leading whitespace). */
export function isCommentLine(line: string): boolean {
    return line.trimStart().startsWith('#');
}

/** The part of the line before its comment. */
export function codePart(line: string): string {
    const start = commentStart(line);
    return start === -1 ? line : line.substring(0, start);
}

/**
 * True when this line ends the XPP file: any word starting with "d" on its own line
 * ("done", "d", even "don"; verified against xppaut 8.0), or "#done" in .inc files.
 */
export function isDoneLine(line: string): boolean {
    const trimmed = line.trim().toLowerCase();
    return /^d[a-z]*$/.test(trimmed) || trimmed === '#done';
}

/** Index of the "done" line, or the number of lines when there is none. */
export function endOfCode(lines: string[]): number {
    const index = lines.findIndex(isDoneLine);
    return index === -1 ? lines.length : index;
}

/**
 * Returns the lines XPP actually parses: the same array with every line after "done"
 * replaced by an empty string, so line numbers stay valid.
 */
export function codeLines(lines: string[]): string[] {
    const end = endOfCode(lines);
    return lines.map((line, i) => (i <= end ? line : ''));
}
