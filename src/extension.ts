import * as vscode from 'vscode';
import { XppRenameProvider } from './providers/renameProvider';
import { XppDocumentHighlightProvider } from './providers/highlightProvider';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { isXppDocument, isOdeOrIncPath, XPP_LANGUAGE_ID } from './utils/constants';
import { toggleComment } from './utils/commenting';
import { handleNewFile } from './utils/fileHandler';
import { RunOdeFileProvider } from './providers/RunOdeFileProvider';
import { ExtractVariableProvider } from './providers/extractVariableProvider';
import { IdentifierColorProvider } from './providers/identifierColorProvider';
import { XppColorPickerProvider } from './providers/colorPickerProvider';
import { ColorsFileCompletionProvider } from './providers/colorsFileCompletionProvider';

const XPP_SELECTOR: vscode.DocumentSelector = { scheme: 'file', language: XPP_LANGUAGE_ID };

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
    diagnosticManager = new DiagnosticManager();

    vscode.workspace.textDocuments.filter(isXppDocument).forEach((document) => {
        diagnosticManager.checkFile(document);
    });

    context.subscriptions.push(
        diagnosticManager,
        new IdentifierColorProvider(),
        ...XppColorPickerProvider.register(),
        ColorsFileCompletionProvider.register(),
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (isXppDocument(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (isXppDocument(document)) {
                diagnosticManager.checkFile(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (isXppDocument(event.document)) {
                diagnosticManager.scheduleCheckFile(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            diagnosticManager.clear(document);
        }),
        vscode.languages.registerRenameProvider(XPP_SELECTOR, new XppRenameProvider()),
        vscode.languages.registerDocumentHighlightProvider(XPP_SELECTOR, new XppDocumentHighlightProvider()),
        vscode.workspace.onDidCreateFiles((event) => {
            event.files
                .filter((file) => isOdeOrIncPath(file.fsPath))
                .forEach((file) => {
                    vscode.workspace.openTextDocument(file).then(handleNewFile);
                });
        }),
        vscode.commands.registerTextEditorCommand('xpp.toggleComment', (editor) => {
            if (isXppDocument(editor.document)) {
                toggleComment(editor);
            }
        })
    );

    new RunOdeFileProvider(context);

    const extractVariableProvider = new ExtractVariableProvider();
    context.subscriptions.push(
        vscode.commands.registerCommand('xpp.extractVariable', () => {
            extractVariableProvider.extractVariable();
        })
    );
}
