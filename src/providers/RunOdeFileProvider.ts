import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { spawn, execFile } from 'child_process';
import { displayEndpoint, isWslCommand, parseCommandLine } from '../utils/commandLineCore';

const TERMINAL_NAME = 'XPPAUT';
const DEFAULT_DISPLAY = '127.0.0.1:0.0';
const X_SERVER_START_TIMEOUT_MS = 8000;

/**
 * The "Run ODE File" button. Runs `<xpp-ode.runCommand> <file>` in an integrated terminal whose
 * working directory is the file's folder, because xppaut resolves "#include", "table" and
 * "dll_lib" files relative to the directory it is started from, not to the .ode file.
 *
 * On Windows the Cygwin build of xppaut is an X11 client: it needs an X server (Xming, VcXsrv)
 * running and the DISPLAY variable pointing at it, or it exits with "Failed to open X-Display".
 * The terminal therefore gets DISPLAY set (xpp-ode.display), xpp-ode.xServer can name the
 * server to start automatically, and a warning explains the situation when nothing listens.
 */
export class RunOdeFileProvider {
    private terminal: vscode.Terminal | undefined;
    private terminalKey: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('xpp.runOdeFile', () => this.run()),
            vscode.window.onDidCloseTerminal((terminal) => {
                if (terminal === this.terminal) {
                    this.terminal = undefined;
                    this.terminalKey = undefined;
                }
            })
        );
    }

    private async run(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.ode')) {
            vscode.window.showErrorMessage('No active .ode file to run.');
            return;
        }
        if (editor.document.uri.scheme !== 'file') {
            vscode.window.showErrorMessage('Save the file to disk before running it.');
            return;
        }
        if (editor.document.isDirty && !(await editor.document.save())) {
            return;
        }

        const config = vscode.workspace.getConfiguration('xpp-ode', editor.document);
        const runCommand = config.get<string>('runCommand', 'xppaut').trim() || 'xppaut';
        const filePath = editor.document.uri.fsPath;
        const cwd = path.dirname(filePath);

        const env: Record<string, string> = {};
        if (process.platform === 'win32' && !isWslCommand(runCommand)) {
            const display = process.env.DISPLAY || config.get<string>('display', DEFAULT_DISPLAY).trim() || DEFAULT_DISPLAY;
            if (!process.env.DISPLAY) env.DISPLAY = display;
            await RunOdeFileProvider.ensureXServer(display, config.get<string>('xServer', '').trim());
        }

        try {
            // The working directory and environment are fixed at creation: one terminal per combination.
            const key = JSON.stringify([cwd, env]);
            if (!this.terminal || this.terminal.exitStatus !== undefined || this.terminalKey !== key) {
                this.terminal?.dispose();
                this.terminal = vscode.window.createTerminal({ name: TERMINAL_NAME, cwd, env });
                this.terminalKey = key;
            }
            this.terminal.show();
            this.terminal.sendText(`${runCommand} "${path.basename(filePath)}"`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error running XPP file: ${error}`);
        }
    }

    /**
     * Makes sure an X server is reachable on `display`: starts the configured one when nothing
     * listens and no such process runs, and warns when there is still no server to talk to.
     */
    private static async ensureXServer(display: string, xServerCommand: string): Promise<void> {
        const endpoint = displayEndpoint(display);
        if (!endpoint) return;
        if (await RunOdeFileProvider.isListening(endpoint)) return;

        const parsed = parseCommandLine(xServerCommand);
        if (parsed && !(await RunOdeFileProvider.isProcessRunning(path.basename(parsed.executable)))) {
            if (await RunOdeFileProvider.startXServer(parsed, xServerCommand, endpoint)) return;
        }

        const where = `${endpoint.host}:${endpoint.port} (DISPLAY=${display})`;
        const hint = parsed
            ? `"${xServerCommand}" was ${await RunOdeFileProvider.isProcessRunning(path.basename(parsed.executable)) ? 'already running but is not listening there' : 'started but did not open the display'}.`
            : 'Start Xming or VcXsrv, or set "xpp-ode.xServer" so the extension starts it for you.';
        const choice = await vscode.window.showWarningMessage(
            `No X server is listening on ${where}; xppaut will fail with "Failed to open X-Display". ${hint}`,
            'Open Settings'
        );
        if (choice === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'xpp-ode.xServer');
        }
    }

    /** Starts the server detached and waits until it listens; false when it does not come up. */
    private static async startXServer(
        parsed: { executable: string; args: string[] }, commandLine: string, endpoint: { host: string; port: number }
    ): Promise<boolean> {
        try {
            const child = spawn(parsed.executable, parsed.args, { detached: true, stdio: 'ignore', windowsHide: false });
            let failed = false;
            child.on('error', (error) => {
                failed = true;
                vscode.window.showWarningMessage(`Could not start the X server "${commandLine}": ${error.message}`);
            });
            child.unref();
            const deadline = Date.now() + X_SERVER_START_TIMEOUT_MS;
            while (Date.now() < deadline && !failed) {
                if (await RunOdeFileProvider.isListening(endpoint)) return true;
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        } catch (error) {
            vscode.window.showWarningMessage(`Could not start the X server "${commandLine}": ${error}`);
        }
        return false;
    }

    private static isListening(endpoint: { host: string; port: number }): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = net.connect({ host: endpoint.host, port: endpoint.port });
            const done = (result: boolean) => { socket.destroy(); resolve(result); };
            socket.setTimeout(1000, () => done(false));
            socket.once('connect', () => done(true));
            socket.once('error', () => done(false));
        });
    }

    private static isProcessRunning(imageName: string): Promise<boolean> {
        return new Promise((resolve) => {
            execFile('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/NH'], (error, stdout) => {
                resolve(!error && stdout.toLowerCase().includes(imageName.toLowerCase()));
            });
        });
    }
}
