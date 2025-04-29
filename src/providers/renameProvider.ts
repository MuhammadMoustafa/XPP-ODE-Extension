import * as vscode from 'vscode';
import { 
    detectWordRangeCore, 
    findRenameOccurrences, 
    isReservedWord 
} from '../utils/renameCore';

export class XppRenameProvider implements vscode.RenameProvider {
    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | null> {
        if (token.isCancellationRequested) return null;

        try {
            const lineText = document.lineAt(position.line).text;

            // Use the core function to detect the word range
            const wordRangeInfo = detectWordRangeCore(lineText, position.character, position.line);
            if (!wordRangeInfo) return null;

            // Convert the core range to a VS Code range
            const wordRange = new vscode.Range(
                wordRangeInfo.range.start.line,
                wordRangeInfo.range.start.character,
                wordRangeInfo.range.end.line,
                wordRangeInfo.range.end.character
            );

            // Get the actual variable name to rename
            const variableToRename = wordRangeInfo.actualVariableName || document.getText(wordRange);

            // Check if the new name is a reserved word
            if (isReservedWord(newName)) {
                throw new Error(`'${newName}' is a reserved word in XPP and cannot be used as a variable name.`);
            }

            const edit = new vscode.WorkspaceEdit();
            const uris = await vscode.workspace.findFiles('**/*.{ode,inc}');
            if (token.isCancellationRequested) return null;

            for (const uri of uris) {
                if (token.isCancellationRequested) return null;

                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    this.applyRenamesInDocument(doc, variableToRename, newName, edit, position.line, position.character);
                } catch (err) {
                    console.error(`Failed to process file: ${uri.fsPath}`, err);
                }
            }

            return edit;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Rename operation failed: ${errorMessage}`);
            return null;
        }
    }

    private applyRenamesInDocument(
        doc: vscode.TextDocument,
        variableToRename: string,
        newName: string,
        edit: vscode.WorkspaceEdit,
        originLine?: number,
        originPosition?: number
    ): void {
        const lines = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);

        // Use the core function to find all occurrences to rename
        const renameResults = findRenameOccurrences(
            lines, 
            variableToRename, 
            newName, 
            doc.uri.toString() === doc.uri.toString() ? originLine : undefined,
            doc.uri.toString() === doc.uri.toString() ? originPosition : undefined
        );

        // Apply the edits to the VS Code edit object
        for (const result of renameResults) {
            edit.replace(
                doc.uri,
                new vscode.Range(
                    result.line,
                    result.start,
                    result.line,
                    result.end
                ),
                result.newText
            );
        }
    }
}
