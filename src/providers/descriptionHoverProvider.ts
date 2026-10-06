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
        const files = [
            { file: path.basename(document.uri.fsPath), text, model },
            ...included.map(file => ({ file: path.basename(file.path), text: file.text, model: parseXpp(file.text) })),
        ];
        let owner: (typeof files)[number] | undefined;
        let info: NameInfo | undefined;
        for (const candidate of files) {
            info = describeName(candidate.model.declarations, nameLower);
            if (info) { owner = candidate; break; }
        }
        if (!info || !owner) return undefined;

        const markdown = formatDescriptionHover({
            name: word.name,
            kindLabel: info.kindLabel,
            declaredAt: { file: owner.file, line: info.line },
            memberIndex: info.memberIndex,
            files: files.map(f => ({ file: f.file, entries: collectDescriptions(f.text).byName.get(nameLower) ?? [] })),
            configDescriptions: configDescriptionsFor(nameLower, info.kind, IdentifierColorProvider.loadConfig(document), info.arrayBase, info.memberIndex),
        });
        return new vscode.Hover(Object.assign(new vscode.MarkdownString(markdown), { supportHtml: true }), word.range);
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
