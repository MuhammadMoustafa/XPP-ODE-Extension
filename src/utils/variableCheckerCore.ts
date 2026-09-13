import { reservedWords } from './constants';
import { codeLines } from './lineUtils';

export interface VariableCheckerResult {
    message: string;
    line: number;
    start: number;
    end: number;
    type: 'duplicate-parameter' | 'duplicate-variable' | 'duplicate-function' | 'conflict' | 'reserved-word';
}

type NameKind = 'parameter' | 'variable' | 'function';

const IDENT = '[a-zA-Z_][a-zA-Z0-9_]*';
// "p", "par", "params", ... and "n", "number", ... (XPP keys on the first letter)
const PARAM_LINE_REGEX = /^[pn][a-z]*\s+(.+)/i;
const INIT_COND_REGEX = new RegExp(`^(${IDENT})\\s*\\(\\s*0\\s*\\)\\s*=`, 'i');
const FUNC_NOTATION_REGEX = new RegExp(`^(${IDENT})\\s*\\(\\s*t\\s*\\)\\s*=`, 'i');
const PRIME_REGEX = new RegExp(`^(${IDENT})'\\s*=`, 'i');
const ASSIGNMENT_REGEX = new RegExp(`^(${IDENT})\\s*=`);
const DERIVATIVE_REGEX = new RegExp(`^d(${IDENT})/dt\\s*=`, 'i');
const FUNCTION_DEF_REGEX = new RegExp(`^(${IDENT})\\s*\\(([^)]*)\\)\\s*=`);

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export function checkVariablesAndParameters(text: string): VariableCheckerResult[] {
    const diagnostics: VariableCheckerResult[] = [];
    const declared: Record<NameKind, Set<string>> = {
        parameter: new Set<string>(),
        variable: new Set<string>(),
        function: new Set<string>(),
    };
    const duplicateType: Record<NameKind, VariableCheckerResult['type']> = {
        parameter: 'duplicate-parameter',
        variable: 'duplicate-variable',
        function: 'duplicate-function',
    };

    function addDiagnostic(type: VariableCheckerResult['type'], message: string, line: number, start: number, end: number) {
        diagnostics.push({ message, line, start, end, type });
    }

    /** Registers a declared name and reports reserved words, duplicates, and cross-kind conflicts. */
    function declare(kind: NameKind, name: string, line: number, start: number) {
        const nameLower = name.toLowerCase();
        const end = start + name.length;

        if (reservedWords.has(nameLower)) {
            addDiagnostic('reserved-word', `Reserved word used as ${kind} name: ${name}`, line, start, end);
        }
        if (declared[kind].has(nameLower)) {
            addDiagnostic(duplicateType[kind], `Duplicate ${kind} name: '${name}'`, line, start, end);
        } else {
            declared[kind].add(nameLower);
        }
        (Object.keys(declared) as NameKind[])
            .filter(other => other !== kind && declared[other].has(nameLower))
            .forEach(other => {
                addDiagnostic('conflict', `${capitalize(kind)} name '${name}' conflicts with ${other} name: '${name}'`, line, start, end);
            });
    }

    const lines = codeLines(text.split(/\r?\n/));

    lines.forEach((line, i) => {
        const indent = line.search(/\S|$/);
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || /^@\s+/.test(trimmed)) return;

        // Parameter definitions: par a=1, b=2
        const paramMatch = PARAM_LINE_REGEX.exec(trimmed);
        if (paramMatch) {
            const paramList = paramMatch[1];
            const listOffset = indent + paramMatch[0].length - paramList.length;
            let chunkOffset = 0;
            for (const chunk of paramList.split(',')) {
                const nameMatch = new RegExp(`^(\\s*)(${IDENT})`).exec(chunk);
                if (nameMatch) {
                    declare('parameter', nameMatch[2], i, listOffset + chunkOffset + nameMatch[1].length);
                }
                chunkOffset += chunk.length + 1;
            }
            return;
        }

        // Initial conditions like "V(0) = 0" only need a reserved-word check
        const initCondMatch = INIT_COND_REGEX.exec(trimmed);
        if (initCondMatch) {
            const varName = initCondMatch[1];
            if (reservedWords.has(varName.toLowerCase())) {
                addDiagnostic('reserved-word', `Reserved word used as variable name: ${varName}`, i, indent, indent + varName.length);
            }
            return;
        }

        // State variables: y(t)=..., y'=..., dy/dt=...
        const funcNotationMatch = FUNC_NOTATION_REGEX.exec(trimmed);
        if (funcNotationMatch) {
            declare('variable', funcNotationMatch[1], i, indent);
            return;
        }
        const primeMatch = PRIME_REGEX.exec(trimmed);
        if (primeMatch) {
            declare('variable', primeMatch[1], i, indent);
            return;
        }
        const derivMatch = DERIVATIVE_REGEX.exec(trimmed);
        if (derivMatch) {
            declare('variable', derivMatch[1], i, indent + 1);
            return;
        }

        // Fixed variables: name=...
        const varMatch = ASSIGNMENT_REGEX.exec(trimmed);
        if (varMatch) {
            declare('variable', varMatch[1], i, indent);
            return;
        }

        // Function definitions: f(x,y)=...
        const funcMatch = FUNCTION_DEF_REGEX.exec(trimmed);
        if (funcMatch) {
            declare('function', funcMatch[1], i, indent);
        }
    });

    return diagnostics;
}
