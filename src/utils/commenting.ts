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
function mapRelativeOffset(relativeOffset: number, mappings: LineMapping[]): number {
    let remaining = relativeOffset;
    let newRelOffset = 0;
    for (const mapping of mappings) {
        const originalLineLen = mapping.originalEnd - mapping.originalStart;
        if (remaining <= originalLineLen) {
            newRelOffset = mapping.newStart + remaining;
            return newRelOffset;
        }
        remaining -= originalLineLen;
        newRelOffset = mapping.newEnd;
    }
    return newRelOffset;
}

export function toggleComment(args: any): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'xpp') {
        const document = editor.document;
        const selection = editor.selection;

        // Record original absolute offsets for both start and end of selection.
        const originalStartOffset = document.offsetAt(selection.start);
        const originalEndOffset = document.offsetAt(selection.end);

        const startLine = selection.start.line;
        const endLine = selection.isEmpty ? selection.start.line : selection.end.line;
        // Include the entire lines
        const range = new vscode.Range(startLine, 0, endLine + 1, 0);
        const rangeStartOffset = document.offsetAt(new vscode.Position(startLine, 0));

        const text = document.getText(range);
        const isIncFile = document.fileName.endsWith('.inc');
        const { output: newText, lineMappings } = toggleCommentCore(text, isIncFile);

        // Helper to map an absolute offset (within the replaced range) to a new offset.
        function mapOffset(originalAbsOffset: number): number {
            const relativeOffset = originalAbsOffset - rangeStartOffset;
            // Determine which line this falls into.
            // Since our mappings array is per line in the range:
            let mapping: LineMapping | undefined;
            for (const m of lineMappings) {
                if (relativeOffset >= (m.originalStart - rangeStartOffset) && relativeOffset <= (m.originalEnd - rangeStartOffset)) {
                    mapping = m;
                    break;
                }
            }
            if (!mapping) {
                // If not found, fallback.
                return relativeOffset;
            }
            // Compute offset relative to the start of this line.
            const lineRelative = relativeOffset - (mapping.originalStart - rangeStartOffset);
            // If the caret is within the content region, adjust relative to content.
            let newLineRelative: number;
            if (lineRelative >= mapping.originalContentStart) {
                newLineRelative = mapping.newContentStart + (lineRelative - mapping.originalContentStart);
            } else {
                newLineRelative = lineRelative;
            }
            return (mapping.newStart - rangeStartOffset) + newLineRelative;
        }

        const newRelStart = mapOffset(originalStartOffset);
        const newRelEnd = mapOffset(originalEndOffset);
        const newAbsoluteStart = rangeStartOffset + newRelStart;
        const newAbsoluteEnd = rangeStartOffset + newRelEnd;

        editor.edit(editBuilder => {
            editBuilder.replace(range, newText);
        }).then(success => {
            if (success) {
                const newStartPos = document.positionAt(newAbsoluteStart);
                const newEndPos = document.positionAt(newAbsoluteEnd);
                editor.selection = new vscode.Selection(newStartPos, newEndPos);
            }
        });
    } else {
        vscode.commands.executeCommand('default:editor.action.commentLine', args);
    }
}
