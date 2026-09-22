import * as vscode from 'vscode';
import { isCommentLine, isInComment } from '../utils/lineUtils';
import { POWER_HOVER_MARKDOWN, COMPARISON_HOVER_MARKDOWN } from '../utils/operatorCheckerCore';

/**
 * Explains the two operators of an `.ode` file that are most likely to be misread: "^", which
 * groups to the left, and the comparisons, which bind tighter than every arithmetic operator.
 */
export class OperatorHoverProvider implements vscode.HoverProvider {
    public provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const line = document.lineAt(position.line).text;
        if (isCommentLine(line) || isInComment(line, position.character)) return undefined;

        const operator = operatorAt(line, position.character);
        if (!operator) return undefined;

        const contents = new vscode.MarkdownString(operator.markdown);
        contents.supportHtml = false;
        return new vscode.Hover(contents, new vscode.Range(position.line, operator.start, position.line, operator.end));
    }
}

/** Longest first, so "<=" wins over "<" and "**" over "*". */
const OPERATORS: { text: string; markdown: string }[] = [
    { text: '**', markdown: POWER_HOVER_MARKDOWN },
    { text: '<=', markdown: COMPARISON_HOVER_MARKDOWN },
    { text: '>=', markdown: COMPARISON_HOVER_MARKDOWN },
    { text: '==', markdown: COMPARISON_HOVER_MARKDOWN },
    { text: '!=', markdown: COMPARISON_HOVER_MARKDOWN },
    { text: '^', markdown: POWER_HOVER_MARKDOWN },
    { text: '<', markdown: COMPARISON_HOVER_MARKDOWN },
    { text: '>', markdown: COMPARISON_HOVER_MARKDOWN },
];

/** The operator covering `column`, or undefined. */
function operatorAt(line: string, column: number): { start: number; end: number; markdown: string } | undefined {
    // A two-character operator is also matched when the cursor sits on its second character.
    for (const start of [column - 1, column]) {
        if (start < 0) continue;
        for (const operator of OPERATORS) {
            if (!line.startsWith(operator.text, start)) continue;
            const end = start + operator.text.length;
            if (column < start || column >= end) continue;
            return { start, end, markdown: operator.markdown };
        }
    }
    return undefined;
}
