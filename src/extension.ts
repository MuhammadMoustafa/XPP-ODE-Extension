import * as vscode from 'vscode';
import { XppRenameProvider } from './providers/renameProvider';
import { XppDocumentHighlightProvider } from './providers/highlightProvider';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { supportedFiles } from './utils/constants';
import { toggleComment } from './utils/commenting';

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('XPP Extension is now active');
    
    diagnosticManager = new DiagnosticManager();

    // Check all open text documents
    vscode.workspace.textDocuments.forEach(document => {
        if (supportedFiles(document)) {
            diagnosticManager.checkFile(document);
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (supportedFiles(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidOpenTextDocument(document => {
            if (supportedFiles(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (supportedFiles(event.document)) {
                diagnosticManager.checkFile(event.document);
            }
        }),
        vscode.languages.registerRenameProvider({ scheme: 'file', language: 'xpp' }, new XppRenameProvider()),
        vscode.languages.registerDocumentHighlightProvider({ scheme: 'file', language: 'xpp' }, new XppDocumentHighlightProvider()),
        vscode.commands.registerTextEditorCommand('xpp.toggleComment', (editor, edit) => {
            toggleComment(editor.document, edit);
        })
    );

    // Check all open text documents again after the extension is activated
    vscode.workspace.textDocuments.forEach(document => {
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
