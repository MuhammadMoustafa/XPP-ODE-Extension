import * as vscode from 'vscode';

export function toggleComment(document: vscode.TextDocument, edit: vscode.TextEditorEdit, selection: vscode.Selection) {
    console.log('toggleComment function called');
    const startLine = selection.start.line;
    const endLine = selection.end.line;

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;
        const trimmedText = text.trim();
        const isIncFile = document.fileName.endsWith('.inc');
        const includeRegex = /^#?\s*#include/i;
        const doneRegex = /^#?\s*#done/i;

        // Skip empty lines
        if (trimmedText.length === 0) {
            console.log('Skipping empty line');
            continue;
        }

        // Special handling for #include (all files) and #done (.inc files only)
        if (includeRegex.test(trimmedText) || (doneRegex.test(trimmedText) && isIncFile)) {
            if (trimmedText.startsWith('#')) {
                console.log('Uncommenting special directive');
                // Remove the outermost '#' while preserving the rest of the line
                const newText = text.replace(/^#\s*/, '');
                edit.replace(line.range, newText);
            } else {
                console.log('Commenting special directive');
                // Add a '#' at the beginning of the line
                edit.replace(line.range, `#${text}`);
            }
            continue;
        }

        // General commenting logic for other lines
        if (trimmedText.startsWith('#')) {
            console.log('Uncommenting line');
            // Remove the '#' and any following space
            const newText = text.replace(/^#\s?/, '');
            edit.replace(line.range, newText);
        } else {
            console.log('Commenting line');
            // Add a '# ' at the beginning of the line
            edit.replace(line.range, `# ${text}`);
        }
    }
}