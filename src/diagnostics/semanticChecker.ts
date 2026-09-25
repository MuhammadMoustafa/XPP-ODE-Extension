import * as vscode from 'vscode';
import { parseXpp } from '../utils/xppModel';
import { readIncludedFiles } from '../utils/includeFiles';
import { checkSemantics, SemanticResult } from '../utils/semanticCheckerCore';

const SEVERITY: Record<SemanticResult['severity'], vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    information: vscode.DiagnosticSeverity.Information,
};

export class SemanticChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const model = parseXpp(document.getText());
        const isIncFile = document.fileName.endsWith('.inc');

        // Names declared in #include'd files count as defined. An .inc file cannot know what the
        // including .ode defines, so undefined-name checks are skipped for it.
        const externalNames = new Set<string>();
        for (const included of readIncludedFiles(document.uri.fsPath, model.includes)) {
            parseXpp(included.text).declarations.forEach(d => externalNames.add(d.nameLower));
        }

        return checkSemantics(model, externalNames, isIncFile).map(res => {
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            const diagnostic = new vscode.Diagnostic(range, res.message, SEVERITY[res.severity]);
            diagnostic.code = res.type;
            if (res.unnecessary) {
                diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            }
            return diagnostic;
        });
    }
}
