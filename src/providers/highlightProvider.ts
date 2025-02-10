import * as vscode from 'vscode';

export class XppDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
    provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/i);
        if (!wordRange) return;

        const word = document.getText(wordRange);
        const highlights: vscode.DocumentHighlight[] = [];

        let isFunctionParameter = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;

            // Check if this line defines a function
            const functionMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/);
            if (functionMatch) {
                const params = functionMatch[2].split(/\s*,\s*/).map(p => p.trim());

                if (params.includes(word)) {
                    isFunctionParameter = true;
                }
            }

            // If it's a function parameter, highlight only in the same line
            if (isFunctionParameter && !text.includes(`(${word}`)) {
                continue;
            }

            // Highlight occurrences
            const regex = new RegExp(`\\b${word}\\b`, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const range = new vscode.Range(i, match.index, i, match.index + word.length);
                highlights.push(new vscode.DocumentHighlight(range));
            }
        }

        return highlights;
    }
}
