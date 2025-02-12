import * as vscode from 'vscode';
import { reservedWords } from '../utils/constants';

export class VariableChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const variableNames: Set<string> = new Set();

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();

            // Ignore commented lines
            if (line.startsWith('#')) continue;
            
            // Allow reserved words after '@ ' (with a space)
            if (/^@\s+/.test(line)) continue;

            const match = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?=\s*=)/i);
            if (match) {
                const variable = match[1].toLowerCase(); // Make check case-insensitive
                if (reservedWords.has(variable)) {
                    const range = new vscode.Range(i, match.index || 0, i, (match.index || 0) + variable.length);
                    const diagnostic = new vscode.Diagnostic(
                        range, 
                        `Reserved word used as variable name: ${variable}`, 
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                } else {
                    variableNames.add(variable);
                }
            }

            // Check for '@' without space
            if (/^@\S/.test(line)) {
                const range = new vscode.Range(i, 0, i, 1);
                diagnostics.push(new vscode.Diagnostic(
                    range, 
                    `Missing space after '@'`, 
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
        return diagnostics;
    }
}
