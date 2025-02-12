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
        const text = document.getText();
        const lines = text.split('\n').map(line => line.trim());
        const fileName = document.fileName;
        const isOdeFile = fileName.endsWith('.ode');
        const isIncFile = fileName.endsWith('.inc');
        const directive = isOdeFile ? 'done' : '#done';
        const errorMessage = isOdeFile ? 'Missing "done" at the end of the .ode file' : 'Missing "#done" at the end of the .inc file';

        if (isOdeFile || isIncFile) {
            const lastNonEmptyLine = lines.reverse().find(line => line !== '' && !(line.startsWith('#') && line !== directive));
            if (lastNonEmptyLine !== directive) {
                const range = new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, lastNonEmptyLine?.length || 0);
                diagnostics.push(new vscode.Diagnostic(range, errorMessage, vscode.DiagnosticSeverity.Error));
            }
        }

        return diagnostics;
    }
    
    public dispose() {
        this.diagnosticCollection.dispose();
    }
}
