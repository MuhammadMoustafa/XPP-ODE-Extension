import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isXppDocument } from '../utils/constants';
import {
    ColorConfig, IdentifierStyle, ThemeStyle, collectStyledRanges, configFilesFor, emptyConfig, mergeColorConfigs,
    parseConfigFile, parseSettingValues,
    LEGACY_COLORS_FILE_NAME, LEGACY_COLORS_SETTING, SETTINGS_FILE_NAME, VARIABLES_SETTING,
} from '../utils/identifierColorsCore';

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Paints user-chosen colours on identifiers in every visible XPP editor.
 * Colours come from the "xpp-ode.variables" setting (user or workspace) and from the "variables"
 * object of ".xppsettings.json" files: every such file between the workspace root and the
 * document's folder applies, the closest one winning, so one file can colour a whole project
 * folder. The deprecated "xpp-ode.identifierColors" setting and ".xppcolors.json" files still apply.
 */
export class IdentifierColorProvider implements vscode.Disposable {
    private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    private pending = new Map<string, NodeJS.Timeout>();
    private reportedErrors = new Set<string>();
    private disposables: vscode.Disposable[] = [];

    constructor() {
        const watcher = vscode.workspace.createFileSystemWatcher(`**/{${SETTINGS_FILE_NAME},${LEGACY_COLORS_FILE_NAME}}`);
        this.disposables.push(
            watcher,
            watcher.onDidChange(() => this.resetAndRefresh()),
            watcher.onDidCreate(() => this.resetAndRefresh()),
            watcher.onDidDelete(() => this.resetAndRefresh()),
            vscode.workspace.onDidChangeConfiguration((event) => {
                if ([VARIABLES_SETTING, LEGACY_COLORS_SETTING].some(key => event.affectsConfiguration(key))) {
                    this.resetAndRefresh();
                }
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
        const config = IdentifierColorProvider.loadConfig(editor.document);
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

    /** Settings first, then every configuration file from the workspace root down to the document folder. */
    public static loadConfig(document: vscode.TextDocument): ColorConfig {
        const settings = vscode.workspace.getConfiguration(undefined, document);
        const configs = [parseSettingValues(settings.get<unknown>(VARIABLES_SETTING), settings.get<unknown>(LEGACY_COLORS_SETTING))];
        if (document.uri.scheme === 'file') {
            const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            for (const file of configFilesFor(path.dirname(document.uri.fsPath), workspaceRoot, fs.existsSync)) {
                configs.push(IdentifierColorProvider.readConfigFile(file));
            }
        }
        return mergeColorConfigs(...configs);
    }

    private static readConfigFile(file: string): ColorConfig {
        try {
            return parseConfigFile(file, JSON.parse(fs.readFileSync(file, 'utf8')));
        } catch (error) {
            return { ...emptyConfig(), errors: [`${file}: ${(error as Error).message}`] };
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
