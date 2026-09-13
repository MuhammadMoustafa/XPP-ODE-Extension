import * as vscode from 'vscode';
import { isReservedWord } from '../utils/renameCore';
import { ProviderCore } from '../utils/providerCore';

export class XppRenameProvider implements vscode.RenameProvider {
    async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | null> {

        if (token.isCancellationRequested) return null;

        const detection = ProviderCore.detectVariableAtPosition(document, position);
        if (!detection) {
            return null;
        }

        if (isReservedWord(detection.variableName)) {
            throw new Error(`'${detection.variableName}' is a reserved word in XPP and cannot be renamed.`);
        }

        return {
            range: detection.variableRange,
            placeholder: detection.variableName
        };
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | null> {

        if (token.isCancellationRequested) return null;

        const detection = ProviderCore.detectVariableAtPosition(document, position);
        if (!detection) {
            return null;
        }

        if (isReservedWord(detection.variableName)) {
            throw new Error(`'${detection.variableName}' is a reserved word in XPP and cannot be renamed.`);
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
            throw new Error(`'${newName}' is not a valid XPP identifier.`);
        }
        if (isReservedWord(newName)) {
            throw new Error(`'${newName}' is a reserved word in XPP and cannot be used as a variable name.`);
        }

        return ProviderCore.performRename(document, detection, newName, token);
    }
}
