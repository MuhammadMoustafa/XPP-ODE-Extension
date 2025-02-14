export function toggleCommentCore(input: string, isIncFile: boolean = false): string {
    const lines = input.split('\n');

    // Check if ALL lines are comments (ignoring empty lines and special cases like #include)
    const allLinesAreComments = lines.every(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length === 0 || // Empty lines are ignored
            trimmedText.startsWith('#') && // Line is a comment
            !trimmedText.startsWith('#include') // Ignore #include
        );
    });

    // Check if ANY line is a comment (ignoring empty lines and special cases like #include)
    const hasCommentedLine = lines.some(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length > 0 && // Ignore empty lines
            trimmedText.startsWith('#') && // Line is a comment
            !trimmedText.startsWith('#include') // Ignore #include
        );
    });

    // Check if ALL lines are valid code (ignoring empty lines)
    const allLinesAreValidCode = lines.every(line => {
        const trimmedText = line.trim();
        return (
            trimmedText.length === 0 || // Empty lines are ignored
            !trimmedText.startsWith('#') || // Line is not a comment
            trimmedText.startsWith('#include') // #include is valid code
        );
    });

    // Check if ALL lines are empty
    const allLinesAreEmpty = lines.every(line => line.trim().length === 0);

    const commentedLines = lines.map((line) => {
        const trimmedText = line.trim();

        // Handle empty lines
        if (trimmedText.length === 0) {
            if (allLinesAreEmpty) {
                return `# ${line}`; // Comment empty lines if all lines are empty
            } else if (allLinesAreComments) {
                return line; // Ignore empty lines if all lines are comments
            } else {
                return `# ${line}`; // Comment empty lines in mixed code
            }
        }

        // Handle #include as a special case
        if (trimmedText.startsWith('#include')) {
            return `# ${line}`; // Always comment #include
        }

        // Handle #done in .inc files as valid code
        if (isIncFile && trimmedText.startsWith('#done')) {
            return `# ${line}`; // Comment #done in .inc files
        }

        // Handle #done in .ode files as a comment
        if (!isIncFile && trimmedText.startsWith('#done')) {
            if (allLinesAreComments) {
                return line.replace(/^\s*#\s*/, ''); // Uncomment if all lines are comments
            } else {
                return `# ${line}`; // Comment if not all lines are comments
            }
        }

        // Handle lines with multiple # characters
        if (trimmedText.startsWith('##')) {
            return line.replace(/^\s*#/, ''); // Remove one #
        }

        // Handle lines with # and spaces (e.g., "# done")
        if (trimmedText.startsWith('# ') && !isIncFile) {
            if (allLinesAreComments) {
                return line.replace(/^\s*#\s*/, ''); // Uncomment if all lines are comments
            } else {
                return `# ${line}`; // Comment if not all lines are comments
            }
        }

        // Handle general comments
        if (trimmedText.startsWith('#')) {
            if (allLinesAreComments) {
                return line.replace(/^\s*#\s*/, ''); // Uncomment if all lines are comments
            } else if (hasCommentedLine) {
                return `# ${line}`; // Add # if any line is a comment
            } else {
                return line.replace(/^\s*#\s*/, ''); // Uncomment if no lines are comments
            }
        }

        // Handle valid code
        if (hasCommentedLine) {
            return `# ${line}`; // Add # if any line is a comment
        } else {
            return `# ${line}`; // Comment valid code
        }
    });

    return commentedLines.join('\n');
}