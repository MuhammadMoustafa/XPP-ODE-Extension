import * as vscode from 'vscode';

export class XppSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder();

        // for (let i = 0; i < document.lineCount; i++) {
        //     const line = document.lineAt(i).text;
        //     const functionMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/); // Match function name
        //     const paramMatch = line.match(/\(([^)]*)\)/); // Match parameters inside ()

        //     if (functionMatch) {
        //         const start = functionMatch.index || 0;
        //         const nameLength = functionMatch[1].length;
        //         builder.push(new vscode.Range(i, start, i, start + nameLength), 'function');
        //     }

        //     if (paramMatch) {
        //         const params = paramMatch[1].split(',').map(param => param.trim());
        //         let start = line.indexOf('(') + 1;
        //         params.forEach(param => {
        //             if (param.length > 0) {
        //                 builder.push(new vscode.Range(i, start, i, start + param.length), 'parameter');
        //             }
        //             start += param.length + 1; // Move to next param
        //         });
        //     }
        // }
        return builder.build();
    }
}
