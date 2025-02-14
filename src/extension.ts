import * as vscode from 'vscode';
import { XppRenameProvider } from './providers/renameProvider';
import { XppDocumentHighlightProvider } from './providers/highlightProvider';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { supportedFiles } from './utils/constants';
import { toggleComment } from './utils/commenting';
import { handleNewFile } from './utils/fileHandler';

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
    
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
        // vscode.commands.registerTextEditorCommand('xpp.toggleComment', (editor, edit) => {
        //     toggleComment(editor.document, edit, editor.selection);
        // }),
        vscode.workspace.onDidCreateFiles(event => {
            event.files.forEach(file => {
                vscode.workspace.openTextDocument(file).then(document => {
                    handleNewFile(document);
                });
            });
        })
    );
        // // Override the default comment line command
        // context.subscriptions.push(
            vscode.commands.registerCommand('editor.action.commentLine', toggleComment)
        // );

            // vscode.commands.registerCommand('editor.action.commentLine', (args) => {
            //     const editor = vscode.window.activeTextEditor;
            //     if (editor && editor.document.languageId === 'xpp') {
            //         // Directly call your toggleCommentCore function
            //         const document = editor.document;
            //         const selection = editor.selection;

            //         const endLine = selection.isEmpty ? selection.start.line : selection.end.line;
            //         const range = new vscode.Range(selection.start.line, 0, endLine + 1, 0); // +1 to include the last line

            //         const text = document.getText(range);
            //         const isIncFile = document.fileName.endsWith('.inc');
            //         const {output: newText, lineMappings: lineMappings} = toggleCommentCore(text, isIncFile);
        
            //         editor.edit(editBuilder => {
            //             editBuilder.replace(range, newText);
            //         });
            //     } else {
            //         // Fall back to the default comment line behavior for other languages
            //         vscode.commands.executeCommand('default:editor.action.commentLine', args);
            //     }
            // });
        

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
