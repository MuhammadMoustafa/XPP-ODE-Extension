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

        // Use shared detection logic - guaranteed consistency with highlighting
        const detection = ProviderCore.detectVariableAtPosition(document, position);
        if (!detection) {
            return null; // Fail fast - nothing to rename
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

        // Use shared detection logic - guaranteed consistency with prepareRename  
        const detection = ProviderCore.detectVariableAtPosition(document, position);
        if (!detection) {
            return null; // Fail fast - nothing to rename
        }

        // Validate new name
        if (isReservedWord(newName)) {
            throw new Error(`'${newName}' is a reserved word in XPP and cannot be used as a variable name.`);
        }

        // Perform the rename using shared logic
        return ProviderCore.performRename(document, detection, newName, token);
    }
}