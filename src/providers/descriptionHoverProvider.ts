import * as vscode from 'vscode';
import * as path from 'path';
import { isCommentLine, isInComment } from '../utils/lineUtils';
import { parseXpp } from '../utils/xppModel';
import { readIncludedFiles } from '../utils/includeFiles';
import { collectDescriptions, describeName, formatDescriptionHover, NameInfo } from '../utils/descriptionsCore';
import { configDescriptionsFor } from '../utils/identifierColorsCore';
import { IdentifierColorProvider } from './identifierColorProvider';

const WORD = /[a-zA-Z_][a-zA-Z0-9_]*/;

/**
 * Shows what a declared name is when hovering it in code: its kind, the descriptions written in
 * comments of the file and its "#include"d files, and those from the colours configuration.
 */
export class DescriptionHoverProvider implements vscode.HoverProvider {
    public provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const line = document.lineAt(position.line).text;
        if (isCommentLine(line) || isInComment(line, position.character)) return undefined;
        const word = nameAt(document, position);
        if (!word) return undefined;

        const text = document.getText();
        const nameLower = word.name.toLowerCase();
        const model = parseXpp(text);
        const included = readIncludedFiles(document.uri.fsPath, model.includes);
        const info = [model, ...included.map(file => parseXpp(file.text))]
            .map(fileModel => describeName(fileModel.declarations, nameLower))
            .find((found): found is NameInfo => found !== undefined);
        if (!info) return undefined;

        const markdown = formatDescriptionHover({
            name: word.name,
            kindLabel: info.kindLabel,
            entries: collectDescriptions(text).byName.get(nameLower) ?? [],
            includedEntries: included.map(file => ({
                file: path.basename(file.path),
                entries: collectDescriptions(file.text).byName.get(nameLower) ?? [],
            })),
            configDescriptions: configDescriptionsFor(nameLower, info.kind, IdentifierColorProvider.loadConfig(document), info.arrayBase),
        });
        return new vscode.Hover(new vscode.MarkdownString(markdown), word.range);
    }
}

/** The identifier under the cursor; in "dx/dt" that is "x". */
function nameAt(document: vscode.TextDocument, position: vscode.Position): { name: string; range: vscode.Range } | undefined {
    const range = document.getWordRangeAtPosition(position, WORD);
    if (!range) return undefined;
    const word = document.getText(range);
    const after = document.lineAt(position.line).text.substring(range.end.character);
    if (/^d./i.test(word) && /^\/dt\b/i.test(after)) {
        return { name: word.substring(1), range: range.with({ start: range.start.translate(0, 1) }) };
    }
    return { name: word, range };
}
