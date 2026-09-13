import * as vscode from 'vscode';
import { escapeRegExp, isInComment, isReservedWord } from '../utils/renameCore';

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

        const selectedText = document.getText(selection).trim();
        if (!selectedText) {
            vscode.window.showErrorMessage('Please select an expression to extract.');
            return;
        }

        const variable = await vscode.window.showInputBox({
            prompt: 'Enter new variable name',
            placeHolder: 'newVariable',
            validateInput: (value) => {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return 'Not a valid XPP identifier.';
                if (isReservedWord(value)) return `'${value}' is a reserved word in XPP.`;
                return null;
            }
        });

        if (!variable) return;

        // Match the expression only at token boundaries and outside comments
        const boundaryStart = /^[a-zA-Z0-9_]/.test(selectedText) ? '\\b' : '';
        const boundaryEnd = /[a-zA-Z0-9_]$/.test(selectedText) ? '\\b' : '';
        const regex = new RegExp(`${boundaryStart}${escapeRegExp(selectedText)}${boundaryEnd}`, 'g');

        const occurrences: vscode.Range[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            let match;
            while ((match = regex.exec(lineText)) !== null) {
                if (isInComment(lineText, match.index)) continue;
                occurrences.push(new vscode.Range(i, match.index, i, match.index + match[0].length));
            }
        }

        editor.edit(editBuilder => {
            const declarationPos = new vscode.Position(selection.start.line, 0);
            editBuilder.insert(declarationPos, `${variable}=${selectedText}\n`);
            occurrences.forEach(range => {
                editBuilder.replace(range, variable);
            });
        });
    }
}
