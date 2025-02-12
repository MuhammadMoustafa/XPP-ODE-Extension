import * as vscode from 'vscode';
import { toggleCommentCore } from './commentingCore';

export function toggleComment(document: vscode.TextDocument, edit: vscode.TextEditorEdit, selection: vscode.Selection) {
    const startLine = selection.start.line;
    const endLine = selection.end.line;
    const isIncFile = document.fileName.endsWith('.inc');

    // Get the selected text
    const selectedText = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));

    // Toggle comments using the core function
    const commentedText = toggleCommentCore(selectedText, isIncFile);

    // Replace the selected text with the commented text
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    edit.replace(range, commentedText);
}
