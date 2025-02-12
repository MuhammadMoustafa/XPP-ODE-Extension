export function toggleCommentCore(input: string, isIncFile: boolean = false): string {
    const lines = input.split('\n');
    const commentedLines = lines.map((line) => {
        const trimmedText = line.trim();
        // Skip empty lines
        if (trimmedText.length === 0) {
            return line;
        }

        // Handle #include and #done as special cases
        if (trimmedText.startsWith('#include')) {
            return `# ${line}`;
        }
        else if (isIncFile && trimmedText.startsWith('#done')) {
            return `# ${line}`;
        }
        // Handle general commenting/uncommenting
        else if (trimmedText.startsWith('#')) {
            return line.replace(/^#\s?/, '');
        } else {
            return `# ${line}`;
        }
    });

    return commentedLines.join('\n');
}