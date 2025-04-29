import * as vscode from 'vscode';
import { checkVariablesAndParameters } from '../utils/variableCheckerCore';

export class VariableChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const results = checkVariablesAndParameters(text);
        results.forEach(res => {
            // Ensure character positions are non-negative before creating Range
            const startChar = Math.max(0, res.start);
            const endChar = Math.max(startChar, res.end);
            const line = Math.max(0, res.line);
            
            const range = new vscode.Range(line, startChar, line, endChar);
            diagnostics.push(new vscode.Diagnostic(range, res.message, vscode.DiagnosticSeverity.Error));
        });
        return diagnostics;
    }
}
