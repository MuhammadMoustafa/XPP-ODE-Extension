import * as vscode from 'vscode';

export function handleNewFile(document: vscode.TextDocument) {
    const edit = new vscode.WorkspaceEdit();
    const isOdeFile = document.fileName.endsWith('.ode');
    const isIncFile = document.fileName.endsWith('.inc');

    if (isOdeFile || isIncFile) {
        const endDirective = isOdeFile ? 'done' : '#done';
        const content = `\n\n${endDirective}`;
        edit.insert(document.uri, new vscode.Position(0, 0), content);
        vscode.workspace.applyEdit(edit).then(() => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = new vscode.Position(0, 0);
                editor.selection = new vscode.Selection(position, position);
            }
        });
    }
}
