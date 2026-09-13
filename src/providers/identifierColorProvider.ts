import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isXppDocument } from '../utils/constants';
import {
    ColorConfig, IdentifierStyle, ThemeStyle, collectStyledRanges, mergeColorConfigs, parseColorConfig,
} from '../utils/identifierColorsCore';

export const COLORS_FILE_NAME = '.xppcolors.json';
const SETTING_KEY = 'xpp-ode.identifierColors';
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Paints user-chosen colours on identifiers in every visible XPP editor.
 * Colours come from the "xpp-ode.identifierColors" setting (user or workspace) and from
 * ".xppcolors.json" files: every such file between the workspace root and the document's folder
 * applies, the closest one winning, so one file can colour a whole project folder.
 */
export class IdentifierColorProvider implements vscode.Disposable {
    private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    private pending = new Map<string, NodeJS.Timeout>();
    private reportedErrors = new Set<string>();
    private disposables: vscode.Disposable[] = [];

    constructor() {
        const watcher = vscode.workspace.createFileSystemWatcher(`**/${COLORS_FILE_NAME}`);
        this.disposables.push(
            watcher,
            watcher.onDidChange(() => this.resetAndRefresh()),
            watcher.onDidCreate(() => this.resetAndRefresh()),
            watcher.onDidDelete(() => this.resetAndRefresh()),
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration(SETTING_KEY)) this.resetAndRefresh();
            }),
            vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAll()),
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (isXppDocument(event.document)) this.scheduleRefresh(event.document);
            })
        );
        this.refreshAll();
    }

    /** Re-decorates every visible XPP editor. */
    public refreshAll(): void {
        vscode.window.visibleTextEditors
            .filter((editor) => isXppDocument(editor.document))
            .forEach((editor) => this.refreshEditor(editor));
    }

    private scheduleRefresh(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const existing = this.pending.get(key);
        if (existing) clearTimeout(existing);
        const delay = vscode.workspace.getConfiguration('xpp-ode', document).get<number>('debounceDelay', DEFAULT_DEBOUNCE_MS);
        this.pending.set(key, setTimeout(() => {
            this.pending.delete(key);
            vscode.window.visibleTextEditors
                .filter((editor) => editor.document.uri.toString() === key)
                .forEach((editor) => this.refreshEditor(editor));
        }, delay));
    }

    private resetAndRefresh(): void {
        this.decorationTypes.forEach((type) => type.dispose());
        this.decorationTypes.clear();
        this.reportedErrors.clear();
        this.refreshAll();
    }

    private refreshEditor(editor: vscode.TextEditor): void {
        const config = this.loadConfig(editor.document);
        this.reportErrors(config.errors);

        const rangesByStyle = new Map<string, vscode.Range[]>();
        for (const entry of collectStyledRanges(editor.document.getText(), config)) {
            rangesByStyle.set(entry.key, entry.ranges.map(r => new vscode.Range(r.line, r.start, r.line, r.end)));
            if (!this.decorationTypes.has(entry.key)) {
                this.decorationTypes.set(entry.key, IdentifierColorProvider.createDecorationType(entry.style));
            }
        }

        // Clear styles this editor no longer uses, then apply the current ones.
        this.decorationTypes.forEach((type, key) => {
            editor.setDecorations(type, rangesByStyle.get(key) ?? []);
        });
    }

    private static createDecorationType(style: IdentifierStyle): vscode.TextEditorDecorationType {
        const render = (s: ThemeStyle | undefined): vscode.ThemableDecorationRenderOptions | undefined =>
            s && {
                color: s.color,
                backgroundColor: s.backgroundColor,
                fontStyle: s.fontStyle,
                fontWeight: s.fontWeight,
                textDecoration: s.textDecoration,
                opacity: s.opacity === undefined ? undefined : String(s.opacity),
                borderColor: s.borderColor,
                // A colour alone should show a box, so fill in the width and style.
                borderStyle: s.borderStyle ?? (s.borderColor ? 'solid' : undefined),
                borderWidth: s.borderWidth ?? (s.borderColor ? '1px' : undefined),
                borderRadius: s.borderRadius,
            };
        return vscode.window.createTextEditorDecorationType({
            ...render(style),
            light: render(style.light),
            dark: render(style.dark),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });
    }

    /** Settings first, then every colours file from the workspace root down to the document folder. */
    private loadConfig(document: vscode.TextDocument): ColorConfig {
        const raw = vscode.workspace.getConfiguration('xpp-ode', document).get<unknown>('identifierColors');
        const configs = [parseColorConfig(raw, `setting "${SETTING_KEY}"`)];
        if (document.uri.scheme === 'file') {
            for (const file of IdentifierColorProvider.colorFilesFor(document)) {
                configs.push(IdentifierColorProvider.readColorsFile(file));
            }
        }
        return mergeColorConfigs(...configs);
    }

    /** Colour files that apply to this document, outermost first. */
    private static colorFilesFor(document: vscode.TextDocument): string[] {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
        const files: string[] = [];
        let dir = path.dirname(document.uri.fsPath);
        for (let depth = 0; depth < 32; depth++) {
            const candidate = path.join(dir, COLORS_FILE_NAME);
            if (fs.existsSync(candidate)) files.push(candidate);
            // Outside a workspace folder only the document's own folder is consulted.
            if (!workspaceRoot || path.relative(workspaceRoot, dir) === '') break;
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        return files.reverse();
    }

    private static readColorsFile(file: string): ColorConfig {
        try {
            return parseColorConfig(JSON.parse(fs.readFileSync(file, 'utf8')), file);
        } catch (error) {
            return { styles: new Map(), wildcards: [], groups: new Map(), errors: [`${file}: ${(error as Error).message}`] };
        }
    }

    private reportErrors(errors: string[]): void {
        for (const error of errors) {
            if (this.reportedErrors.has(error)) continue;
            this.reportedErrors.add(error);
            vscode.window.showWarningMessage(`XPP identifier colours: ${error}`);
        }
    }

    public dispose(): void {
        this.pending.forEach((timer) => clearTimeout(timer));
        this.pending.clear();
        this.decorationTypes.forEach((type) => type.dispose());
        this.decorationTypes.clear();
        this.disposables.forEach((d) => d.dispose());
    }
}
