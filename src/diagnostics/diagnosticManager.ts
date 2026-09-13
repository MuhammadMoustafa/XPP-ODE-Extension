import * as vscode from 'vscode';
import { ParenthesesChecker } from './parenthesesChecker';
import { VariableChecker } from './variableChecker';
import { checkEndDirective } from '../utils/endDirectiveCore';
import { SemanticChecker } from './semanticChecker';

const DEFAULT_DEBOUNCE_MS = 300;

export class DiagnosticManager implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private parenthesesChecker: ParenthesesChecker;
    private variableChecker: VariableChecker;
    private semanticChecker: SemanticChecker;
    private pendingChecks = new Map<string, NodeJS.Timeout>();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('xpp');
        this.parenthesesChecker = new ParenthesesChecker();
        this.variableChecker = new VariableChecker();
        this.semanticChecker = new SemanticChecker();
    }

    /**
     * Schedules a file check with debouncing for better performance.
     * Use this method for responding to typing and other frequent changes.
     */
    public scheduleCheckFile(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const existing = this.pendingChecks.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const delay = vscode.workspace
            .getConfiguration('xpp-ode', document)
            .get<number>('debounceDelay', DEFAULT_DEBOUNCE_MS);

        this.pendingChecks.set(key, setTimeout(() => {
            this.pendingChecks.delete(key);
            if (!document.isClosed) {
                this.processFile(document);
            }
        }, delay));
    }

    /**
     * Immediately checks a file without debouncing.
     * Use this method for one-time operations like file open/save where
     * immediate feedback is important.
     */
    public checkFile(document: vscode.TextDocument): void {
        this.processFile(document);
    }

    /** Removes the diagnostics of a document, e.g. when it is closed. */
    public clear(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const pending = this.pendingChecks.get(key);
        if (pending) {
            clearTimeout(pending);
            this.pendingChecks.delete(key);
        }
        this.diagnosticCollection.delete(document.uri);
    }

    private processFile(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [
            ...this.checkEndDirectives(document),
            ...this.parenthesesChecker.check(document),
            ...this.variableChecker.check(document),
            ...this.semanticChecker.check(document)
        ];

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkEndDirectives(document: vscode.TextDocument): vscode.Diagnostic[] {
        const isOdeFile = document.fileName.endsWith('.ode');
        const isIncFile = document.fileName.endsWith('.inc');
        if (!isOdeFile && !isIncFile) return [];

        const lines = document.getText().split(/\r?\n/);
        return checkEndDirective(lines, isIncFile).map(res => {
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            const severity = res.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
            return new vscode.Diagnostic(range, res.message, severity);
        });
    }

    public dispose() {
        this.pendingChecks.forEach(timer => clearTimeout(timer));
        this.pendingChecks.clear();
        this.diagnosticCollection.dispose();
    }
}
