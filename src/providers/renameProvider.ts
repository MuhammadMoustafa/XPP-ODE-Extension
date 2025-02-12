import * as vscode from 'vscode';

export class XppRenameProvider implements vscode.RenameProvider {
    provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string
    ): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        const edit = new vscode.WorkspaceEdit();
        const isFunctionParam = this.isFunctionParameter(document, position, word);
        let foundDeclaration = false;

        vscode.workspace.textDocuments.forEach(doc => {
            for (let i = 0; i < doc.lineCount; i++) {
                const line = doc.lineAt(i).text;
                const regex = new RegExp(`\\b${word}\\b`, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    const range = new vscode.Range(i, match.index, i, match.index + word.length);
                    
                    if (!foundDeclaration && this.isVariableDeclaration(doc, i, word)) {
                        edit.replace(doc.uri, range, newName);
                        foundDeclaration = true;
                    } else if (!this.isShadowedByParameter(doc, i, match.index, word)) {
                        if (!isFunctionParam || this.isInFunctionScope(doc, i, match.index)) {
                            edit.replace(doc.uri, range, newName);
                        }
                    }
                }
            }
        });

        return edit;
    }

    private isVariableDeclaration(document: vscode.TextDocument, lineNumber: number, word: string): boolean {
        return /^\s*\b[a-zA-Z_][a-zA-Z0-9_]*\b\s*=/.test(document.lineAt(lineNumber).text);
    }

    private isFunctionParameter(document: vscode.TextDocument, position: vscode.Position, word: string): boolean {
        const line = document.lineAt(position.line).text;
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*\bword\b[^)]*)\)/.test(line);
    }

    private isInFunctionScope(doc: vscode.TextDocument, lineNumber: number, matchIndex: number): boolean {
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)/.test(doc.lineAt(lineNumber).text);
    }

    private isShadowedByParameter(doc: vscode.TextDocument, lineNumber: number, matchIndex: number, word: string): boolean {
        return new RegExp(`\b${word}\b`).test(doc.lineAt(lineNumber).text);
    }
}
