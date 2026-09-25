import * as vscode from 'vscode';
import { XppRenameProvider } from './providers/renameProvider';
import { XppDocumentHighlightProvider } from './providers/highlightProvider';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { OPERATOR_SETTINGS } from './diagnostics/operatorChecker';
import { isXppDocument, isOdeOrIncPath, XPP_LANGUAGE_ID } from './utils/constants';
import { toggleComment } from './utils/commenting';
import { handleNewFile } from './utils/fileHandler';
import { RunOdeFileProvider } from './providers/RunOdeFileProvider';
// Open in XPP Interactive (xppautX) is hidden until 0.5.0: its command, menu entry and
// xpp-ode.serverCommand setting are left out of package.json for now.
// import { InteractiveProvider } from './providers/interactiveProvider';
import { ExtractVariableProvider } from './providers/extractVariableProvider';
import { IdentifierColorProvider } from './providers/identifierColorProvider';
import { XppColorPickerProvider } from './providers/colorPickerProvider';
import { ColorsFileCompletionProvider } from './providers/colorsFileCompletionProvider';
import { OperatorHoverProvider } from './providers/operatorHoverProvider';
import { DescriptionHoverProvider } from './providers/descriptionHoverProvider';
import { DescriptionQuickFixProvider } from './providers/descriptionQuickFixProvider';

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
        vscode.languages.registerHoverProvider(XPP_SELECTOR, new OperatorHoverProvider()),
        vscode.languages.registerHoverProvider(XPP_SELECTOR, new DescriptionHoverProvider()),
        vscode.languages.registerCodeActionsProvider(XPP_SELECTOR, new DescriptionQuickFixProvider(), {
            providedCodeActionKinds: DescriptionQuickFixProvider.providedCodeActionKinds,
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (OPERATOR_SETTINGS.some((setting) => event.affectsConfiguration(setting))) {
                vscode.workspace.textDocuments.filter(isXppDocument).forEach((document) => {
                    diagnosticManager.checkFile(document);
                });
            }
        }),
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
    // new InteractiveProvider(context);

    const extractVariableProvider = new ExtractVariableProvider();
    context.subscriptions.push(
        vscode.commands.registerCommand('xpp.extractVariable', () => {
            extractVariableProvider.extractVariable();
        })
    );
}
