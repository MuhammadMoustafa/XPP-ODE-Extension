import * as vscode from 'vscode';
import { findHexColors, rgbaToHex } from '../utils/colorPickerCore';
import { COLORS_FILE_NAME } from './identifierColorProvider';

const SETTING_KEY = 'xpp-ode.identifierColors';

/**
 * Colour swatches and the colour picker for the hex strings in ".xppcolors.json" files and in
 * the "xpp-ode.identifierColors" section of settings.json files.
 */
export class XppColorPickerProvider implements vscode.DocumentColorProvider {
    static register(): vscode.Disposable[] {
        const provider = new XppColorPickerProvider();
        return [
            vscode.languages.registerColorProvider({ pattern: `**/${COLORS_FILE_NAME}` }, provider),
            vscode.languages.registerColorProvider({ pattern: '**/settings.json' }, provider),
        ];
    }

    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        const isColorsFile = document.fileName.endsWith(COLORS_FILE_NAME);
        return findHexColors(document.getText(), isColorsFile ? undefined : SETTING_KEY).map(
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
