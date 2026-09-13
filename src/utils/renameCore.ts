import { reservedWords } from './constants';
import { codeLines, isCommentLine, isInComment } from './lineUtils';

export { isInComment } from './lineUtils';

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

interface FunctionScope {
    name: string;
    line: number;
    parameters: string[];
}

const IDENT = '[a-zA-Z_][a-zA-Z0-9_]*';
const FUNCTION_DEF_REGEX = new RegExp(`^(${IDENT})\\s*\\(([^)]*)\\)\\s*=`, 'i');
// "p", "par", "params", ... and "n", "number", ... (XPP keys on the first letter)
const PARAM_LINE_REGEX = /^[pn][a-z]*\s+(.+)/i;

// Core function to detect word range across different XPP syntax patterns
export function detectWordRangeCore(
    lineText: string,
    position: number,
    lineIndex: number
): { range: Range; actualVariableName?: string } | undefined {

    // Variables in comments should never be detected for highlighting or renaming
    if (isInComment(lineText, position)) {
        return undefined;
    }

    const makeRange = (start: number, end: number): Range => ({
        start: { line: lineIndex, character: start },
        end: { line: lineIndex, character: end },
    });

    // Derivative at line start: "dVAR/dt". Cursor anywhere on the whole pattern selects VAR.
    const leadingDerivative = new RegExp(`^d(${IDENT})/dt`, 'i').exec(lineText);
    if (leadingDerivative) {
        const varStart = 1;
        const varEnd = varStart + leadingDerivative[1].length;
        const dtEndPos = varEnd + 2; // index of 't' in "/dt"
        if (position >= 0 && position <= dtEndPos && position < lineText.length) {
            return { range: makeRange(varStart, varEnd), actualVariableName: leadingDerivative[1] };
        }
    }

    // Function notation at line start: "VAR(t) ="
    const functionNotation = new RegExp(`^(${IDENT})\\s*\\(\\s*t\\s*\\)\\s*=`, 'i').exec(lineText);
    if (functionNotation) {
        const end = functionNotation[1].length;
        if (position >= 0 && position <= end) {
            return { range: makeRange(0, end) };
        }
    }

    // Prime notation: "VAR' ="
    const primeNotation = new RegExp(`\\b(${IDENT})'\\s*=`, 'i').exec(lineText);
    if (primeNotation) {
        const varStart = primeNotation.index;
        const varEnd = varStart + primeNotation[1].length;
        if (position >= varStart && position <= varEnd) {
            return { range: makeRange(varStart, varEnd) };
        }
    }

    // First parameter on a "par" line: "par VAR=..." / "par VAR ..."
    const paramLine = new RegExp(`^[pn][a-z]*\\s+(${IDENT})(?==|\\s)`, 'i').exec(lineText);
    if (paramLine) {
        const paramStart = paramLine[0].length - paramLine[1].length;
        const paramEnd = paramStart + paramLine[1].length;
        if (position >= paramStart && position <= paramEnd) {
            return { range: makeRange(paramStart, paramEnd) };
        }
    }

    // Derivative anywhere in the line
    const derivativeRegex = new RegExp(`\\bd(${IDENT})/dt\\b`, 'gi');
    let derivativeMatch;
    while ((derivativeMatch = derivativeRegex.exec(lineText)) !== null) {
        const fullMatchStart = derivativeMatch.index;
        const fullMatchEnd = fullMatchStart + derivativeMatch[0].length;
        if (position >= fullMatchStart && position < fullMatchEnd) {
            const varStart = fullMatchStart + 1;
            const varEnd = varStart + derivativeMatch[1].length;
            return { range: makeRange(varStart, varEnd), actualVariableName: derivativeMatch[1] };
        }
    }

    // Fall back to standard word detection
    const wordRegex = new RegExp(`\\b${IDENT}\\b`, 'g');
    let match;
    while ((match = wordRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const word = match[0];

        // Skip 'dt' if it's part of a dx/dt pattern
        if (word.toLowerCase() === 'dt' && isDerivativeDt(lineText, start)) {
            continue;
        }

        // Cursor strictly within the word
        if (position >= start && position < end) {
            return { range: makeRange(start, end) };
        }

        // Cursor at the exact end of the word: only accept at end of line or before = ) ] }
        if (position === end) {
            const atEndOfLine = position >= lineText.length;
            const charAtCursor = atEndOfLine ? '' : lineText[position];
            if (atEndOfLine || /[=)\]}]/.test(charAtCursor)) {
                return { range: makeRange(start, end) };
            }
        }
    }

    return undefined;
}

/** True when the "dt" starting at `dtStart` is the denominator of a "dX/dt" derivative. */
function isDerivativeDt(line: string, dtStart: number): boolean {
    return new RegExp(`d${IDENT}/$`, 'i').test(line.substring(0, dtStart));
}

// Function to escape special regex characters
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if rename would create a reserved word
export function isReservedWord(word: string): boolean {
    return reservedWords.has(word.toLowerCase());
}

/**
 * True when the rename that starts at (originLine, originPosition) targets a function
 * parameter, i.e. its effect must stay inside that single function definition line.
 */
export function isRenameScopedToFunction(
    lines: string[],
    variableToRename: string,
    originLine: number,
    originPosition: number
): boolean {
    return determineRenameContext(
        lines,
        variableToRename.toLowerCase(),
        originLine,
        originPosition,
        identifyFunctionScopes(lines)
    ).isRenamingInFunction;
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
    lines = codeLines(lines);

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
        if (isCommentLine(line)) continue;

        // Renaming a function parameter only touches that function's line
        if (isRenamingInFunction && i !== functionLineNumber) {
            continue;
        }

        if (getFunctionScopeForLine(functionScopes, i)) {
            handleFunctionScopeRename(line, i, variableLower, newName, isRenamingInFunction, results);
        } else {
            handleLineRename(line, i, variableLower, newName, results);
        }
    }

    return results;
}

// Helper function to determine rename context
function determineRenameContext(
    lines: string[],
    variableLower: string,
    originLine: number | undefined,
    originPosition: number | undefined,
    functionScopes: FunctionScope[]
): { isRenamingInFunction: boolean; functionLineNumber: number } {
    const none = { isRenamingInFunction: false, functionLineNumber: -1 };
    if (originLine === undefined || originPosition === undefined) return none;

    const scope = getFunctionScopeForLine(functionScopes, originLine);
    if (!scope || !scope.parameters.some(p => p.toLowerCase() === variableLower)) return none;

    const funcMatch = FUNCTION_DEF_REGEX.exec(lines[originLine]);
    if (!funcMatch) return none;

    // Cursor on the parameter list, or anywhere in the body: both mean "rename the parameter"
    const paramStartPos = funcMatch[0].indexOf('(') + 1;
    const paramEndPos = paramStartPos + funcMatch[2].length;
    const equalSignPos = funcMatch[0].length - 1;
    const onParameterList = originPosition >= paramStartPos && originPosition <= paramEndPos;
    const inBody = originPosition > equalSignPos;

    if (onParameterList || inBody) {
        return { isRenamingInFunction: true, functionLineNumber: originLine };
    }
    return none;
}

// Helper function to handle renaming in a single (non-function) line
function handleLineRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    results: RenameResult[]
): void {
    // Handle parameter definitions (par, param, parameter): only names before '='
    const paramLineMatch = PARAM_LINE_REGEX.exec(line);
    if (paramLineMatch) {
        const paramSection = paramLineMatch[1];
        const sectionOffset = line.length - paramSection.length;
        const paramRegex = new RegExp(`(${IDENT})\\s*=`, 'g');
        let match;
        while ((match = paramRegex.exec(paramSection)) !== null) {
            if (match[1].toLowerCase() === variableLower) {
                const paramStart = sectionOffset + match.index;
                results.push({
                    line: lineNumber,
                    start: paramStart,
                    end: paramStart + match[1].length,
                    newText: newName,
                });
            }
        }
        return;
    }

    findVariableMatches(line, 0, lineNumber, variableLower, newName, results);
}

/**
 * Pushes every occurrence of the variable in `text` (a full line, or a line suffix that
 * starts at `offset`). Handles the "dVAR/dt" form, whose VAR has no word boundary before it.
 */
function findVariableMatches(
    text: string,
    offset: number,
    lineNumber: number,
    variableLower: string,
    newName: string,
    results: RenameResult[]
): void {
    const escaped = escapeRegExp(variableLower);
    const patterns: { regex: RegExp; groupOffset: number }[] = [
        { regex: new RegExp(`^d(${escaped})/dt`, 'gi'), groupOffset: 1 },
        { regex: new RegExp(`\\b(${escaped})\\b`, 'gi'), groupOffset: 0 },
    ];

    for (const { regex, groupOffset } of patterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index + groupOffset;
            if (isInComment(text, start)) continue;
            if (variableLower === 'dt' && isDerivativeDt(text, start)) continue;
            results.push({
                line: lineNumber,
                start: offset + start,
                end: offset + start + match[1].length,
                newText: newName,
            });
        }
    }
}

// Helper function to identify function scopes
function identifyFunctionScopes(lines: string[]): FunctionScope[] {
    const scopes: FunctionScope[] = [];
    lines.forEach((line, i) => {
        const match = FUNCTION_DEF_REGEX.exec(line);
        if (!match) return;
        scopes.push({
            name: match[1].toLowerCase(),
            line: i,
            parameters: match[2].split(',').map((p) => p.trim()).filter(Boolean),
        });
    });
    return scopes;
}

// Helper function to get function scope for a line
function getFunctionScopeForLine(scopes: FunctionScope[], lineNumber: number): FunctionScope | undefined {
    return scopes.find((scope) => scope.line === lineNumber);
}

/**
 * Renaming on a function definition line "name(p1,p2)=body":
 *  - renaming a parameter: rename it in the list and in the body, never the function name;
 *  - otherwise: rename the function name if it matches, and rename body occurrences unless the
 *    variable is shadowed by one of this function's parameters.
 */
function handleFunctionScopeRename(
    line: string,
    lineNumber: number,
    variableLower: string,
    newName: string,
    isRenamingInFunction: boolean,
    results: RenameResult[]
): void {
    const funcMatch = FUNCTION_DEF_REGEX.exec(line);
    if (!funcMatch) return;

    const functionName = funcMatch[1];
    const paramString = funcMatch[2];
    const paramListStart = funcMatch[0].indexOf('(') + 1;
    const bodyStart = funcMatch[0].length;
    const isParameter = paramString.split(',').some(p => p.trim().toLowerCase() === variableLower);

    if (isRenamingInFunction) {
        if (!isParameter) return;
        const paramRegex = new RegExp(`\\b(${escapeRegExp(variableLower)})\\b`, 'gi');
        let match;
        while ((match = paramRegex.exec(paramString)) !== null) {
            const start = paramListStart + match.index;
            results.push({ line: lineNumber, start, end: start + match[1].length, newText: newName });
        }
        findVariableMatches(line.substring(bodyStart), bodyStart, lineNumber, variableLower, newName, results);
        return;
    }

    if (functionName.toLowerCase() === variableLower) {
        results.push({ line: lineNumber, start: 0, end: functionName.length, newText: newName });
    }
    if (!isParameter) {
        findVariableMatches(line.substring(bodyStart), bodyStart, lineNumber, variableLower, newName, results);
    }
}
