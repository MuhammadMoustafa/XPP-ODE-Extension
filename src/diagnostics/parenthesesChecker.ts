import * as vscode from 'vscode';

export class ParenthesesChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const stack: { char: string, line: number, charIndex: number }[] = [];

        // Check for balanced parentheses
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '(' || char === '{' || char === '[') {
                    stack.push({ char, line: i, charIndex: j });
                } else if (char === ')' || char === '}' || char === ']') {
                    const last = stack.pop();
                    if (!last || !this.isMatchingPair(last.char, char)) {
                        const range = new vscode.Range(i, j, i, j + 1);
                        const diagnostic = new vscode.Diagnostic(range, `Unmatched closing parenthesis: ${char}`, vscode.DiagnosticSeverity.Error);
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }

        // Check for any unmatched opening parentheses left in the stack
        while (stack.length > 0) {
            const unmatched = stack.pop();
            if (unmatched) {
                const range = new vscode.Range(unmatched.line, unmatched.charIndex, unmatched.line, unmatched.charIndex + 1);
                const diagnostic = new vscode.Diagnostic(range, `Unmatched opening parenthesis: ${unmatched.char}`, vscode.DiagnosticSeverity.Error);
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    }

    private isMatchingPair(open: string, close: string): boolean {
        return (open === '(' && close === ')') || (open === '{' && close === '}') || (open === '[' && close === ']');
    }
}