import * as vscode from 'vscode';
import { reservedWords } from '../utils/constants';

export class VariableChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const variableNames: Set<string> = new Set();

        // Collect variable names and check for reserved words
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const match = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b(?=\s*=)/);
            if (match) {
                const variable = match[0];
                if (reservedWords.has(variable)) {
                    const range = new vscode.Range(i, match.index || 0, i, (match.index || 0) + variable.length);
                    const diagnostic = new vscode.Diagnostic(range, `Reserved word used as variable name: ${variable}`, vscode.DiagnosticSeverity.Error);
                    diagnostics.push(diagnostic);
                } else {
                    variableNames.add(variable);
                }
            }
        }

        // Highlight variables and function parameters
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            variableNames.forEach(variable => {
                const regex = new RegExp(`\\b${variable}\\b`, 'gi');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    const range = new vscode.Range(i, match.index, i, match.index + variable.length);
                    const diagnostic = new vscode.Diagnostic(range, `Variable: ${variable}`, vscode.DiagnosticSeverity.Information);
                    diagnostics.push(diagnostic);
                }
            });

            const paramMatch = line.match(/\(([^)]+)\)/);
            if (paramMatch) {
                const params = paramMatch[1].split(/\s*,\s*/);
                params.forEach(param => {
                    const regex = new RegExp(`\\b${param}\\b`, 'gi');
                    let match;
                    while ((match = regex.exec(line)) !== null) {
                        const range = new vscode.Range(i, match.index, i, match.index + param.length);
                        const diagnostic = new vscode.Diagnostic(range, `Parameter: ${param}`, vscode.DiagnosticSeverity.Information);
                        diagnostics.push(diagnostic);
                    }
                });
            }
        }

        return diagnostics;
    }
}
