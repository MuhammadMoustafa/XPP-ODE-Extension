import * as vscode from 'vscode';

export function toggleComment(document: vscode.TextDocument, edit: vscode.TextEditorEdit) {
    // for (let i = 0; i < document.lineCount; i++) {
    //     const line = document.lineAt(i);
    //     const text = line.text.trim();
    //     const isIncFile = document.fileName.endsWith('.inc');
    //     const includeRegex = /^#?\s*#include/i;
    //     const doneRegex = /^#?\s*#done/i;

    //     // Special handling for #include (all files) and #done (.inc files only)
    //     if (includeRegex.test(text) || (doneRegex.test(text) && isIncFile)) {
    //         if (text.startsWith('#')) {
    //             const newText = text.replace(/^#\s?/, ''); // Uncomment
    //             edit.replace(line.range, newText);
    //         } else {
    //             edit.replace(line.range, `# ${text}`); // Comment
    //         }
    //         continue;
    //     }

        // // General commenting logic for other lines
        // if (text.startsWith('#')) {
        //     edit.replace(line.range, text.replace(/^#\s?/, '')); // Uncomment
        // } else {
        //     edit.replace(line.range, `# ${line.text}`); // Comment
        // }
    // }
}
