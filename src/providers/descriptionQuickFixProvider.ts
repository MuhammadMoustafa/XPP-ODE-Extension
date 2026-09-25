import * as vscode from 'vscode';
import { collectDescriptions, entryRemoval } from '../utils/descriptionsCore';
import { DESCRIPTION_OVERRIDDEN } from '../diagnostics/descriptionChecker';

/** Offers to remove a description that a later one overrides. */
export class DescriptionQuickFixProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    public provideCodeActions(
        document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const overridden = context.diagnostics.filter(d => d.code === DESCRIPTION_OVERRIDDEN);
        if (overridden.length === 0) return [];
        const { conflicts } = collectDescriptions(document.getText());
        const lines = document.getText().split(/\r?\n/);
        return overridden.flatMap(diagnostic => {
            const conflict = conflicts.find(c => diagnostic.range.isEqual(
                new vscode.Range(c.loser.line, c.loser.start, c.loser.line, c.loser.end)));
            if (!conflict) return [];
            const removal = entryRemoval(lines, conflict.loser);
            const action = new vscode.CodeAction('Remove the overridden description', vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.edit = new vscode.WorkspaceEdit();
            action.edit.delete(document.uri, new vscode.Range(
                removal.start.line, removal.start.character, removal.end.line, removal.end.character));
            return [action];
        });
    }
}
