import * as vscode from 'vscode';

export function toggleComment(document: vscode.TextDocument, edit: vscode.TextEditorEdit) {
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const includeRegex = /^(#include)/i;
        const doneRegex = /^(#done)/i;

        // Handle #include for all files
        if (includeRegex.test(line.text)) {
            const newText = line.text.replace(includeRegex, '# #include');
            edit.replace(line.range, newText);
        } else if (line.text.includes('# #include')) {
            const newText = line.text.replace('# #include', '#include');
            edit.replace(line.range, newText);
        }

        // Handle #done for .inc files only
        if (document.fileName.endsWith('.inc')) {
            if (doneRegex.test(line.text)) {
                const newText = line.text.replace(doneRegex, '# #done');
                edit.replace(line.range, newText);
            } else if (line.text.includes('# #done')) {
                const newText = line.text.replace('# #done', '#done');
                edit.replace(line.range, newText);
            }
        }

        // General commenting logic for other lines
        if (!includeRegex.test(line.text) && !doneRegex.test(line.text)) {
            if (line.text.trim().startsWith('#')) {
                const newText = line.text.replace(/^#\s?/, '');
                edit.replace(line.range, newText);
            } else {
                const newText = '# ' + line.text;
                edit.replace(line.range, newText);
            }
        }
    }
}
