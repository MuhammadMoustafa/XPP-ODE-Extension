import * as vscode from 'vscode';
import { checkParentheses } from '../utils/parenthesesCheckerCore';
import { parseXpp } from '../utils/xppModel';

export class ParenthesesChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const lines = document.getText().split(/\r?\n/);
        const markovRows = new Set(parseXpp(document.getText()).lineInfos
            .filter(info => info.kind === 'markov-row').map(info => info.line));
        return checkParentheses(lines, markovRows).map(res => {
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            return new vscode.Diagnostic(range, res.message, vscode.DiagnosticSeverity.Error);
        });
    }
}
