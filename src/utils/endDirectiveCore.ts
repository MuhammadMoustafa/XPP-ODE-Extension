import { isCommentLine } from './lineUtils';

export interface EndDirectiveResult {
    message: string;
    line: number;
    start: number;
    end: number;
}

/**
 * Checks that the file ends with its end directive ("done" for .ode, "#done" for .inc) and that
 * nothing but comments and blank lines follows it, since XPP silently ignores everything after it.
 */
export function checkEndDirective(lines: string[], isIncFile: boolean): EndDirectiveResult[] {
    const directive = isIncFile ? '#done' : 'done';
    const isDirective = (line: string) => {
        const trimmed = line.trim().toLowerCase();
        return trimmed === directive || (!isIncFile && trimmed === 'd');
    };

    const doneIndex = lines.findIndex(isDirective);
    if (doneIndex === -1) {
        const lastLine = Math.max(0, lines.length - 1);
        return [{
            message: `Missing "${directive}" at the end of the ${isIncFile ? '.inc' : '.ode'} file`,
            line: lastLine,
            start: 0,
            end: (lines[lastLine] ?? '').length,
        }];
    }

    const results: EndDirectiveResult[] = [];
    for (let i = doneIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || isCommentLine(line)) continue;
        results.push({
            message: `Code after "${directive}" is ignored by XPP; only comments are allowed here`,
            line: i,
            start: line.search(/\S/),
            end: line.length,
        });
    }
    return results;
}
