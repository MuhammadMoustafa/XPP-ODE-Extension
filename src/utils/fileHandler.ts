import * as vscode from 'vscode';

/**
 * Seeds a freshly created, empty .ode/.inc file with its end directive.
 * Non-empty files (e.g. copies made in the explorer) are left untouched.
 */
export function handleNewFile(document: vscode.TextDocument) {
    const isOdeFile = document.fileName.endsWith('.ode');
    const isIncFile = document.fileName.endsWith('.inc');
    if (!isOdeFile && !isIncFile) return;
    if (document.getText().trim() !== '') return;

    const endDirective = isOdeFile ? 'done' : '#done';
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), `\n\n${endDirective}`);
    vscode.workspace.applyEdit(edit).then(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === document.uri.toString()) {
            const position = new vscode.Position(0, 0);
            editor.selection = new vscode.Selection(position, position);
        }
    });
}
