// Core logic for variable/parameter checking, independent of vscode
import { reservedWords } from './constants';

export interface VariableCheckerResult {
    message: string;
    line: number;
    start: number;
    end: number;
    type: 'duplicate-parameter' | 'duplicate-variable' | 'conflict' | 'reserved-word';
}

export function checkVariablesAndParameters(text: string): VariableCheckerResult[] {
    const diagnostics: VariableCheckerResult[] = [];
    const variableNames: Set<string> = new Set();
    const parameterNames: Set<string> = new Set();
    const lines = text.split(/\r?\n/);

    // First pass: collect parameter names (case-insensitive) and check for duplicates
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parMatch = line.match(/^(par(?:am(?:eter)?)?)\s+(.+)/i);
        if (parMatch) {
            const params = parMatch[2].split(',').map(p => p.split('=')[0].trim().toLowerCase());
            params.forEach(p => {
                if (!p) return;
                const idx = line.toLowerCase().indexOf(p);
                if (parameterNames.has(p)) {
                    diagnostics.push({
                        message: `Duplicate parameter name: '${p}'`,
                        line: i,
                        start: idx,
                        end: idx + p.length,
                        type: 'duplicate-parameter',
                    });
                } else {
                    parameterNames.add(p);
                }
            });
        }
    }

    // Second pass: collect variable names (case-insensitive, only from assignment or derivative declaration) and check for duplicates/conflicts
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#')) continue;
        if (/^@\s+/.test(line)) continue;
        if (/^(par(?:am(?:eter)?)?)\s+/i.test(line)) continue; // Skip parameter declaration lines

        // Variable assignment: name = ... (not after par/param/parameter)
        const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
        if (varMatch) {
            const variable = varMatch[1].toLowerCase();
            const idx = varMatch.index || 0;
            if (reservedWords.has(variable)) {
                diagnostics.push({
                    message: `Reserved word used as variable name: ${variable}`,
                    line: i,
                    start: idx,
                    end: idx + variable.length,
                    type: 'reserved-word',
                });
            } else {
                if (variableNames.has(variable)) {
                    diagnostics.push({
                        message: `Duplicate variable name: '${variable}'`,
                        line: i,
                        start: idx,
                        end: idx + variable.length,
                        type: 'duplicate-variable',
                    });
                } else {
                    variableNames.add(variable);
                    if (parameterNames.has(variable)) {
                        diagnostics.push({
                            message: `Variable name '${variable}' conflicts with parameter name: '${variable}' (case-insensitive).`,
                            line: i,
                            start: idx,
                            end: idx + variable.length,
                            type: 'conflict',
                        });
                    }
                }
            }
        }
        // Derivative: dname/dt = ...
        const derivMatch = line.match(/^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt\s*=/);
        if (derivMatch) {
            const variable = derivMatch[1].toLowerCase();
            const idx = (derivMatch.index || 1);
            if (reservedWords.has(variable)) {
                diagnostics.push({
                    message: `Reserved word used as variable name: ${variable}`,
                    line: i,
                    start: idx,
                    end: idx + variable.length,
                    type: 'reserved-word',
                });
            } else {
                if (variableNames.has(variable)) {
                    diagnostics.push({
                        message: `Duplicate variable name: '${variable}'`,
                        line: i,
                        start: idx,
                        end: idx + variable.length,
                        type: 'duplicate-variable',
                    });
                } else {
                    variableNames.add(variable);
                    if (parameterNames.has(variable)) {
                        diagnostics.push({
                            message: `Variable name '${variable}' conflicts with parameter name: '${variable}' (case-insensitive).`,
                            line: i,
                            start: idx,
                            end: idx + variable.length,
                            type: 'conflict',
                        });
                    }
                }
            }
        }
    }
    return diagnostics;
}
