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
    
    // CRITICAL: Check comments first before any pattern matching
    // Variables in comments should never be detected for highlighting or renaming
    if (isInComment(lineText, position)) {
        return undefined;
    }
    
    const patterns = [
        {
            regex: /^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt/i,
            handler: (match: RegExpExecArray) => {
                const dPrefix = lineText.indexOf('d');
                const varStart = dPrefix + 1;
                const varEnd = varStart + match[1].length;
                const slashPos = lineText.indexOf('/', dPrefix);
                const dtEndPos = slashPos + 2; // Position of 't' in "dt" (slash + "d" + "t")

                // Check if cursor is anywhere within the entire "dVAR/dt" pattern  
                // This includes positions at 'd', within the variable name, at '/', at 'd' in dt, and at 't' in dt
                if (position >= dPrefix && position <= dtEndPos && position < lineText.length) {
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
            regex: /^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt\s*=/i,
            handler: (match: RegExpExecArray) => {
                const dPrefix = lineText.indexOf('d');
                const varStart = dPrefix + 1;
                const varEnd = varStart + match[1].length;
                const slashPos = lineText.indexOf('/', dPrefix);
                const dtEndPos = slashPos + 2; // Position of 't' in "dt" (slash + "d" + "t")

                // Check if cursor is anywhere within the entire "dVAR/dt" pattern  
                // This includes positions at 'd', within the variable name, at '/', at 'd' in dt, and at 't' in dt
                if (position >= dPrefix && position <= dtEndPos && position < lineText.length) {
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

                if (position >= start && position <= end) {
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

                if (position >= paramStart && position <= paramEnd) {
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

    // Check for derivative patterns that might not have been caught by the main patterns
    // This handles cases where dt is anywhere in the line, not just at the start
    const derivativeRegex = /\bd([a-zA-Z_][a-zA-Z0-9_]*)\/dt\b/g;
    let derivativeMatch;
    while ((derivativeMatch = derivativeRegex.exec(lineText)) !== null) {
        const fullMatchStart = derivativeMatch.index;
        const fullMatchEnd = fullMatchStart + derivativeMatch[0].length;
        
        // If cursor is within this derivative pattern, return the variable
        if (position >= fullMatchStart && position < fullMatchEnd) {
            const varStart = fullMatchStart + 1; // Skip the 'd'
            const varEnd = varStart + derivativeMatch[1].length;
            
            return {
                range: {
                    start: { line: lineIndex, character: varStart },
                    end: { line: lineIndex, character: varEnd },
                },
                actualVariableName: derivativeMatch[1],
            };
        }
    }

    // Fall back to standard word detection
    // But exclude 'dt' when it's part of a dx/dt pattern and exclude numbers
    // Note: Comments are already checked at the beginning of this function
    
    const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = wordRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const word = match[0];

        // Skip numbers (even though regex shouldn't match them, be extra safe)
        if (/^\d/.test(word)) {
            continue;
        }

        // Skip 'dt' if it's part of a dx/dt pattern
        if (word === 'dt') {
            const beforeDt = lineText.substring(0, start);
            if (/d[a-zA-Z_][a-zA-Z0-9_]*\/$/.test(beforeDt)) {
                continue; // Skip this 'dt' because it's part of dx/dt pattern
            }
        }

        // Only match if cursor is WITHIN the word
        if (position >= start && position < end) {
            // This is already within a valid word match from the regex
            // No need to reject here since the regex already ensures valid word characters
            return {
                range: {
                    start: { line: lineIndex, character: start },
                    end: { line: lineIndex, character: end },
                },
            };
        }
        
        // Special case: cursor at exact end of word
        // This allows selection when cursor is right after the word at valid boundaries
        if (position === end && end <= lineText.length) {
            // First check: if cursor is actually ON a character, what character is it?
            if (position < lineText.length) {
                const charAtCursor = lineText[position];
                // If cursor is ON an arithmetic operator character, reject immediately 
                // Allow parentheses and brackets as they can be valid boundaries for parameters
                // REJECT: * + - / , . ; : ! < > | & ^ ~ ?
                // ALLOW: ( ) [ ] { } (these can be valid word boundaries)
                if (/[*+\-/,.;:!<>|&^~?]/.test(charAtCursor)) {
                    continue; // Cursor is ON an inappropriate operator, reject this word match
                }
            }
            
            // If we get here, cursor is either at end of line or after a word
            // Check if this is a valid boundary
            let allowEndSelection = false;
            
            if (position >= lineText.length) {
                // At end of line - always valid
                allowEndSelection = true;
            } else {
                const charAfterWord = lineText[position];
                // Allow reasonable boundary characters
                // ALLOW: = ) ] } (closing operators and assignment)
                // REJECT: ( [ { * + - / (opening operators and arithmetic)
                if (/[=)\]}]/.test(charAfterWord)) {
                    allowEndSelection = true;
                }
            }
            
            // Only proceed if this is a valid boundary and character before is valid
            if (allowEndSelection && end > 0) {
                const charBeforeCursor = lineText[end - 1];
                if (/[a-zA-Z_0-9]/.test(charBeforeCursor)) {
                    return {
                        range: {
                            start: { line: lineIndex, character: start },
                            end: { line: lineIndex, character: end },
                        },
                    };
                }
            }
        }
    }

    return undefined;
}

// Function to escape special regex characters
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to extract variable name from full derivative pattern
// This handles cases where VS Code's wordPattern selects the entire dx/dt but we want just x
export function extractVariableFromDerivativePattern(text: string): string | undefined {
    const derivativePatterns = [
        /^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt$/,   // matches dx/dt exactly
        /^([a-zA-Z_][a-zA-Z0-9_]*)'$/,       // matches x' exactly
        /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*t\s*\)$/ // matches x(t) exactly
    ];
    
    for (const pattern of derivativePatterns) {
        const match = pattern.exec(text.trim());
        if (match) {
            return match[1]; // Return the captured variable name
        }
    }
    
    return undefined;
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

        // If we're renaming in a function, only process that specific function line
        if (isRenamingInFunction && i !== functionLineNumber) {
            continue;
        }

        const functionScope = getFunctionScopeForLine(functionScopes, i);
        let handled = false;
        if (functionScope) {
            handled = handleFunctionScopeRename(
                line,
                i,
                variableLower,
                newName,
                isRenamingInFunction,
                functionLineNumber,
                results
            );
        }
        if (!handled) {
            handleLineRename(line, i, variableLower, newName, results);
        }
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

                // Check if cursor is on a parameter name
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

                // Also check if cursor is in function body and the variable is a parameter
                if (!isRenamingInFunction) {
                    const equalSignPos = line.indexOf('=');
                    if (equalSignPos !== -1 && originPosition > equalSignPos) {
                        // Cursor is in function body, check if variable is a parameter
                        const hasParameter = paramNames.some(p => p.toLowerCase() === variableLower);
                        if (hasParameter) {
                            isRenamingInFunction = true;
                            functionLineNumber = originLine;
                        }
                    }
                }
            }
        }
    }

    return { isRenamingInFunction, functionLineNumber };
}

// Helper function to handle renaming in a single line
function handleLineRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    results: RenameResult[]
): void {
    // Skip function definition lines to avoid double-counting
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*=/.test(line)) {
        return;
    }
    // Handle parameter definitions (par, param, parameter)
    const paramLineMatch = line.match(/^par(?:am(?:eter)?)?\s+(.+)/i);
    if (paramLineMatch) {
        // Split by comma for multiple parameters
        const paramSection = paramLineMatch[1];
        // Match all parameter names (e.g., x=7, y=10, x=2)
        const paramRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
        let match;
        let searchOffset = line.toLowerCase().indexOf(paramSection.toLowerCase());
        while ((match = paramRegex.exec(paramSection)) !== null) {
            const paramName = match[1];
            if (paramName.toLowerCase() === variableLower) {
                // Find absolute position in line
                const paramStart = searchOffset + match.index;
                results.push({
                    line: lineNumber,
                    start: paramStart,
                    end: paramStart + paramName.length,
                    newText: newName,
                });
            }
        }
        return;
    }

    const patterns = [
        new RegExp(`^d(${escapeRegExp(variableLower)})/dt`, 'gi'),
        new RegExp(`\\b(${escapeRegExp(variableLower)})'\\b`, 'gi'),
        new RegExp(`^(${escapeRegExp(variableLower)})\\s*\\(\\s*t\\s*\\)`, 'gi'),
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

        // Calculate the position of the captured group within the match
        const fullMatch = match[0];
        const capturedGroup = match[groupIndex];
        const groupStartInMatch = fullMatch.indexOf(capturedGroup);
        const start = match.index + groupStartInMatch;
        const end = start + capturedGroup.length;

        // Skip 'dt' if it's part of a dx/dt pattern
        if (capturedGroup === 'dt') {
            const beforeDt = line.substring(0, start);
            if (/d[a-zA-Z_][a-zA-Z0-9_]*\/$/.test(beforeDt)) {
                continue; // Skip this 'dt' because it's part of dx/dt pattern
            }
        }

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

// Helper function to handle renaming within a function scope
function handleFunctionScopeRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    isRenamingInFunction: boolean,
    functionLineNumber: number,
    results: RenameResult[]
): boolean {
    const funcMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/i);
    if (!funcMatch) return false;

    const functionName = funcMatch[1];
    const paramString = funcMatch[2];
    const paramNames = paramString.split(',').map((p) => p.trim());

    if (isRenamingInFunction && functionLineNumber === lineNumber) {
        // Only match parameter and usages in body, NOT function name
        const hasParameter = paramNames.some(p => p.toLowerCase() === variableLower);
        if (hasParameter) {
            // 1. Rename the parameter
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
            // 2. Also rename usages in function body
            const equalSignPos = line.indexOf('=');
            if (equalSignPos !== -1) {
                const functionBody = line.substring(equalSignPos + 1);
                const varRegex = new RegExp(`\\b(${escapeRegExp(variableLower)})\\b`, 'gi');
                let bodyMatch;
                let alreadyMatched: number[] = [];
                while ((bodyMatch = varRegex.exec(functionBody)) !== null) {
                    if (isInComment(functionBody, bodyMatch.index)) continue;
                    const bodyStartPos = equalSignPos + 1;
                    const start = bodyStartPos + bodyMatch.index;
                    const end = start + bodyMatch[1].length;
                    // Avoid double-counting if the parameter and body overlap
                    if (!alreadyMatched.includes(start)) {
                        results.push({
                            line: lineNumber,
                            start,
                            end,
                            newText: newName,
                        });
                        alreadyMatched.push(start);
                    }
                }
            }
            return true; // Handled
        }
        return false;
    } else {
        // Only match the function name, NOT parameter or body
        if (functionName.toLowerCase() === variableLower) {
            const start = 0; // function name always starts at 0
            results.push({
                line: lineNumber,
                start,
                end: start + functionName.length,
                newText: newName,
            });
        }
        return false;
    }
}
