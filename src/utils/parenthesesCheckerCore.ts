import { codeLines, codePart } from './lineUtils';

export interface ParenthesesResult {
    message: string;
    line: number;
    start: number;
    end: number;
}

const PAIRS: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
const CLOSERS = new Set(Object.values(PAIRS));

/**
 * Finds unmatched or mismatched brackets. Comments and everything after "done" are ignored.
 */
export function checkParentheses(lines: string[]): ParenthesesResult[] {
    const results: ParenthesesResult[] = [];
    const stack: { char: string; line: number; index: number }[] = [];

    codeLines(lines).forEach((line, lineNumber) => {
        const code = codePart(line);

        for (let j = 0; j < code.length; j++) {
            const char = code[j];
            if (char in PAIRS) {
                stack.push({ char, line: lineNumber, index: j });
            } else if (CLOSERS.has(char)) {
                const last = stack.pop();
                if (!last || PAIRS[last.char] !== char) {
                    results.push({
                        message: `Unmatched closing parenthesis: ${char}`,
                        line: lineNumber,
                        start: j,
                        end: j + 1,
                    });
                }
            }
        }
    });

    for (const unmatched of stack) {
        results.push({
            message: `Unmatched opening parenthesis: ${unmatched.char}`,
            line: unmatched.line,
            start: unmatched.index,
            end: unmatched.index + 1,
        });
    }

    return results;
}
