import * as vscode from 'vscode';
import { parseXpp } from '../utils/xppModel';
import { checkSemantics } from '../utils/semanticCheckerCore';

/** Offers the sure fix a semantic finding carries, e.g. "!d=y" -> "d=y". */
export class SemanticQuickFixProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    public provideCodeActions(
        document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const candidates = context.diagnostics.filter(d => d.source === 'xpp');
        if (candidates.length === 0) return [];
        // The fixes do not depend on names from #include'd files, so the file alone is enough.
        const results = checkSemantics(parseXpp(document.getText()), new Set(), true).filter(r => r.fix);
        return candidates.flatMap(diagnostic => {
            const result = results.find(r => r.type === diagnostic.code &&
                diagnostic.range.isEqual(new vscode.Range(r.line, r.start, r.line, r.end)));
            if (!result?.fix) return [];
            const { title, line, start, end, text } = result.fix;
            const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, new vscode.Range(line, start, line, end), text);
            return [action];
        });
    }
}
