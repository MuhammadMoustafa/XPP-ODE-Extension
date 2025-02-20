import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;

/**
 * Registers the command to run the ODE file.
 * @param context The extension context.
 */
export function registerRunOdeFileCommand(context: vscode.ExtensionContext) {
    const runOdeFileCommand = vscode.commands.registerCommand('xpp.runOdeFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('.ode')) {
            const document = editor.document;
            const terminal = vscode.window.createTerminal('XPP Terminal');
            terminal.show();
            terminal.sendText(`xppaut ${document.fileName}`);
        } else {
            vscode.window.showErrorMessage('No active .ode file to run.');
        }
    });

    context.subscriptions.push(runOdeFileCommand);
}

/**
 * Creates a status bar item to run the ODE file.
 * @param context The extension context.
 */
export function createRunOdeFileStatusBarItem(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(statusBarItem);

    const updateVisibility = () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('.ode')) {
            statusBarItem.command = 'xpp.runOdeFile';
            statusBarItem.text = '$(debug-start)';
            statusBarItem.tooltip = 'Run the current .ode file';
            statusBarItem.show();
        } else {
            statusBarItem.hide();
        }
    };

    // Update visibility when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(updateVisibility, null, context.subscriptions);
    updateVisibility(); // Initial check
}