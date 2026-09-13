import * as vscode from 'vscode';
import { detectWordRangeCore, findRenameOccurrences, isInComment, isRenameScopedToFunction } from './renameCore';

/**
 * Core detection result that both highlighting and renaming use
 */
export interface ProviderDetectionResult {
    /** The variable name to work with */
    variableName: string;
    /** The range of the variable in the document */
    variableRange: vscode.Range;
    /** The line and character position for context */
    contextPosition: { line: number; character: number };
}

function documentLines(document: vscode.TextDocument): string[] {
    return Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
}

/**
 * Shared logic for both highlight and rename providers
 * This ensures consistent behavior between highlighting and renaming
 */
export class ProviderCore {

    /**
     * Detects what variable should be highlighted/renamed at the given position
     * Returns null if nothing should be detected (comments, operators, etc.)
     */
    static detectVariableAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): ProviderDetectionResult | null {

        const lineText = document.lineAt(position.line).text;

        // Fail fast: reject comments immediately
        if (isInComment(lineText, position.character)) {
            return null;
        }

        // Check for VS Code's "dt" word selection that needs redirection
        const dtRedirection = this.handleDtRedirection(document, position, lineText);
        if (dtRedirection) {
            return dtRedirection;
        }

        const wordRangeInfo = detectWordRangeCore(lineText, position.character, position.line);
        if (!wordRangeInfo) {
            return null;
        }

        const variableRange = new vscode.Range(
            wordRangeInfo.range.start.line,
            wordRangeInfo.range.start.character,
            wordRangeInfo.range.end.line,
            wordRangeInfo.range.end.character
        );

        const variableName = wordRangeInfo.actualVariableName || document.getText(variableRange);

        return {
            variableName,
            variableRange,
            contextPosition: { line: position.line, character: position.character }
        };
    }

    /**
     * Handles the special case where VS Code selects "dt" but we need to redirect to the variable
     */
    private static handleDtRedirection(
        document: vscode.TextDocument,
        position: vscode.Position,
        lineText: string
    ): ProviderDetectionResult | null {

        const wordAtPosition = document.getWordRangeAtPosition(position);
        if (!wordAtPosition) {
            return null;
        }

        const selectedWord = document.getText(wordAtPosition);
        if (selectedWord.toLowerCase() !== 'dt') {
            return null;
        }

        // Check if this "dt" is part of a derivative pattern
        const dtStart = wordAtPosition.start.character;
        const beforeDt = lineText.substring(0, dtStart);
        const derivativeMatch = /d([a-zA-Z_][a-zA-Z0-9_]*)\/$/i.exec(beforeDt);

        if (!derivativeMatch) {
            return null;
        }

        // Found derivative pattern - redirect to the variable
        const variableName = derivativeMatch[1];
        const varStart = dtStart - derivativeMatch[0].length + 1; // +1 to skip 'd'
        const varEnd = varStart + variableName.length;

        const variableRange = new vscode.Range(position.line, varStart, position.line, varEnd);

        return {
            variableName,
            variableRange,
            contextPosition: { line: position.line, character: varStart + Math.floor(variableName.length / 2) }
        };
    }

    /**
     * Finds all occurrences of a variable for highlighting
     */
    static findVariableOccurrences(
        document: vscode.TextDocument,
        detection: ProviderDetectionResult
    ): vscode.DocumentHighlight[] {

        const renameResults = findRenameOccurrences(
            documentLines(document),
            detection.variableName,
            detection.variableName, // dummy replacement, we just want positions
            detection.contextPosition.line,
            detection.contextPosition.character
        );

        return renameResults.map(result => {
            const range = new vscode.Range(result.line, result.start, result.line, result.end);
            return new vscode.DocumentHighlight(range);
        });
    }

    /**
     * Performs the actual rename operation across files.
     * A function-parameter rename stays inside the originating document; any other rename
     * is applied to every .ode/.inc file in the workspace.
     */
    static async performRename(
        document: vscode.TextDocument,
        detection: ProviderDetectionResult,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit> {

        const edit = new vscode.WorkspaceEdit();
        const originLines = documentLines(document);
        const { line: originLine, character: originCharacter } = detection.contextPosition;

        const applyResults = (uri: vscode.Uri, lines: string[], withContext: boolean) => {
            const renameResults = withContext
                ? findRenameOccurrences(lines, detection.variableName, newName, originLine, originCharacter)
                : findRenameOccurrences(lines, detection.variableName, newName);
            for (const result of renameResults) {
                const range = new vscode.Range(result.line, result.start, result.line, result.end);
                edit.replace(uri, range, result.newText);
            }
        };

        applyResults(document.uri, originLines, true);

        if (isRenameScopedToFunction(originLines, detection.variableName, originLine, originCharacter)) {
            return edit;
        }

        const uris = await vscode.workspace.findFiles('**/*.{ode,inc}', '**/node_modules/**');
        for (const uri of uris) {
            if (token.isCancellationRequested) {
                throw new Error('Rename operation cancelled');
            }
            if (uri.toString() === document.uri.toString()) continue;

            const doc = await vscode.workspace.openTextDocument(uri);
            applyResults(uri, documentLines(doc), false);
        }

        return edit;
    }
}
