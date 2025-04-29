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
    const variableNames = new Set<string>();
    const parameterNames = new Set<string>();
    const functionNames = new Set<string>();
    // Track differential equations by variable name and form
    const diffEqVariables = new Map<string, {line: number, start: number, form: 'standard' | 'prime' | 'function'}>();
    const lines = text.split(/\r?\n/);

    function addDiagnostic(type: VariableCheckerResult['type'], message: string, line: number, start: number, end: number) {
        diagnostics.push({ message, line, start, end, type });
    }

    function checkNameConflict(name: string, line: number, start: number, end: number, type: 'parameter' | 'variable') {
        if (reservedWords.has(name)) {
            addDiagnostic('reserved-word', `Reserved word used as ${type} name: '${name}'`, line, start, end);
        } else if (type === 'variable' && parameterNames.has(name)) {
            addDiagnostic('conflict', `Variable name '${name}' conflicts with parameter name`, line, start, end);
        } else if (type === 'parameter' && variableNames.has(name)) {
            addDiagnostic('conflict', `Parameter name '${name}' conflicts with variable name`, line, start, end);
        } else if (functionNames.has(name)) {
            addDiagnostic('conflict', `${type.charAt(0).toUpperCase() + type.slice(1)} name '${name}' conflicts with function name`, line, start, end);
        }
    }
    
    // Helper function to get the form name for error messages
    function getFormName(form: 'standard' | 'prime' | 'function'): string {
        switch (form) {
            case 'standard': return 'd/dt form';
            case 'prime': return 'prime notation';
            case 'function': return 'function notation y(t)';
        }
    }
    
    // Unified handler for all differential equation forms
    function handleDifferentialEquation(
        variable: string,
        lineIndex: number,
        startPos: number,
        form: 'standard' | 'prime' | 'function',
        offsetStart: number = 0,
        offsetEnd: number = 0
    ) {
        const variableLower = variable.toLowerCase();
        const start = startPos + offsetStart;
        const end = start + variable.length + offsetEnd;
        
        // Check if this variable already has a differential equation defined
        if (diffEqVariables.has(variableLower)) {
            const prevDef = diffEqVariables.get(variableLower)!;
            const conflictForm = getFormName(prevDef.form);
            addDiagnostic('conflict', 
                `Duplicate differential equation for '${variable}': already defined using ${conflictForm}`,
                lineIndex, start, end);
        } else {
            // Record this differential equation
            diffEqVariables.set(variableLower, {line: lineIndex, start, form});
            
            if (variableNames.has(variableLower)) {
                addDiagnostic('duplicate-variable', `Duplicate variable name: '${variable}'`, lineIndex, start, end);
            } else {
                variableNames.add(variableLower);
                checkNameConflict(variableLower, lineIndex, start, end, 'variable');
            }
        }
    }

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || /^@\s+/.test(trimmed)) return;

        // Handle parameter definitions
        const paramMatch = trimmed.match(/^(par(?:am(?:eter)?)?)\s+(.+)/i);
        if (paramMatch) {
            const paramList = paramMatch[2];
            const params = paramList.split(',').map(p => {
                const paramName = p.split('=')[0].trim().toLowerCase();
                // Find where this specific parameter appears in the original parameter list
                const paramIndex = paramList.toLowerCase().indexOf(paramName);
                // Calculate the absolute position by adding the prefix length
                const prefixLength = trimmed.indexOf(paramList);
                const start = prefixLength + paramIndex;
                return { name: paramName, start, end: start + paramName.length };
            });
            
            params.forEach(({ name, start, end }) => {
                if (parameterNames.has(name)) {
                    addDiagnostic('duplicate-parameter', `Duplicate parameter name: '${name}'`, i, start, end);
                } else {
                    parameterNames.add(name);
                    checkNameConflict(name, i, start, end, 'parameter');
                }
            });
            return;
        }

        // Handle initial conditions like "V(0) = 0" - don't check for conflicts
        const initCondMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*0\s*\)\s*=/i);
        if (initCondMatch) {
            const varName = initCondMatch[1].toLowerCase();
            // Only check for reserved words, but no duplicate/conflict check for initial conditions
            if (reservedWords.has(varName)) {
                const start = trimmed.indexOf(varName);
                addDiagnostic('reserved-word', `Reserved word used as variable name: '${varName}'`, i, start, start + varName.length);
            }
            return;
        }
        
        // Handle function notation for differential equations (y(t) = ...)
        const funcNotationMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*t\s*\)\s*=/i);
        if (funcNotationMatch) {
            const varName = funcNotationMatch[1];
            const start = trimmed.indexOf(varName);
            handleDifferentialEquation(varName, i, start, 'function');
            return;
        }

        // Handle prime notation for differential equations (y' = ...)
        const primeMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)'\s*=/i);
        if (primeMatch) {
            const varName = primeMatch[1];
            const start = trimmed.indexOf(varName);
            handleDifferentialEquation(varName, i, start, 'prime');
            return;
        }

        // Handle regular variable assignments
        const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
        if (varMatch) {
            const variable = varMatch[1].toLowerCase();
            const start = varMatch.index || 0;
            if (variableNames.has(variable)) {
                addDiagnostic('duplicate-variable', `Duplicate variable name: '${variable}'`, i, start, start + variable.length);
            } else {
                variableNames.add(variable);
                checkNameConflict(variable, i, start, start + variable.length, 'variable');
            }
            return;
        }

        // Handle differential equations and track their variables (dx/dt = ...)
        const derivMatch = trimmed.match(/^d([a-zA-Z_][a-zA-Z0-9_]*)\/dt\s*=/);
        if (derivMatch) {
            const varName = derivMatch[1];
            const start = derivMatch.index || 1;
            // +1 offset because we need to skip the 'd' prefix to get to the actual variable name
            handleDifferentialEquation(varName, i, start, 'standard', 1, 0);
            return;
        }

        // Handle function definitions
        const funcMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=/);
        if (funcMatch) {
            const funcName = funcMatch[1].toLowerCase();
            const start = trimmed.indexOf(funcName);
            if (functionNames.has(funcName)) {
                addDiagnostic('conflict', `Duplicate function name: '${funcName}'`, i, start, start + funcName.length);
            } else {
                functionNames.add(funcName);
                checkNameConflict(funcName, i, start, start + funcName.length, 'variable');
            }
        }
    });

    return diagnostics;
}
