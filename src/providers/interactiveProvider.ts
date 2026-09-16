import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { LineSplitter, commandLine, serverProcess } from '../utils/serverProtocolCore';

/**
 * "Open in XPP Interactive": runs xppcore-server (the X11-free xppaut from xppautX) on the
 * active .ode file and shows its menus, plots and dialogs in a webview. The webview script
 * (media/xpp-client.js) is the same front end xppautX serves to a browser; this class only
 * relays protocol lines between the process and the webview.
 */
export class InteractiveProvider {
    private readonly sessions = new Set<Session>();

    constructor(private readonly context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('xpp.openInteractive', () => this.open()),
            { dispose: () => this.sessions.forEach((s) => s.dispose()) }
        );
    }

    private async open(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.ode')) {
            vscode.window.showErrorMessage('No active .ode file to open.');
            return;
        }
        if (editor.document.uri.scheme !== 'file') {
            vscode.window.showErrorMessage('Save the file to disk before opening it.');
            return;
        }
        if (editor.document.isDirty && !(await editor.document.save())) {
            return;
        }
        const config = vscode.workspace.getConfiguration('xpp-ode', editor.document);
        const serverCommand = config.get<string>('serverCommand', 'xppcore-server').trim();
        const filePath = editor.document.uri.fsPath;
        const proc = serverProcess(serverCommand, path.basename(filePath));
        if (!proc) {
            vscode.window.showErrorMessage('Set xpp-ode.serverCommand to the xppcore-server command.');
            return;
        }
        const session = new Session(this.context, filePath, proc, () => this.sessions.delete(session));
        this.sessions.add(session);
    }
}

class Session {
    private readonly panel: vscode.WebviewPanel;
    private readonly child: ChildProcessWithoutNullStreams;
    private readonly output: vscode.OutputChannel;
    private readonly splitter = new LineSplitter();
    /* events the webview needs again after it is hidden and restored */
    private readonly replay = new Map<string, Record<string, unknown>>();
    private disposed = false;
    private logText = '';
    private exitCode: number | undefined;
    private eventCount = 0;

    constructor(
        context: vscode.ExtensionContext,
        filePath: string,
        proc: { executable: string; args: string[] },
        private readonly onDispose: () => void
    ) {
        const media = vscode.Uri.joinPath(context.extensionUri, 'media');
        this.output = vscode.window.createOutputChannel('XPP Interactive');
        this.panel = vscode.window.createWebviewPanel('xppInteractive', `XPP: ${path.basename(filePath)}`,
            vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [media], retainContextWhenHidden: true });
        this.panel.webview.html = this.html(media);
        this.panel.onDidDispose(() => this.dispose());
        this.panel.webview.onDidReceiveMessage((msg) => {
            if (msg && msg.type === 'ready') this.replayTo();
            else if (msg && msg.type === 'log') this.output.appendLine(`webview: ${msg.text}`);
            else if (msg && msg.type === 'cmd') {
                const line = commandLine(msg.cmd);
                if (msg.cmd.cmd === 'answer') this.replay.delete('ask');
                if (line && this.exitCode === undefined && this.child.stdin.writable) this.child.stdin.write(line);
            }
        });

        this.output.appendLine(`${proc.executable} ${proc.args.join(' ')}  (in ${path.dirname(filePath)})`);
        this.child = spawn(proc.executable, proc.args, { cwd: path.dirname(filePath) });
        this.child.stdout.setEncoding('utf8');
        this.child.stdout.on('data', (chunk: string) => {
            const { events, bad } = this.splitter.push(chunk);
            bad.forEach((line) => this.output.appendLine(line));
            for (const ev of events) {
                this.eventCount++;
                if (ev.ev === 'hello' || ev.ev === 'idle' && this.eventCount < 50) {
                    this.output.appendLine(`server: ${ev.ev} (${this.eventCount} events so far)`);
                }
                this.remember(ev);
                void this.panel.webview.postMessage({ type: 'event', ev });
            }
        });
        this.child.stderr.setEncoding('utf8');
        /* xppaut reports model errors only as printed text: show it in the panel */
        this.child.stderr.on('data', (chunk: string) => {
            this.output.append(chunk);
            this.logText = (this.logText + chunk).slice(-100000);
            this.post({ ev: 'log', text: chunk });
        });
        this.child.on('error', (err) => {
            const text = `Could not start "${proc.executable}": ${err.message}. Check the xpp-ode.serverCommand setting.\n`;
            this.output.append(text);
            this.logText += text;
            this.post({ ev: 'log', text });
            this.serverGone(-1);
        });
        this.child.on('exit', (code) => this.serverGone(code ?? -1));
    }

    private remember(ev: Record<string, unknown>): void {
        const kind = ev.ev as string;
        if (kind === 'hello' || kind === 'palette' || kind === 'state' || kind === 'ask') this.replay.set(kind, ev);
        if (kind === 'idle') this.replay.delete('ask');
        if (kind === 'window' && ev.op === 'create') this.replay.set(`window:${ev.win}`, ev);
        if (kind === 'window' && ev.op === 'destroy') this.replay.delete(`window:${ev.win}`);
    }

    private post(ev: Record<string, unknown>): void {
        if (!this.disposed) void this.panel.webview.postMessage({ type: 'event', ev });
    }

    /* keep the panel open so the user can read why */
    private serverGone(code: number): void {
        if (this.disposed || this.exitCode !== undefined) return;
        this.exitCode = code;
        this.output.appendLine(`xppcore-server exited (${code})`);
        this.post({ ev: 'exit', code });
    }

    private replayTo(): void {
        if (this.logText) this.post({ ev: 'log', text: this.logText });
        this.output.appendLine(`webview ready; replaying ${this.replay.size} events`);
        const ask = this.replay.get('ask');
        for (const [key, ev] of this.replay) {
            if (key !== 'ask') void this.panel.webview.postMessage({ type: 'event', ev });
        }
        if (this.exitCode !== undefined) {
            this.post({ ev: 'exit', code: this.exitCode });
            return;
        }
        if (ask) void this.panel.webview.postMessage({ type: 'event', ev: ask });
        /* a redraw would wait behind an open prompt, which the webview now shows instead */
        else if (this.replay.size) this.child.stdin.write('{"cmd":"redraw"}\n');
    }

    private html(media: vscode.Uri): string {
        const webview = this.panel.webview;
        const script = webview.asWebviewUri(vscode.Uri.joinPath(media, 'xpp-client.js'));
        const style = webview.asWebviewUri(vscode.Uri.joinPath(media, 'xpp-client.css'));
        const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${style}">
<style>html, body { height: 100%; margin: 0; padding: 0; } #xpp { height: 100%; }</style>
</head>
<body>
<div id="xpp"></div>
<script nonce="${nonce}" src="${script}"></script>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const log = (text) => vscode.postMessage({ type: 'log', text: String(text) });
  window.addEventListener('error', (e) => log('error: ' + e.message + ' (' + e.filename + ':' + e.lineno + ')'));
  const root = document.getElementById('xpp');
  if (typeof XppClient === 'undefined') log('xpp-client.js did not load');
  const client = new XppClient(root, (cmd) => vscode.postMessage({ type: 'cmd', cmd }));
  let received = 0;
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'event') return;
    try {
      client.receive(e.data.ev);
    } catch (err) {
      log('receive ' + e.data.ev.ev + ' failed: ' + (err && err.stack || err));
    }
    if (++received === 1 || e.data.ev.ev === 'hello') {
      const s = client.surfaces.get(1);
      log('got ' + e.data.ev.ev + '; plot ' + (s ? s.canvas.width + 'x' + s.canvas.height : 'none') + ', host ' + root.clientWidth + 'x' + root.clientHeight);
    }
  });
  vscode.postMessage({ type: 'ready' });
  root.focus();
</script>
</body>
</html>`;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.child.exitCode === null) {
            this.child.stdin.end('{"cmd":"quit"}\n');
            setTimeout(() => { if (this.child.exitCode === null) this.child.kill(); }, 1000);
        }
        this.panel.dispose();
        this.output.dispose();
        this.onDispose();
    }
}
