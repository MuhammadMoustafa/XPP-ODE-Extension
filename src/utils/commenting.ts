import * as vscode from 'vscode';
import { LineMapping, toggleCommentCore } from './commentingCore';

// export function toggleComment() {
//     const editor = vscode.window.activeTextEditor;
//     if (!editor) return;

//     const document = editor.document;
//     const selection = editor.selection;

//     // Capture cursor positions
//     const startLine = selection.start.line;
//     const startChar = selection.start.character;
//     const endLine = selection.end.line;
//     const endChar = selection.end.character;

//     // Get selected text
//     const isIncFile = document.fileName.endsWith('.inc');
//     const originalText = document.getText(
//         new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
//     );

//     // Process text with commenting function
//     const {output: commentedText, lineMappings: lineMapping} = toggleCommentCore(originalText, isIncFile);

//     // Apply the edit
//     editor.edit(editBuilder => {
//         const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
//         editBuilder.replace(range, commentedText);
//     }).then(success => {
//         if (success) {
//             const originalLines = originalText.split(/\r?\n/);
//             const newLines = commentedText.split(/\r?\n/);

//             let newStartLine = startLine;
//             let newEndLine = endLine;
//             let newStartChar = startChar;
//             let newEndChar = endChar;

//             // Check if the line count is the same to adjust characters per line
//             if (originalLines.length === newLines.length) {
//                 // Adjust start character
//                 const startLineIndexInBlock = newStartLine - startLine;
//                 if (startLineIndexInBlock < originalLines.length) {
//                     const originalLine = originalLines[startLineIndexInBlock];
//                     const newLine = newLines[startLineIndexInBlock];
//                     const delta = newLine.length - originalLine.length;
//                     newStartChar = startChar + delta;
//                 }

//                 // Adjust end character
//                 const endLineIndexInBlock = newEndLine - startLine;
//                 if (endLineIndexInBlock < originalLines.length) {
//                     const originalLine = originalLines[endLineIndexInBlock];
//                     const newLine = newLines[endLineIndexInBlock];
//                     const delta = newLine.length - originalLine.length;
//                     newEndChar = endChar + delta;
//                 }
//             } else {
//                 // Fallback to line start if line count changed
//                 newStartChar = 0;
//                 newEndChar = 0;
//             }

//             // Clamp the positions to valid values
//             const document = editor.document;
//             newStartLine = Math.min(newStartLine, document.lineCount - 1);
//             newEndLine = Math.min(newEndLine, document.lineCount - 1);

//             const newStartLineLength = document.lineAt(newStartLine).text.length;
//             newStartChar = Math.min(Math.max(newStartChar, 0), newStartLineLength);

//             const newEndLineLength = document.lineAt(newEndLine).text.length;
//             newEndChar = Math.min(Math.max(newEndChar, 0), newEndLineLength);

//             // Restore the cursor
//             editor.selection = new vscode.Selection(
//                 new vscode.Position(newStartLine, newStartChar),
//                 new vscode.Position(newEndLine, newEndChar)
//             );
//         }
//     });
// }

// export function toggleComment(args: any): void {
//     const editor = vscode.window.activeTextEditor;
//     if (editor && editor.document.languageId === 'xpp') {
//         const document = editor.document;
//         const selection = editor.selection;
//         const endLine = selection.isEmpty ? selection.start.line : selection.end.line;
//         // +1 to include the last line
//         const range = new vscode.Range(selection.start.line, 0, endLine + 1, 0);
//         const text = document.getText(range);
//         const isIncFile = document.fileName.endsWith('.inc');
//         const { output: newText, lineMappings: lineMappings } = toggleCommentCore(text, isIncFile);
        
//         editor.edit(editBuilder => {
//             editBuilder.replace(range, newText);
//         });
//     } else {
//         // Fallback to default behavior for other languages
//         vscode.commands.executeCommand('default:editor.action.commentLine', args);
//     }
// }

// Helper function: maps a relative offset (within the replaced range)
// using the per-line mappings.
// function mapRelativeOffset(relativeOffset: number, mappings: LineMapping[]): number {
//     let remaining = relativeOffset;
//     let newRelOffset = 0;
//     for (const mapping of mappings) {
//         const originalLineLen = mapping.originalEnd - mapping.originalStart;
//         if (remaining <= originalLineLen) {
//             newRelOffset = mapping.newStart + remaining;
//             return newRelOffset;
//         }
//         remaining -= originalLineLen;
//         newRelOffset = mapping.newEnd;
//     }
//     return newRelOffset;
// }

export function toggleComment(args: any): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'xpp') {
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
    } else {
        // Fallback to the default comment toggling behavior if the language is not 'xpp'.
        vscode.commands.executeCommand('default:editor.action.commentLine', args);
    }
}