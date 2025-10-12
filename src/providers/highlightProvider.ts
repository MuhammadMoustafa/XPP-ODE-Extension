import * as vscode from 'vscode';
import { ProviderCore } from '../utils/providerCore';

export class XppDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
    provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        
        // Use shared detection logic - no duplication, no inconsistency
        const detection = ProviderCore.detectVariableAtPosition(document, position);
        if (!detection) {
            return undefined; // Fail fast - nothing to highlight
        }

        // Find and return all occurrences
        return ProviderCore.findVariableOccurrences(document, detection);
    }
}
