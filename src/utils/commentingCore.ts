interface LineMapping {
    line: number;
    originalStart: number;
    originalEnd: number;
    newStart: number;
    newEnd: number;
    delta: number;
    // Index (relative to the line) where the "real" text begins.
    originalContentStart: number;
    newContentStart: number;
}

export interface ToggleCommentResult {
    output: string;
    lineMappings: LineMapping[];
}

/** Removes the comment marker (and, for `stripSpace`, one following space) but keeps the indentation. */
function uncomment(line: string, marker: RegExp): string {
    return line.replace(marker, '$1');
}

function contentStart(line: string): number {
    const index = line.search(/\S/);
    return index === -1 ? 0 : index;
}

export function toggleCommentCore(input: string, isIncFile: boolean = false): ToggleCommentResult {
    // Split the input into lines, preserving newline characters.
    const lines = input.split(/(?<=\n)/);

    const isCommentLine = (trimmedText: string) =>
        trimmedText.startsWith('#') && !trimmedText.startsWith('#include');

    const allLinesAreComments = lines.every(line => {
        const trimmedText = line.trim();
        return trimmedText.length === 0 || isCommentLine(trimmedText);
    });
    const allLinesAreEmpty = lines.every(line => line.trim().length === 0);

    const lineMappings: LineMapping[] = [];
    let originalOffset = 0;
    let newOffset = 0;

    const processedLines = lines.map((line, i) => {
        const origContentStart = contentStart(line);
        const trimmedText = line.replace(/^\s+/, '');

        let newLine: string;

        if (trimmedText.length === 0) {
            // Empty lines are left alone inside an all-comment block being uncommented
            newLine = allLinesAreComments && !allLinesAreEmpty ? line : `# ${line}`;
        } else if (trimmedText.startsWith('#include')) {
            // "#include" is code, never a comment
            newLine = `# ${line}`;
        } else if (isIncFile && trimmedText.startsWith('#done')) {
            // "#done" is code in .inc files
            newLine = `# ${line}`;
        } else if (!isIncFile && trimmedText.startsWith('#done')) {
            newLine = allLinesAreComments ? uncomment(line, /^(\s*)#\s*/) : `# ${line}`;
        } else if (trimmedText.startsWith('##')) {
            newLine = uncomment(line, /^(\s*)#/);
        } else if (trimmedText.startsWith('# ')) {
            if (allLinesAreComments) {
                newLine = trimmedText === '# ' ? '\n' : uncomment(line, /^(\s*)# /);
            } else {
                newLine = `# ${line}`;
            }
        } else if (trimmedText.startsWith('#')) {
            if (allLinesAreComments) {
                newLine = trimmedText === '#' ? '\n' : uncomment(line, /^(\s*)#/);
            } else {
                newLine = `# ${line}`;
            }
        } else {
            newLine = `# ${line}`;
        }

        const mapping: LineMapping = {
            line: i,
            originalStart: originalOffset,
            originalEnd: originalOffset + line.length,
            newStart: newOffset,
            newEnd: newOffset + newLine.length,
            delta: newLine.length - line.length,
            originalContentStart: origContentStart,
            newContentStart: contentStart(newLine)
        };
        lineMappings.push(mapping);
        originalOffset += line.length;
        newOffset += newLine.length;
        return newLine;
    });

    return { output: processedLines.join(''), lineMappings };
}
