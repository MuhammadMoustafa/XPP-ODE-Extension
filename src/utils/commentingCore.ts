interface LineMapping {
    line: number;
    originalStart: number;
    originalEnd: number;
    newStart: number;
    newEnd: number;
    delta: number;
    // Index (relative to the line) where the “real” text begins.
    originalContentStart: number;
    newContentStart: number;
}

export interface ToggleCommentResult {
    output: string;
    lineMappings: LineMapping[];
}

export function toggleCommentCore(input: string, isIncFile: boolean = false): ToggleCommentResult {
    // Split the input into lines, preserving newline characters.
    const lines = input.split(/(?<=\n)/);

    // Precompute some booleans based on the whole set of lines.
    const allLinesAreComments = lines.every(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length === 0 ||
            (trimmedText.startsWith('#') && !trimmedText.startsWith('#include'))
        );
    });

    const hasCommentedLine = lines.some(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length > 0 &&
            trimmedText.startsWith('#') &&
            !trimmedText.startsWith('#include')
        );
    });

    const allLinesAreValidCode = lines.every(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length === 0 ||
            !trimmedText.startsWith('#') ||
            trimmedText.startsWith('#include')
        );
    });

    const allLinesAreEmpty = lines.every(line => line.trim().length === 0);

    const lineMappings: LineMapping[] = [];
    let originalOffset = 0;
    let newOffset = 0;
    
    
    // Process each line and record mapping info.
    const processedLines = lines.map((line, i) => {
        const origContentStart = line.search(/\S/) === -1 ? 0 : line.search(/\S/);
        const trimmedText = line.replace(/^\s+/, '');

        let newLine: string;

        // Handle empty lines
        if (trimmedText.length === 0) {
            if (allLinesAreEmpty) {
                newLine = `# ${line}`;
            } else if (allLinesAreComments) {
                newLine = line;
            } else {
                newLine = `# ${line}`;
            }
        }
        // Handle #include as a special case
        else if (trimmedText.startsWith('#include')) {
            newLine = `# ${line}`;
        }
        // Handle #done in .inc files as valid code
        else if (isIncFile && trimmedText.startsWith('#done')) {
            newLine = `# ${line}`;
        }
        // Handle #done in non-.inc files as a comment
        else if (!isIncFile && trimmedText.startsWith('#done')) {
            if (allLinesAreComments) {
                newLine = line.replace(/^\s*#\s*/, '');
            } else {
                newLine = `# ${line}`;
            }
        }
        // Handle lines with multiple # characters
        else if (trimmedText.startsWith('##')) {
            newLine = line.replace(/^\s*#/, '');
        }
        // Handle lines with "# " (e.g., "# done") when not in .inc files
        else if (trimmedText.startsWith('# ')) {
            if (allLinesAreComments) {
                newLine = trimmedText === '# ' ? "\n" : line.replace(/^\s*# /, '');
            } else {
                newLine = `# ${line}`;
            }
        }
        // Handle general comments
        else if (trimmedText.startsWith('#')) {
            if (allLinesAreComments) {
                newLine = trimmedText === '#' ? "\n" : line.replace(/^\s*#/, '');
            } else if (hasCommentedLine) {
                newLine = `# ${line}`;
            } else {
                newLine = line.replace(/^\s*#/, '');
            }
        }
        // Handle valid code
        else {
            // In both cases below the logic is the same, but you might change it later.
            if (hasCommentedLine) {
                newLine = `# ${line}`;
            } else {
                newLine = `# ${line}`;
            }
        }

        // Compute content start in the new line.
        const newContentStart = newLine.search(/\S/) === -1 ? 0 : newLine.search(/\S/);

        const originalLength = line.length;
        const newLength = newLine.length;
        const mapping: LineMapping = {
            line: i,
            originalStart: originalOffset,
            originalEnd: originalOffset + originalLength,
            newStart: newOffset,
            newEnd: newOffset + newLength,
            delta: newLength - originalLength,
            originalContentStart: origContentStart,
            newContentStart: newContentStart
        };
        lineMappings.push(mapping);
        originalOffset += originalLength;
        newOffset += newLength;
        return newLine;
    });

    return { output: processedLines.join(''), lineMappings };

}
