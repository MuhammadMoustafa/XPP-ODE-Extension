import * as vscode from 'vscode';
import { parseXpp } from '../utils/xppModel';
import { checkOperators, OperatorFinding } from '../utils/operatorCheckerCore';

/** The findings that can carry a sure fix. */
const FIXABLE = new Set<unknown>(['unary-sign', 'unsupported-operator'] satisfies OperatorFinding[]);

/** Offers the sure fix of an operator finding, e.g. "2*-3" -> "2*(-3)" or "a&&b" -> "a&b". */
export class OperatorQuickFixProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    public provideCodeActions(
        document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const fixable = context.diagnostics.filter(d => d.source === 'xpp' && FIXABLE.has(d.code));
        if (fixable.length === 0) return [];
        const results = checkOperators(parseXpp(document.getText()));
        return fixable.flatMap(diagnostic => {
            const result = results.find(r => r.replacement !== undefined &&
                diagnostic.range.isEqual(new vscode.Range(r.line, r.start, r.line, r.end)));
            if (!result?.replacement) return [];
            const action = new vscode.CodeAction(`Write "${result.replacement}"`, vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, diagnostic.range, result.replacement);
            return [action];
        });
    }
}
