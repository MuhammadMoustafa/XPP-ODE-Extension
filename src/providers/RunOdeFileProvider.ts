import * as vscode from 'vscode';

export class RunOdeFileProvider {
    private statusBarItem: vscode.StatusBarItem;
    private terminal: vscode.Terminal | undefined;
    private terminalDisposable: vscode.Disposable | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
        this.statusBarItem.text = '$(play)';
        this.statusBarItem.tooltip = 'Run the current .ode file';
        this.statusBarItem.command = 'xpp.runOdeFile';

        this.registerCommand();
        this.updateStatusBarVisibility();

        // Add event listeners with proper disposal
        const visibilityDisposable = vscode.window.onDidChangeActiveTextEditor(
            () => this.updateStatusBarVisibility()
        );
        
        // Track terminal closure to clean up resources
        this.terminalDisposable = vscode.window.onDidCloseTerminal(terminal => {
            if (terminal === this.terminal) {
                this.terminal = undefined;
            }
        });
        
        // Register all disposables
        context.subscriptions.push(
            this.statusBarItem,
            visibilityDisposable,
            this.terminalDisposable
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
                
                try {
                    // Reuse existing terminal if possible
                    if (!this.terminal || this.terminal.exitStatus !== undefined) {
                        // Use a more specific terminal name that includes xppaut
                        this.terminal = vscode.window.createTerminal('XPPAUT Terminal');
                    }
                    
                    this.terminal.show();
                    
                    // Use the document's fsPath directly for better path handling
                    const filePath = editor.document.uri.fsPath;
                    this.terminal.sendText(`${runCommand} "${filePath}"`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Error running XPP file: ${error}`);
                }
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