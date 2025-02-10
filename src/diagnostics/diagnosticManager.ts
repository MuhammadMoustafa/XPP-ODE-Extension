import * as vscode from 'vscode';
import { ParenthesesChecker } from './parenthesesChecker';
import { VariableChecker } from './variableChecker';

export class DiagnosticManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private parenthesesChecker: ParenthesesChecker;
    private variableChecker: VariableChecker;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('xpp');
        this.parenthesesChecker = new ParenthesesChecker();
        this.variableChecker = new VariableChecker();
    }

    public checkFile(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [
            ...this.checkEndDirectives(document),
            ...this.parenthesesChecker.check(document),
            ...this.variableChecker.check(document)
        ];

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkEndDirectives(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const fileName = document.fileName;
        const text = document.getText();
        const lines = text.split('\n').map(line => line.trim());
        const lastNonEmptyLine = lines.reverse().find(line => line !== '');

        if (fileName.endsWith('.ode') && lastNonEmptyLine !== 'done') {
            const range = new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, lastNonEmptyLine?.length || 0);
            diagnostics.push(new vscode.Diagnostic(range, 'Missing done at the end of the .ode file', vscode.DiagnosticSeverity.Error));
        } else if (fileName.endsWith('.inc') && lastNonEmptyLine !== '#done') {
            const range = new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, lastNonEmptyLine?.length || 0);
            diagnostics.push(new vscode.Diagnostic(range, 'Missing #done at the end of the .inc file', vscode.DiagnosticSeverity.Error));
        }

        return diagnostics;
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}
