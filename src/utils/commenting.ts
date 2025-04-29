import * as vscode from 'vscode';
import { toggleCommentCore } from './commentingCore';

export function toggleComment(args: any): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'xpp') {
        vscode.window.showInformationMessage('The current file is not an XPP file.');
        return; // Simply return for non-XPP files
    }

    const document = editor.document;
    const selection = editor.selection;

    // Record original cursor positions (start and end).
    const originalStartPos = selection.start;
    const originalEndPos = selection.end;

    // Get the range of the selected lines.
    const startLine = selection.start.line;
    const endLine = selection.isEmpty ? selection.start.line : selection.end.line;
    const range = new vscode.Range(startLine, 0, endLine + 1, 0);

    // Get the text within the range.
    const text = document.getText(range);
    const isIncFile = document.fileName.endsWith('.inc');
    const { output: newText, lineMappings } = toggleCommentCore(text, isIncFile);

    // Helper to map a cursor position to its new position after toggling comments.
    function mapCursorPosition(originalPos: vscode.Position): vscode.Position {
        const line = originalPos.line - startLine; // Adjust for the range start.
        const character = originalPos.character;

        // Find the corresponding line mapping.
        const mapping = lineMappings[line];
        if (!mapping) {
            // If no mapping is found, return the original position.
            return originalPos;
        }

        // Calculate the new character position.
        let newCharacter: number;
        if (character >= mapping.originalContentStart) {
            // If the cursor is within the content region, adjust it relative to the new content start.
            newCharacter = mapping.newContentStart + (character - mapping.originalContentStart);
        } else {
            // If the cursor is outside the content region (e.g., in leading whitespace), keep it as-is.
            newCharacter = character;
        }

        // Return the new position.
        return new vscode.Position(originalPos.line, newCharacter);
    }

    // Calculate the new cursor positions.
    const newStartPos = mapCursorPosition(originalStartPos);
    const newEndPos = mapCursorPosition(originalEndPos);

    // Apply the changes to the document.
    editor.edit(editBuilder => {
        editBuilder.replace(range, newText);
    }).then(success => {
        if (success) {
            // Update the cursor positions.
            editor.selection = new vscode.Selection(newStartPos, newEndPos);
        }
    });
}