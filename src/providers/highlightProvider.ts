import * as vscode from 'vscode';

export class XppDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
    provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/i);
        const word = document.getText(wordRange);
        const highlights: vscode.DocumentHighlight[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(line.text)) !== null) {
                const range = new vscode.Range(i, match.index, i, match.index + word.length);
                highlights.push(new vscode.DocumentHighlight(range));
            }
        }

        return highlights;
    }
}
