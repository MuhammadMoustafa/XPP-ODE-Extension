import * as vscode from 'vscode';

export class XppSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder();
        const parameterNames = new Set<string>();
        const variableNames = new Set<string>();

        // First pass: collect parameter and variable names
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            // Parameter declaration: par/param/parameter name[=value][,name2[=value2],...]
            const parMatch = line.match(/^(par(?:am(?:eter)?)?)\s+(.+)/i);
            if (parMatch) {
                const params = parMatch[2].split(',').map(p => p.split('=')[0].trim());
                params.forEach(p => { if (p) parameterNames.add(p); });
                continue;
            }
            // Variable assignment: name = ... (not after par/param/parameter)
            const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (varMatch) {
                variableNames.add(varMatch[1]);
            }
            // Derivative: dname/dt = ...
            const derivMatch = line.match(/^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt\s*=/);
            if (derivMatch) {
                variableNames.add(derivMatch[1]);
            }
        }

        // Second pass: highlight usages
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            // Skip comments
            if (/^\s*#/.test(line)) continue;
            // Highlight parameters
            parameterNames.forEach(name => {
                let regex = new RegExp(`\\b${name}\\b`, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    builder.push(new vscode.Range(i, match.index, i, match.index + name.length), 'parameter');
                }
            });
            // Highlight variables (only if not a parameter)
            variableNames.forEach(name => {
                if (parameterNames.has(name)) return;
                let regex = new RegExp(`\\b${name}\\b`, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    builder.push(new vscode.Range(i, match.index, i, match.index + name.length), 'variable');
                }
            });
        }
        return builder.build();
    }
}
