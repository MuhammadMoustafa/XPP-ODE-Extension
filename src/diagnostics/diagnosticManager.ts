import * as vscode from 'vscode';
import { ParenthesesChecker } from './parenthesesChecker';
import { VariableChecker } from './variableChecker';

export class DiagnosticManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private parenthesesChecker: ParenthesesChecker;
    private variableChecker: VariableChecker;
    private debounceTimer: NodeJS.Timeout | undefined;
    private documentQueue: Set<vscode.TextDocument> = new Set();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('xpp');
        this.parenthesesChecker = new ParenthesesChecker();
        this.variableChecker = new VariableChecker();
    }

    /**
     * Schedules a file check with debouncing for better performance.
     * Use this method for responding to typing and other frequent changes.
     */
    public scheduleCheckFile(document: vscode.TextDocument): void {
        // Add document to queue
        this.documentQueue.add(document);
        
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Set new timer
        this.debounceTimer = setTimeout(() => {
            // Process all documents in queue
            this.documentQueue.forEach(doc => {
                this.processFile(doc);
            });
            // Clear queue
            this.documentQueue.clear();
        }, 300); // 300ms debounce delay
    }

    /**
     * Immediately checks a file without debouncing.
     * Use this method for one-time operations like file open/save where
     * immediate feedback is important.
     */
    public checkFile(document: vscode.TextDocument): void {
        this.processFile(document);
    }

    /**
     * Internal method that performs the actual diagnostic checks.
     * This is separated from the public methods to avoid code duplication
     * between the debounced and immediate check paths.
     */
    private processFile(document: vscode.TextDocument): void {
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
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.diagnosticCollection.dispose();
    }
}
