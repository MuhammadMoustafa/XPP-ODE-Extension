import * as vscode from 'vscode';
import { reservedWords } from '../utils/constants';

export class XppRenameProvider implements vscode.RenameProvider {
    provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.WorkspaceEdit> {
        // Early cancellation check
        if (token.isCancellationRequested) {
            return null;
        }
        
        const wordRange = document.getWordRangeAtPosition(position, /\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        
        // Validate the new name isn't a reserved word
        if (reservedWords.has(newName.toLowerCase())) {
            throw new Error(`'${newName}' is a reserved word in XPP and cannot be used as a variable name.`);
        }
        
        const edit = new vscode.WorkspaceEdit();
        
        // Find all documents in the workspace
        return vscode.workspace.findFiles('**/*.{ode,inc}').then(uris => {
            // Check for cancellation after async operation
            if (token.isCancellationRequested) {
                return null;
            }
            
            // Process each document
            return Promise.all(uris.map(uri => 
                vscode.workspace.openTextDocument(uri).then(doc => {
                    // Check for cancellation during document processing
                    if (token.isCancellationRequested) {
                        return;
                    }
                    this.processDocumentForRename(doc, word, newName, edit);
                })
            )).then(() => edit);
        });
    }
    
    private processDocumentForRename(
        doc: vscode.TextDocument, 
        word: string, 
        newName: string, 
        edit: vscode.WorkspaceEdit
    ): void {
        // Get all text in the document to analyze function scopes
        const fullText = doc.getText();
        const functionScopes = this.identifyFunctionScopes(fullText);
        
        // Process each line
        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i).text;
            const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'g');
            let match;
            
            while ((match = regex.exec(line)) !== null) {
                // Skip if this is inside a comment
                if (this.isInComment(line, match.index)) {
                    continue;
                }
                
                const pos = new vscode.Position(i, match.index);
                const range = new vscode.Range(i, match.index, i, match.index + word.length);
                
                // Check if this reference is inside a function scope
                const functionScope = this.getFunctionScopeForPosition(functionScopes, i, match.index);
                
                // Only replace if not shadowed by parameter with same name
                if (!functionScope || !functionScope.parameters.includes(word.toLowerCase()) || 
                    this.isWithinParameterDeclaration(line, match.index, word)) {
                    edit.replace(doc.uri, range, newName);
                }
            }
        }
    }
    
    private isInComment(line: string, index: number): boolean {
        const commentStart = line.indexOf('#');
        return commentStart !== -1 && index > commentStart;
    }
    
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    private isWithinParameterDeclaration(line: string, index: number, word: string): boolean {
        // Check if we're inside a parameter declaration like func(param1,param2)
        const lineUpToMatch = line.substring(0, index);
        const openParenIndex = lineUpToMatch.lastIndexOf('(');
        const closeParenIndex = line.indexOf(')', index);
        
        return openParenIndex !== -1 && 
               closeParenIndex !== -1 && 
               index > openParenIndex && 
               index < closeParenIndex;
    }
    
    private identifyFunctionScopes(text: string): Array<{
        name: string;
        startLine: number;
        parameters: string[];
    }> {
        const functionScopes: Array<{
            name: string;
            startLine: number;
            parameters: string[];
        }> = [];
        
        // Split into lines for processing
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match function declarations like "func(param1,param2)="
            const functionMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/);
            
            if (functionMatch) {
                const functionName = functionMatch[1];
                const params = functionMatch[2]
                    .split(',')
                    .map(p => p.trim().toLowerCase())
                    .filter(p => p.length > 0);
                
                functionScopes.push({
                    name: functionName,
                    startLine: i,
                    parameters: params
                });
            }
        }
        
        return functionScopes;
    }
    
    private getFunctionScopeForPosition(
        functionScopes: Array<{name: string; startLine: number; parameters: string[]}>,
        line: number,
        character: number
    ): {name: string; startLine: number; parameters: string[]} | undefined {
        // Find the function scope containing this position
        // In XPP, function scope is typically the line where the function is declared
        return functionScopes.find(scope => scope.startLine === line);
    }
}
