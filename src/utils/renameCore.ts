import { reservedWords } from './constants';

export interface RenameResult {
    line: number;
    start: number;
    end: number;
    newText: string;
}

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

// Core function to detect word range across different XPP syntax patterns
export function detectWordRangeCore(
    lineText: string,
    position: number,
    lineIndex: number
): { range: Range; actualVariableName?: string } | undefined {
    const patterns = [
        {
            regex: /^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt\s*=/i,
            handler: (match: RegExpExecArray) => {
                const dPrefix = lineText.indexOf('d');
                const varStart = dPrefix + 1;
                const varEnd = varStart + match[1].length;
                const slashPos = lineText.indexOf('/', dPrefix);

                if (position >= dPrefix && position <= slashPos) {
                    return {
                        range: {
                            start: { line: lineIndex, character: varStart },
                            end: { line: lineIndex, character: varEnd },
                        },
                        actualVariableName: match[1],
                    };
                }
            },
        },
        {
            regex: /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*t\s*\)\s*=/i,
            handler: (match: RegExpExecArray) => {
                const varName = match[1];
                const start = lineText.indexOf(varName);
                const end = start + varName.length;

                if (position >= start && position < end) {
                    return {
                        range: {
                            start: { line: lineIndex, character: start },
                            end: { line: lineIndex, character: end },
                        },
                    };
                }
            },
        },
        {
            regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)'\s*=/i,
            handler: (match: RegExpExecArray) => {
                const varStart = match.index;
                const varEnd = varStart + match[1].length;
                const primePos = varEnd;

                if (position >= varStart && position <= primePos) {
                    return {
                        range: {
                            start: { line: lineIndex, character: varStart },
                            end: { line: lineIndex, character: varEnd },
                        },
                    };
                }
            },
        },
        {
            regex: /^par(?:am(?:eter)?)?\s+([a-zA-Z_][a-zA-Z0-9_]*)(=|\s)/i,
            handler: (match: RegExpExecArray) => {
                const paramName = match[1];
                const paramStart = lineText.toLowerCase().indexOf(paramName.toLowerCase());
                const paramEnd = paramStart + paramName.length;

                if (position >= paramStart && position < paramEnd) {
                    return {
                        range: {
                            start: { line: lineIndex, character: paramStart },
                            end: { line: lineIndex, character: paramEnd },
                        },
                    };
                }
            },
        },
    ];

    for (const { regex, handler } of patterns) {
        const match = regex.exec(lineText);
        if (match) {
            const result = handler(match);
            if (result) return result;
        }
    }

    // Fall back to standard word detection
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = wordRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (position >= start && position < end) {
            return {
                range: {
                    start: { line: lineIndex, character: start },
                    end: { line: lineIndex, character: end },
                },
            };
        }
    }

    return undefined;
}

// Function to escape special regex characters
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Checks if a position is inside a comment
export function isInComment(line: string, position: number): boolean {
    const commentStart = line.indexOf('#');
    return commentStart !== -1 && position > commentStart;
}

// Core function to find all rename occurrences in a document
export function findRenameOccurrences(
    lines: string[],
    variableToRename: string,
    newName: string,
    originLine?: number,
    originPosition?: number
): RenameResult[] {
    const results: RenameResult[] = [];
    const variableLower = variableToRename.toLowerCase();

    const functionScopes = identifyFunctionScopes(lines);
    const { isRenamingInFunction, functionLineNumber } = determineRenameContext(
        lines,
        variableLower,
        originLine,
        originPosition,
        functionScopes
    );

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('#')) continue;

        const functionScope = getFunctionScopeForLine(functionScopes, i);
        if (functionScope) {
            handleFunctionScopeRename(
                line,
                i,
                variableLower,
                newName,
                isRenamingInFunction,
                functionLineNumber,
                results
            );
            continue;
        }

        handleLineRename(line, i, variableLower, newName, results);
    }

    return results;
}

// Helper function to determine rename context
function determineRenameContext(
    lines: string[],
    variableLower: string,
    originLine?: number,
    originPosition?: number,
    functionScopes?: Array<{ name: string; line: number; parameters: string[] }>
): { isRenamingInFunction: boolean; functionLineNumber: number } {
    let isRenamingInFunction = false;
    let functionLineNumber = -1;

    if (originLine !== undefined && originPosition !== undefined) {
        const scope = functionScopes ? getFunctionScopeForLine(functionScopes, originLine) : undefined;
        if (scope) {
            const line = lines[originLine];
            const funcMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/i);

            if (funcMatch) {
                const paramString = funcMatch[2];
                const paramStartPos = line.indexOf(paramString);
                const paramNames = paramString.split(',').map((p) => p.trim());

                for (const param of paramNames) {
                    const paramPos = paramString.indexOf(param);
                    const absParamStart = paramStartPos + paramPos;
                    const absParamEnd = absParamStart + param.length;

                    if (
                        originPosition >= absParamStart &&
                        originPosition <= absParamEnd &&
                        param.toLowerCase() === variableLower
                    ) {
                        isRenamingInFunction = true;
                        functionLineNumber = originLine;
                        break;
                    }
                }
            }
        }
    }

    return { isRenamingInFunction, functionLineNumber };
}

// Helper function to handle renaming within a function scope
function handleFunctionScopeRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    isRenamingInFunction: boolean,
    functionLineNumber: number,
    results: RenameResult[]
): void {
    const funcMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/i);
    if (!funcMatch) return;

    const paramString = funcMatch[2];
    const paramNames = paramString.split(',').map((p) => p.trim());

    if (paramNames.some((p) => p.toLowerCase() === variableLower)) {
        if (isRenamingInFunction && functionLineNumber === lineNumber) {
            const paramStartPos = line.indexOf(paramString);
            for (const param of paramNames) {
                if (param.toLowerCase() === variableLower) {
                    const paramPos = paramString.indexOf(param);
                    const absParamStart = paramStartPos + paramPos;

                    results.push({
                        line: lineNumber,
                        start: absParamStart,
                        end: absParamStart + param.length,
                        newText: newName,
                    });
                }
            }
        }
    }
}

// Helper function to handle renaming in a single line
function handleLineRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    results: RenameResult[]
): void {
    const patterns = [
        new RegExp(`\\bd(${escapeRegExp(variableLower)})\\/dt\\b`, 'gi'),
        new RegExp(`\\b(${escapeRegExp(variableLower)})'\\b`, 'gi'),
        new RegExp(`\\b(${escapeRegExp(variableLower)})\\s*\\(\\s*t\\s*\\)`, 'gi'),
        new RegExp(`\\b(${escapeRegExp(variableLower)})\\b`, 'gi'),
    ];

    for (const regex of patterns) {
        findMatchesForPattern(line, regex, 1, lineNumber, results, newName);
    }
}

// Helper function to find matches for a pattern in a line of text
function findMatchesForPattern(
    line: string,
    regex: RegExp,
    groupIndex: number,
    lineNumber: number,
    results: RenameResult[],
    newName: string
): void {
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
        if (isInComment(line, match.index)) continue;

        const start = match.index;
        const end = start + match[groupIndex].length;

        results.push({
            line: lineNumber,
            start,
            end,
            newText: newName,
        });
    }
}

// Helper function to identify function scopes
function identifyFunctionScopes(
    lines: string[]
): Array<{ name: string; line: number; parameters: string[] }> {
    return lines
        .map((line, i) => {
            const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/i);
            if (!match) return null;

            return {
                name: match[1].toLowerCase(),
                line: i,
                parameters: match[2].split(',').map((p) => p.trim()).filter(Boolean),
            };
        })
        .filter((scope): scope is { name: string; line: number; parameters: string[] } => scope !== null);
}

// Helper function to get function scope for a line
function getFunctionScopeForLine(
    scopes: Array<{ name: string; line: number; parameters: string[] }>,
    lineNumber: number
): { name: string; line: number; parameters: string[] } | undefined {
    return scopes.find((scope) => scope.line === lineNumber);
}

// Check if rename would create a reserved word
export function isReservedWord(word: string): boolean {
    return reservedWords.has(word.toLowerCase());
}
