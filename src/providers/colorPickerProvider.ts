import * as vscode from 'vscode';
import * as path from 'path';
import { findHexColors, rgbaToHex } from '../utils/colorPickerCore';
import {
    LEGACY_COLORS_FILE_NAME, LEGACY_COLORS_SETTING, SETTINGS_FILE_NAME, VARIABLES_SETTING,
} from '../utils/identifierColorsCore';

/**
 * Colour swatches and the colour picker for the hex strings in ".xppsettings.json" and
 * ".xppcolors.json" files and in the "xpp-ode.variables" (or deprecated
 * "xpp-ode.identifierColors") section of settings.json files.
 */
export class XppColorPickerProvider implements vscode.DocumentColorProvider {
    static register(): vscode.Disposable[] {
        const provider = new XppColorPickerProvider();
        return [
            vscode.languages.registerColorProvider({ pattern: `**/{${SETTINGS_FILE_NAME},${LEGACY_COLORS_FILE_NAME}}` }, provider),
            vscode.languages.registerColorProvider({ pattern: '**/settings.json' }, provider),
        ];
    }

    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        const text = document.getText();
        const fileName = path.basename(document.fileName);
        const matches = fileName === SETTINGS_FILE_NAME || fileName === LEGACY_COLORS_FILE_NAME
            ? findHexColors(text)
            : [VARIABLES_SETTING, LEGACY_COLORS_SETTING].flatMap(key => findHexColors(text, key));
        return matches.map(
            m => new vscode.ColorInformation(
                new vscode.Range(m.line, m.start, m.line, m.end),
                new vscode.Color(m.red, m.green, m.blue, m.alpha)
            )
        );
    }

    provideColorPresentations(color: vscode.Color): vscode.ColorPresentation[] {
        return [new vscode.ColorPresentation(rgbaToHex(color.red, color.green, color.blue, color.alpha))];
    }
}
