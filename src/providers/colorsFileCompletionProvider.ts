import * as vscode from 'vscode';
import * as path from 'path';
import { parseXpp, DeclKind } from '../utils/xppModel';
import { GROUP_NAMES } from '../utils/identifierColorsCore';
import { COLORS_FILE_NAME } from './identifierColorProvider';

const MAX_FILES = 200;

/**
 * Suggests keys while editing ".xppcolors.json": the "@group" names and every name declared
 * in the .ode/.inc files of the folder (and its subfolders), so names need not be typed from memory.
 * Value completion (style properties, enums, hex colours) comes from the JSON schema.
 */
export class ColorsFileCompletionProvider implements vscode.CompletionItemProvider {
    static register(): vscode.Disposable {
        return vscode.languages.registerCompletionItemProvider(
            { pattern: `**/${COLORS_FILE_NAME}` }, new ColorsFileCompletionProvider(), '"', '@'
        );
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        if (!isTopLevelKeyPosition(document, position)) return [];

        const already = new Set(existingKeys(document.getText()));
        const items: vscode.CompletionItem[] = [];
        for (const group of GROUP_NAMES) {
            if (already.has(group)) continue;
            const item = new vscode.CompletionItem(group, vscode.CompletionItemKind.Class);
            item.detail = 'category';
            item.sortText = `0${group}`;
            items.push(item);
        }
        for (const [name, where] of await this.declaredNames(document)) {
            if (already.has(name)) continue;
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
            item.detail = where;
            item.sortText = `1${name}`;
            items.push(item);
        }
        // Inside an open quote the quote is already there; otherwise insert a quoted key.
        const lineBefore = document.lineAt(position.line).text.substring(0, position.character);
        const inQuote = /"[^"]*$/.test(lineBefore);
        for (const item of items) {
            const label = String(item.label);
            item.insertText = inQuote ? label : `"${label}"`;
            if (inQuote) {
                const start = position.character - (lineBefore.length - lineBefore.lastIndexOf('"') - 1);
                item.range = new vscode.Range(position.line, start, position.line, position.character);
            }
        }
        return items;
    }

    /** name -> "kind in file.ode" for every declaration in the folder's XPP files. */
    private async declaredNames(document: vscode.TextDocument): Promise<Map<string, string>> {
        const names = new Map<string, string>();
        if (document.uri.scheme !== 'file') return names;
        const folder = path.dirname(document.uri.fsPath);
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '**/*.{ode,inc}'), '**/node_modules/**', MAX_FILES
        );
        for (const file of files) {
            let text: string;
            try {
                text = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8');
            } catch {
                continue;
            }
            const fileName = path.basename(file.fsPath);
            for (const decl of parseXpp(text).declarations) {
                if (decl.kind === 'array' || names.has(decl.name)) continue;
                names.set(decl.name, `${describe(decl.kind)} in ${fileName}`);
            }
        }
        return names;
    }
}

function describe(kind: DeclKind): string {
    return kind === 'state' ? 'state variable' : kind;
}

/** True when the cursor is where a top-level property name goes (brace depth 1, before a colon). */
function isTopLevelKeyPosition(document: vscode.TextDocument, position: vscode.Position): boolean {
    const before = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    let depth = 0;
    let inString = false;
    let stringStart = -1;
    for (let i = 0; i < before.length; i++) {
        const ch = before[i];
        if (inString) {
            if (ch === '\\') i++;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; stringStart = i; }
        else if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
    }
    if (depth !== 1) return false;
    // After the last "{" or "," at depth 1 there must be no ":" yet (we are before the value).
    const tail = inString ? before.substring(0, stringStart) : before;
    const lastSeparator = Math.max(tail.lastIndexOf('{'), tail.lastIndexOf(','));
    return !tail.substring(lastSeparator + 1).includes(':');
}

function existingKeys(text: string): string[] {
    const keys: string[] = [];
    const re = /^\s*"([^"]+)"\s*:/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) keys.push(m[1].toLowerCase());
    return keys;
}
