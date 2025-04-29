import * as vscode from 'vscode';
import { checkVariablesAndParameters } from '../utils/variableCheckerCore';

export class VariableChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const results = checkVariablesAndParameters(text);
        results.forEach(res => {
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            diagnostics.push(new vscode.Diagnostic(range, res.message, vscode.DiagnosticSeverity.Error));
        });
        return diagnostics;
    }
}
