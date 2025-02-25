import * as vscode from 'vscode';
import { XppRenameProvider } from './providers/renameProvider';
import { XppDocumentHighlightProvider } from './providers/highlightProvider';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { supportedFiles } from './utils/constants';
import { toggleComment } from './utils/commenting';
import { handleNewFile } from './utils/fileHandler';
import { RunOdeFileProvider } from './providers/RunOdeFileProvider';
import { ExtractVariableProvider } from './providers/extractVariableProvider';

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
    diagnosticManager = new DiagnosticManager();

    // Check all open text documents
    vscode.workspace.textDocuments.forEach((document) => {
        if (supportedFiles(document)) {
            diagnosticManager.checkFile(document);
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (supportedFiles(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (supportedFiles(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (supportedFiles(event.document)) {
                diagnosticManager.checkFile(event.document);
            }
        }),
        vscode.languages.registerRenameProvider(
            { scheme: 'file', language: 'xpp' },
            new XppRenameProvider()
        ),
        vscode.languages.registerDocumentHighlightProvider(
            { scheme: 'file', language: 'xpp' },
            new XppDocumentHighlightProvider()
        ),
        vscode.workspace.onDidCreateFiles((event) => {
            event.files.forEach((file) => {
                vscode.workspace.openTextDocument(file).then((document) => {
                    handleNewFile(document);
                });
            });
        })
    );

    // Register comment command only for XPP files
    let disposable = vscode.commands.registerTextEditorCommand('xpp.toggleComment', (editor) => {
        if (editor.document.languageId === 'xpp') {
            toggleComment(editor);
        }
    });

    context.subscriptions.push(disposable);

    // Initialize the RunOdeFileProvider
    new RunOdeFileProvider(context);

    // Register extract variable command
    const extractVariableProvider = new ExtractVariableProvider();
    context.subscriptions.push(
        vscode.commands.registerCommand('xpp.extractVariable', () => {
            extractVariableProvider.extractVariable();
        })
    );

    // Check all open text documents again after the extension is activated
    vscode.workspace.textDocuments.forEach((document) => {
        if (supportedFiles(document)) {
            diagnosticManager.checkFile(document);
        }
    });
}

export function deactivate() {
    if (diagnosticManager) {
        diagnosticManager.dispose();
    }
}