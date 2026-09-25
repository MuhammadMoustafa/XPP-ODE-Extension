import * as vscode from 'vscode';
import { collectDescriptions, DescriptionConflict, DescriptionEntry, DescriptionProblem } from '../utils/descriptionsCore';

/** Diagnostic code of a description overridden by a later one; its quick fix removes it. */
export const DESCRIPTION_OVERRIDDEN = 'description-overridden';

/** Reports descriptions written in comments that are overridden, or whose key names nothing. */
export class DescriptionChecker {
    public check(document: vscode.TextDocument): vscode.Diagnostic[] {
        const { conflicts, problems } = collectDescriptions(document.getText());
        return [
            ...groupByLoser(conflicts).map(group => conflictDiagnostic(document.uri, group)),
            ...problems.map(problemDiagnostic),
        ];
    }
}

/** One entry can lose for several names (x[1..3] against a later x[2..3]); report it once. */
function groupByLoser(conflicts: DescriptionConflict[]): DescriptionConflict[][] {
    const groups = new Map<string, DescriptionConflict[]>();
    for (const conflict of conflicts) {
        const key = `${spanKey(conflict.loser)}>${spanKey(conflict.winner)}`;
        groups.set(key, [...(groups.get(key) ?? []), conflict]);
    }
    return [...groups.values()];
}

function spanKey(entry: DescriptionEntry): string {
    return `${entry.line}:${entry.start}`;
}

function conflictDiagnostic(uri: vscode.Uri, group: DescriptionConflict[]): vscode.Diagnostic {
    const { loser, winner } = group[0];
    const names = group.map(c => `"${c.name}"`).join(', ');
    const range = new vscode.Range(loser.line, loser.start, loser.line, loser.end);
    const message = `Description of ${names} is overridden by line ${winner.line + 1}`;
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
    diagnostic.code = DESCRIPTION_OVERRIDDEN;
    diagnostic.relatedInformation = [new vscode.DiagnosticRelatedInformation(
        new vscode.Location(uri, new vscode.Range(winner.line, winner.start, winner.line, winner.end)),
        `The description of ${names} that applies`
    )];
    return diagnostic;
}

function problemDiagnostic(problem: DescriptionProblem): vscode.Diagnostic {
    const range = new vscode.Range(problem.line, problem.start, problem.line, problem.end);
    const diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Warning);
    diagnostic.code = 'description-key';
    return diagnostic;
}
