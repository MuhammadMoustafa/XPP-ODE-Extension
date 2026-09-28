import * as vscode from 'vscode';
import * as path from 'path';
import { parseXpp } from '../utils/xppModel';
import { collectDescriptions, KIND_LABELS } from '../utils/descriptionsCore';
import { GROUP_NAMES, LEGACY_COLORS_FILE_NAME, SETTINGS_FILE_NAME, VARIABLES_KEY } from '../utils/identifierColorsCore';
import { keyPathAt } from '../utils/jsonKeyPathCore';

const MAX_FILES = 200;

/**
 * Suggests keys while editing ".xppsettings.json": "variables" at the top level, and inside it the
 * "@group" names and every name declared in the .ode/.inc files of the folder (and its subfolders),
 * with the description written in their comments, so names need not be typed from memory.
 * In the deprecated ".xppcolors.json" the names are offered at the top level.
 * Value completion (style properties such as "description", enums, hex colours) comes from the JSON schema.
 */
export class SettingsFileCompletionProvider implements vscode.CompletionItemProvider {
    static register(): vscode.Disposable {
        return vscode.languages.registerCompletionItemProvider(
            { pattern: `**/{${SETTINGS_FILE_NAME},${LEGACY_COLORS_FILE_NAME}}` }, new SettingsFileCompletionProvider(), '"', '@'
        );
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const keyPath = keyPathAt(document.getText(new vscode.Range(new vscode.Position(0, 0), position)));
        if (!keyPath) return [];
        const isLegacy = path.basename(document.fileName) === LEGACY_COLORS_FILE_NAME;
        const atTopLevel = keyPath.length === 0;
        const inVariables = isLegacy ? atTopLevel : keyPath.length === 1 && keyPath[0] === VARIABLES_KEY;
        const already = new Set(existingKeys(document.getText()));
        let items: vscode.CompletionItem[];
        if (inVariables) items = await this.variableKeyItems(document, already);
        else if (atTopLevel && !already.has(VARIABLES_KEY)) items = [variablesItem()];
        else return [];

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

    /** The groups and the declared names not yet used as keys. */
    private async variableKeyItems(document: vscode.TextDocument, already: Set<string>): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];
        for (const group of GROUP_NAMES) {
            if (already.has(group)) continue;
            const item = new vscode.CompletionItem(group, vscode.CompletionItemKind.Class);
            item.detail = 'category';
            item.sortText = `0${group}`;
            items.push(item);
        }
        for (const [name, { where, description }] of await this.declaredNames(document)) {
            if (already.has(name)) continue;
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
            item.detail = where;
            item.documentation = description;
            item.sortText = `1${name}`;
            items.push(item);
        }
        return items;
    }

    /** name -> "kind in file.ode" and its comment description, for every declaration in the folder's XPP files. */
    private async declaredNames(document: vscode.TextDocument): Promise<Map<string, { where: string; description?: string }>> {
        const names = new Map<string, { where: string; description?: string }>();
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
            const descriptions = collectDescriptions(text).byName;
            for (const decl of parseXpp(text).declarations) {
                if (decl.kind === 'array' || names.has(decl.name)) continue;
                names.set(decl.name, {
                    where: `${KIND_LABELS[decl.kind]} in ${fileName}`,
                    description: descriptions.get(decl.nameLower)?.[0]?.text,
                });
            }
        }
        return names;
    }
}

function variablesItem(): vscode.CompletionItem {
    const item = new vscode.CompletionItem(VARIABLES_KEY, vscode.CompletionItemKind.Property);
    item.detail = 'colours, styles and descriptions of names, wildcards and @groups';
    return item;
}

function existingKeys(text: string): string[] {
    const keys: string[] = [];
    const re = /^\s*"([^"]+)"\s*:/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) keys.push(m[1].toLowerCase());
    return keys;
}
