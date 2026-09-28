import * as vscode from 'vscode';
import { parseXpp } from '../utils/xppModel';
import { checkOperators, DEFAULT_SEVERITY, OperatorFinding } from '../utils/operatorCheckerCore';

/** How loudly to report an advisory finding; "off" disables it. */
export type OperatorLevel = 'error' | 'warning' | 'information' | 'hint' | 'off';

const SEVERITY: Record<Exclude<OperatorLevel, 'off'>, vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    information: vscode.DiagnosticSeverity.Information,
    hint: vscode.DiagnosticSeverity.Hint,
};

/**
 * The setting that controls each advisory finding. What XPP refuses to load (`unary-sign`,
 * `unsupported-operator`, `if-syntax`) has none, and neither do `division-by-zero` and
 * `if-trailing-operator`, which are always worth seeing.
 */
const SETTING: Partial<Record<OperatorFinding, string>> = {
    'power-associativity': 'precedence.power',
    'unary-minus-power': 'precedence.power',
    'comparison-precedence': 'precedence.comparison',
    'chained-comparison': 'precedence.comparison',
    'logical-precedence': 'precedence.logical',
};

export const OPERATOR_SETTINGS = [...new Set(Object.values(SETTING))].map(name => `xpp-ode.${name}`);

export class OperatorChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const configuration = vscode.workspace.getConfiguration('xpp-ode', document);
        const diagnostics: vscode.Diagnostic[] = [];

        for (const res of checkOperators(parseXpp(document.getText()))) {
            const setting = SETTING[res.type];
            const level = setting ? configuration.get<OperatorLevel>(setting, DEFAULT_SEVERITY[res.type]) : DEFAULT_SEVERITY[res.type];
            if (level === 'off') continue;
            const range = new vscode.Range(res.line, res.start, res.line, res.end);
            const diagnostic = new vscode.Diagnostic(range, res.message, SEVERITY[level] ?? vscode.DiagnosticSeverity.Information);
            diagnostic.code = res.type;
            diagnostic.source = 'xpp';
            diagnostics.push(diagnostic);
        }
        return diagnostics;
    }
}
