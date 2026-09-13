import * as vscode from 'vscode';
import { checkParentheses } from '../utils/parenthesesCheckerCore';

export class ParenthesesChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const lines = document.getText().split(/\r?\n/);
        return checkParentheses(lines).map(res => {
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            return new vscode.Diagnostic(range, res.message, vscode.DiagnosticSeverity.Error);
        });
    }
}
