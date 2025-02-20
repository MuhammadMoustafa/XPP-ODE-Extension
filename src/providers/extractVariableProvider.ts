import * as vscode from 'vscode';

export class ExtractVariableProvider {
    public async extractVariable() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const selection = editor.selection;
        
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select an expression to extract.');
            return;
        }

        const selectedText = document.getText(selection);
        const variable = await vscode.window.showInputBox({
            prompt: 'Enter new variable name',
            placeHolder: 'newVariable'
        });

        if (!variable) return;

        // Find all occurrences of the selected text
        const occurrences: vscode.Range[] = [];
        const text = document.getText();
        const regex = new RegExp(this.escapeRegExp(selectedText), 'g');
        let match;

        while ((match = regex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            occurrences.push(new vscode.Range(startPos, endPos));
        }

        // Apply the replacements
        editor.edit(editBuilder => {
            // Add the variable declaration at the start of the selection
            const declarationPos = new vscode.Position(selection.start.line, 0);
            editBuilder.insert(declarationPos, `${variable}=${selectedText}\n`);

            // Replace all occurrences with the new variable
            occurrences.forEach(range => {
                editBuilder.replace(range, variable);
            });
        });
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
