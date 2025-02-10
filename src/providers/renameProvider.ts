import * as vscode from 'vscode';

export class XppRenameProvider implements vscode.RenameProvider {
    provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/i);
        const word = document.getText(wordRange);
        const edit = new vscode.WorkspaceEdit();

        vscode.workspace.textDocuments.forEach(doc => {
            for (let i = 0; i < doc.lineCount; i++) {
                const line = doc.lineAt(i);
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                let match;
                while ((match = regex.exec(line.text)) !== null) {
                    const range = new vscode.Range(i, match.index, i, match.index + word.length);
                    edit.replace(doc.uri, range, newName);
                }
            }
        });

        return edit;
    }
}
