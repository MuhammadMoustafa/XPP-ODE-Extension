import { isCommentLine, isDoneLine } from './lineUtils';

export interface EndDirectiveResult {
    message: string;
    line: number;
    start: number;
    end: number;
    severity: 'error' | 'warning';
}

/**
 * Checks that the file ends with its end directive ("done" for .ode, "#done" for .inc).
 * XPP stops reading at "done", so anything after it is free text (the samples keep notes or
 * C source there); the first non-comment line after it gets a single warning.
 */
export function checkEndDirective(lines: string[], isIncFile: boolean): EndDirectiveResult[] {
    const directive = isIncFile ? '#done' : 'done';
    const isDirective = (line: string) =>
        isIncFile ? line.trim().toLowerCase() === directive : isDoneLine(line) && !line.trim().startsWith('#');

    const doneIndex = lines.findIndex(isDirective);
    if (doneIndex === -1) {
        const lastLine = Math.max(0, lines.length - 1);
        return [{
            message: `Missing "${directive}" at the end of the ${isIncFile ? '.inc' : '.ode'} file`,
            line: lastLine,
            start: 0,
            end: (lines[lastLine] ?? '').length,
            severity: 'error',
        }];
    }

    for (let i = doneIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || isCommentLine(line)) continue;
        return [{
            message: `XPP stops reading at "${directive}": this and everything below it is not part of the model`,
            line: i,
            start: line.search(/\S/),
            end: line.length,
            severity: 'warning',
        }];
    }
    return [];
}
