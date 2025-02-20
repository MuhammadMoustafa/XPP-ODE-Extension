import * as vscode from 'vscode';

export class RunOdeFileProvider {
    private statusBarItem: vscode.StatusBarItem;
    private terminal: vscode.Terminal | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.text = '$(play)';
        this.statusBarItem.tooltip = 'Run the current .ode file';
        this.statusBarItem.command = 'xpp.runOdeFile';

        this.registerCommand();
        this.updateStatusBarVisibility();

        context.subscriptions.push(
            this.statusBarItem,
            vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBarVisibility())
        );

        // Add terminal cleanup when closed
        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(terminal => {
                if (terminal === this.terminal) {
                    this.terminal = undefined;
                }
            })
        );
    }

    private registerCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('xpp.runOdeFile', () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('.ode')) {
                    vscode.window.showErrorMessage('No active .ode file to run.');
                    return;
                }

                const config = vscode.workspace.getConfiguration('xpp-ode');
                const runCommand = config.get<string>('runCommand', 'xppaut');
                
                // Reuse existing terminal or create new one
                if (!this.terminal || this.terminal.exitStatus !== undefined) {
                    this.terminal = vscode.window.createTerminal('XPP Terminal');
                }
                
                this.terminal.show();
                this.terminal.sendText(`${runCommand} "${editor.document.fileName}"`);
            })
        );
    }

    private updateStatusBarVisibility() {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.fileName.endsWith('.ode')) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}