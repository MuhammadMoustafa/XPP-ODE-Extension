import * as vscode from 'vscode';

export class XppRenameProvider implements vscode.RenameProvider {
    provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/i);
        const word = document.getText(wordRange);
        const edit = new vscode.WorkspaceEdit();

        // Identify the word type (variable, derivative, function parameter, etc.)
        const isFunctionParameter = this.isFunctionParameter(document, position, word);

        vscode.workspace.textDocuments.forEach(doc => {
            for (let i = 0; i < doc.lineCount; i++) {
                const line = doc.lineAt(i);
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                let match;
                while ((match = regex.exec(line.text)) !== null) {
                    const range = new vscode.Range(i, match.index, i, match.index + word.length);
                    
                    // If it's a function parameter, only rename it in the current function.
                    if (isFunctionParameter) {
                        // Check if the match is within the function and rename it
                        if (this.isInFunctionScope(doc, i, match.index)) {
                            edit.replace(doc.uri, range, newName);
                        }
                    } else {
                        // For variables or derivatives, rename globally unless it's shadowed by a parameter.
                        if (!this.isShadowedByParameter(doc, i, match.index, word)) {
                            edit.replace(doc.uri, range, newName);
                        }
                    }
                }
            }
        });

        return edit;
    }

    private isFunctionParameter(document: vscode.TextDocument, position: vscode.Position, word: string): boolean {
        // Check if the word at the position is a function parameter (this could be determined based on context)
        const line = document.lineAt(position.line);
        const functionRegex = new RegExp(`\\b${word}\\b`);
        return functionRegex.test(line.text);
    }

    private isInFunctionScope(doc: vscode.TextDocument, lineNumber: number, matchIndex: number): boolean {
        // A helper function to check if the current match is inside a function (simplified for this example)
        const line = doc.lineAt(lineNumber).text;
        return line.includes('(') && line.includes(')');
    }

    private isShadowedByParameter(doc: vscode.TextDocument, lineNumber: number, matchIndex: number, word: string): boolean {
        // Check if the variable is shadowed by a parameter in the current function (basic version)
        const line = doc.lineAt(lineNumber).text;
        const parameterRegex = new RegExp(`\\b${word}\\b`, 'g');
        return parameterRegex.test(line);  // if found in a function declaration line
    }
}
