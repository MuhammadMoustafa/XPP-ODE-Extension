/**
 * How XPP's expression parser groups "^", comparisons and unary minus. Every rule below was
 * confirmed by compiling the expression with `add_expr()` and running it through `evaluate()` in
 * xppautX (core/parserslow2.c); "^" and unary minus are pinned in its tests/test_parser.c so that
 * nobody "corrects" them. This is long-standing upstream XPPAUT behaviour that real models depend
 * on: this file only makes it visible.
 *
 * The whole thing follows from one table. Priority 7 is "^", "**" and every comparison ("<", ">",
 * "<=", ">=", "=="); priority 6 is "*", "/", "&" and unary minus, which is its own operator
 * ("~"); priority 4 is binary "+", "-" and "|". So comparisons bind tighter than all arithmetic,
 * which is the opposite of every other language:
 *
 *  - "^" groups to the LEFT, so "2^3^2" is "(2^3)^2" = 64, not "2^(3^2)" = 512.
 *  - Unary minus is weaker than "^": "-2^2" is "-(2^2)" = -4, not "(-2)^2" = 4. Usually harmless
 *    (`exp(-x^2)` means what it looks like), so this is reported quietly.
 *  - A comparison next to any arithmetic is regrouped: "2*3<4" is "2*(3<4)" = 2, not 0; "3-1<2" is
 *    "3-(1<2)" = 2, not 0; "1+2<3+4" is "1+(2<3)+4" = 6, not 1; and "1/2<1" is "1/(2<1)", a
 *    division by zero. The unary-minus case is the same rule: "-1<0" is "-(1<0)" = -0, i.e. FALSE
 *    even though -1 really is below 0, and "-1>=0" is "-(1>=0)" = -1, i.e. TRUE. All of these
 *    silently take the wrong branch of an "if", so they are reported louder.
 *
 * Operators weaker than a comparison are unaffected and need no parentheses: "1<2&3<4" is
 * "(1<2)&(3<4)", and "2^2<3" is "(2^2)<3", both as expected. But "&" and "|" themselves sit among
 * the arithmetic, so "1+1&1" is "1+(1&1)" = 2 and "a|b-c" is "(a|b)-c".
 *
 * An "if" is only understood as "if(c)then(a)else(b)", every part in brackets, and an operator
 * after the else part applies to the whole "if": "if(1>0)then(10)else(20)+5" is 15. A zero
 * divisor is silently replaced by a tiny number, so "1/0" is 4.48e14 and "0/0" is 0.
 *
 * And one hard error. A sign is only a unary minus at the start of an expression, after "(" or
 * after ","; anywhere else XPP refuses the expression and the file does not load at all
 * ("ERROR compiling X'"). So "2*-3", "x^-2", "2+-3", "2--3", "a>-1" and "--2" are all errors,
 * as is a unary "+" anywhere, which XPP has no operator for. So are "&&", "||", a "!" meaning
 * "not" and "!=": the table lists "!=", but the tokenizer stops at the "!" and never reaches it.
 *
 * Note that "1e-3" is a single number: its "-" belongs to the exponent, and "1e-3^2" is
 * "(1e-3)^2" = 1e-6. Only a sign that stands on its own is an operator.
 */
import { XppModel, ExpressionSegment } from './xppModel';

export type OperatorFinding =
    /** "a^b^c": an unparenthesised "^" chain, which XPP groups to the left. */
    | 'power-associativity'
    /** "-a^b": XPP reads "-(a^b)". */
    | 'unary-minus-power'
    /** "a*b<c": the comparison binds tighter than the arithmetic beside it. */
    | 'comparison-precedence'
    /** "a<b<c": XPP reads "(a<b)<c", comparing the first result with "c". */
    | 'chained-comparison'
    /** "2*-3": a sign where XPP allows none. The file will not load. */
    | 'unary-sign'
    /** "!=", "&&", "||" or "!": operators XPP does not have. The file will not load. */
    | 'unsupported-operator'
    /** "a+b&c" or "a|b-c": "&" and "|" are regrouped with the arithmetic beside them. */
    | 'logical-precedence'
    /** "if c then a else b" or an "if" without "else". The file will not load. */
    | 'if-syntax'
    /** "if(c)then(a)else(b)+5": the "+5" applies to the whole "if", not to "b". */
    | 'if-trailing-operator'
    /** "x/0": XPP silently divides by a tiny number instead. */
    | 'division-by-zero';

export interface OperatorResult {
    message: string;
    line: number;
    start: number;
    end: number;
    type: OperatorFinding;
    /** Text that fixes the finding when it replaces the reported span, if there is a sure fix. */
    replacement?: string;
}

/** The default severity of each finding; the errors are what XPP itself rejects. */
export const DEFAULT_SEVERITY: Record<OperatorFinding, 'error' | 'warning' | 'information'> = {
    'unary-sign': 'error',
    'unsupported-operator': 'error',
    'if-syntax': 'error',
    'comparison-precedence': 'warning',
    'chained-comparison': 'warning',
    'logical-precedence': 'warning',
    'division-by-zero': 'warning',
    'if-trailing-operator': 'information',
    'unary-minus-power': 'information',
    'power-associativity': 'information',
};

const SIGN_NOTE = [
    '',
    'A sign is only allowed at the start of an expression, after `(` or after `,`.',
    '`2^-3`, `2*-3` and `x<-1` are syntax errors and the file will not load —',
    'write `2^(-3)`, `2*(-3)`, `x<(-1)`.',
    '',
    'This is long-standing XPPAUT behaviour, not a bug — existing models rely on it.',
].join('\n');

/** Worded for a hover over "^" or "**". */
export const POWER_HOVER_MARKDOWN = [
    '**`^` — power** (`**` is the same operator)',
    '',
    'Priority 7, and it groups to the **left**. Unary minus is only priority 6,',
    'so a leading minus applies to the whole power:',
    '',
    '| you write | XPP reads it as | value |',
    '| --- | --- | --- |',
    '| `2^3^2` | `(2^3)^2` | `64` (not `512`) |',
    '| `2^3^2^2` | `((2^3)^2)^2` | `4096` |',
    '| `-2^2` | `-(2^2)` | `-4` (not `4`) |',
    SIGN_NOTE,
].join('\n');

/** Worded for a hover over a comparison operator. */
export const COMPARISON_HOVER_MARKDOWN = [
    '**comparison** — priority 7, the same as `^`',
    '',
    'That is **higher** than `*`, `/`, `+`, `-` and unary minus, so XPP evaluates the',
    'comparison first and applies the arithmetic to its `0` or `1` result:',
    '',
    '| you write | XPP reads it as | value |',
    '| --- | --- | --- |',
    '| `2*3<4` | `2*(3<4)` | `2` (not `0`) |',
    '| `3-1<2` | `3-(1<2)` | `2` (not `0`) |',
    '| `1+2<3+4` | `1+(2<3)+4` | `6` (not `1`) |',
    '| `1/2<1` | `1/(2<1)` | division by zero |',
    '| `-1<0` | `-(1<0)` | `0` — **false**, not true |',
    '| `-1>=0` | `-(1>=0)` | `-1` — **true**, not false |',
    '',
    'Bracket the operands you want compared: `(2*3)<4`. Operators weaker than a',
    'comparison are fine as they are: `1<2&3<4` is `(1<2)&(3<4)`, and `2^2<3` is `(2^2)<3`.',
    SIGN_NOTE,
].join('\n');

/** Worded for a hover over "&" or "|". */
export const LOGICAL_HOVER_MARKDOWN = [
    '**`&` — and, `|` — or**',
    '',
    '`&` has priority 6, the same as `*` and `/`; `|` has priority 4, the same as `+` and `-`.',
    'Operators of equal priority group to the left, so these mix with arithmetic:',
    '',
    '| you write | XPP reads it as | value |',
    '| --- | --- | --- |',
    '| `1+1&1` | `1+(1&1)` | `2` (not `1`) |',
    '| `a&b*c` | `(a&b)*c` | |',
    '| `a\\|b-c` | `(a\\|b)-c` | `0` for a=2, b=0, c=1 (not `1`) |',
    '',
    'Comparisons are stronger, so `x<1&y>2` is `(x<1)&(y>2)` as expected.',
    'Bracket the operands when arithmetic is involved: `(a+b)&c`, `a|(b-c)`.',
    '',
    'XPP has no `&&`, `||`, `!` or `!=`, and a file using them will not load:',
    'write `&`, `|`, `not(a)` and `not(a==b)`.',
].join('\n');

/** Worded for a hover over an operator XPP does not have. */
export const UNSUPPORTED_HOVER_MARKDOWN = [
    '**not an XPP operator** — the file will not load',
    '',
    '| you write | write instead |',
    '| --- | --- |',
    '| `a!=b` | `not(a==b)` |',
    '| `a&&b` | `a&b` |',
    '| `a\\|\\|b` | `a\\|b` |',
    '| `!a` | `not(a)` |',
].join('\n');

type TokenKind = 'power' | 'operator' | 'open' | 'close' | 'operand' | 'comma';

interface Token {
    kind: TokenKind;
    text: string;
    start: number;
    end: number;
    /** Bracket nesting depth the token sits at; a bracket pair's contents are one level deeper. */
    depth: number;
}

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
/** Operator characters XPP accepts outside "^": arithmetic, comparison and logic. */
const OPERATOR_CHARS = new Set(['+', '-', '*', '/', '>', '<', '=', '&', '|', '!', '~']);
/**
 * Priority-7 comparisons, which bind tighter than every arithmetic operator. "!=" is not one:
 * XPP's tokenizer never reaches it (see UNSUPPORTED).
 */
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==']);
/** The arithmetic a comparison steals its operand from; "&" and "|" are weaker and are fine. */
const ARITHMETIC = new Set(['+', '-', '*', '/']);
/** Operators people bring from other languages that XPP refuses. */
const UNSUPPORTED = new Set(['!=', '&&', '||', '!']);
/** A number that is exactly zero, e.g. "0", "0.0", ".0" or "0e5". */
const ZERO = /^(?:0+\.?0*|\.0+)(?:[eE][+-]?\d+)?$/;

function isComparison(token: Token): boolean {
    return token.kind === 'operator' && COMPARISONS.has(token.text);
}

/**
 * An XPP number, including an "e"/"E" exponent with its own sign. Matching the exponent here is
 * what keeps "1e-3" one token, so its "-" is never mistaken for an operator.
 */
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const NAME = /^[a-zA-Z_][a-zA-Z0-9_]*/;

function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let depth = 0;

    for (let i = 0; i < text.length;) {
        const char = text[i];
        if (/\s/.test(char)) { i++; continue; }

        if (text.startsWith('**', i)) {
            tokens.push({ kind: 'power', text: '**', start: i, end: i + 2, depth });
            i += 2;
            continue;
        }
        if (char === '^') {
            tokens.push({ kind: 'power', text: '^', start: i, end: i + 1, depth });
            i++;
            continue;
        }
        if (OPEN.has(char)) {
            tokens.push({ kind: 'open', text: char, start: i, end: i + 1, depth });
            depth++;
            i++;
            continue;
        }
        if (CLOSE.has(char)) {
            depth = Math.max(0, depth - 1);
            tokens.push({ kind: 'close', text: char, start: i, end: i + 1, depth });
            i++;
            continue;
        }
        if (char === ',') {
            tokens.push({ kind: 'comma', text: char, start: i, end: i + 1, depth });
            i++;
            continue;
        }
        if (OPERATOR_CHARS.has(char)) {
            let end = i + 1;
            if (text[end] === '=') end++; // "<=", ">=", "==", "!="
            else if ((char === '&' || char === '|') && text[end] === char) end++; // "&&", "||"
            tokens.push({ kind: 'operator', text: text.substring(i, end), start: i, end, depth });
            i = end;
            continue;
        }

        const number = NUMBER.exec(text.substring(i));
        const name = number ? undefined : NAME.exec(text.substring(i));
        const match = number ?? name;
        if (match) {
            tokens.push({ kind: 'operand', text: match[0], start: i, end: i + match[0].length, depth });
            i += match[0].length;
            continue;
        }
        i++; // anything else (e.g. "'" or "#" inside braces) is not an operator or operand
    }
    return tokens;
}

/**
 * The index just past the operand that starts at `index`: a name or number together with any
 * call/index brackets that follow it, or a whole bracketed group. Returns -1 when there is none.
 */
function operandEnd(tokens: Token[], index: number): number {
    let i = index;
    if (i >= tokens.length) return -1;
    if (tokens[i].kind === 'open') {
        const depth = tokens[i].depth;
        i++;
        while (i < tokens.length && !(tokens[i].kind === 'close' && tokens[i].depth === depth)) i++;
        return i < tokens.length ? i + 1 : -1;
    }
    if (tokens[i].kind !== 'operand') return -1;
    i++;
    while (i < tokens.length && tokens[i].kind === 'open' && tokens[i].depth === tokens[index].depth) {
        const next = operandEnd(tokens, i);
        if (next === -1) return -1;
        i = next;
    }
    return i;
}

/** Source text of tokens[from..to), with whitespace squeezed out so messages stay readable. */
function sliceText(text: string, tokens: Token[], from: number, to: number): string {
    return text.substring(tokens[from].start, tokens[to - 1].end).replace(/\s+/g, '');
}

/** True when an operand is expected at `index`, i.e. a sign there would be a unary one. */
function inOperandPosition(tokens: Token[], index: number): boolean {
    if (index === 0) return true;
    const previous = tokens[index - 1].kind;
    return previous !== 'operand' && previous !== 'close';
}

/**
 * True when a unary minus at `index` is one XPP accepts: only at the start of the expression,
 * after "(" or after ",". Everywhere else it is a syntax error, reported separately.
 */
function isLegalUnaryMinus(tokens: Token[], index: number): boolean {
    if (tokens[index].text !== '-') return false;
    if (index === 0) return true;
    const previous = tokens[index - 1].kind;
    return previous === 'open' || previous === 'comma';
}

type Finding = Omit<OperatorResult, 'line' | 'start' | 'end'> & { start: number; end: number };

/** Findings for one expression, as offsets into `text`. */
export function checkExpression(text: string): Finding[] {
    const tokens = tokenize(text);
    const results: Finding[] = [];
    let comparisonsReportedThrough = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.kind === 'operator' && UNSUPPORTED.has(token.text)) {
            results.push(unsupportedOperator(tokens, i, text));
            continue;
        }
        if (token.kind === 'operator' && (token.text === '&' || token.text === '|')) {
            const finding = logicalFinding(tokens, i, text);
            if (finding) results.push(finding);
            continue;
        }
        if (token.kind === 'operator' && token.text === '/') {
            const finding = divisionByZero(tokens, i);
            if (finding) results.push(finding);
            continue;
        }
        if (isWord(token, 'if')) {
            const finding = ifFinding(tokens, i, text);
            if (finding) results.push(finding);
            continue;
        }

        if (token.kind === 'operator' && (token.text === '-'|| token.text === '+') && inOperandPosition(tokens, i)) {
            if (!isLegalUnaryMinus(tokens, i)) {
                results.push(signError(tokens, i, text));
                continue;
            }
            const finding = unaryMinusFinding(tokens, i, text);
            if (finding) results.push(finding);
            continue;
        }

        if (isComparison(token)) {
            if (i < comparisonsReportedThrough) continue;
            const finding = comparisonFinding(tokens, i, text);
            if (finding) {
                results.push(finding.result);
                comparisonsReportedThrough = finding.chainEnd; // one finding per comparison chain
            }
            continue;
        }

        if (token.kind !== 'power') continue;
        const finding = powerChainFinding(tokens, i, text);
        if (finding) {
            results.push(finding.result);
            i = finding.lastToken; // one finding per chain, not one per "^"
        }
    }

    return results;
}

/** "2*-3": XPP has no unary operator in this position and refuses the whole file. */
function signError(tokens: Token[], index: number, text: string): Finding {
    const token = tokens[index];
    const end = operandEnd(tokens, index + 1);
    const operand = end === -1 ? '' : sliceText(text, tokens, index + 1, end);
    const shown = `${token.text}${operand}`;
    const previous = index > 0 ? tokens[index - 1].text : '';
    // Bracketing rescues a minus, but not a plus: XPP rejects "(+2)" as well.
    const reason = token.text === '+'
        ? 'XPP has no unary "+" at all, not even inside brackets'
        : `XPP only allows a sign at the start of an expression, after "(" or after ","; here it follows "${previous}"`;
    const fix = token.text === '+'
        ? `Drop the "+"${operand ? `: write "${operand}".` : '.'}`
        : operand ? `Write "(-${operand})" instead.` : 'Remove the sign or bracket it.';
    const spanEnd = end === -1 ? token.end : tokens[end - 1].end;
    return {
        type: 'unary-sign',
        start: token.start,
        end: spanEnd,
        message: `XPP cannot parse "${shown}" here, and the file will not load ("ERROR compiling ..."). ${reason}. ${fix}`,
        ...(operand ? { replacement: signReplacement(token.text, text.substring(tokens[index + 1].start, spanEnd)) } : {}),
    };
}

/** "-x" becomes "(-x)", which XPP accepts; "+x" becomes "x", since XPP has no unary "+" at all. */
function signReplacement(sign: string, operand: string): string {
    return sign === '-' ? `(-${operand})` : operand;
}

/**
 * True when an operand next to this token is complete: only "&", "|", a bracket, a comma or the
 * end of the expression is there to take it. Only then is rewriting "a!=b" or "!a" safe.
 */
function isOperandBoundary(token: Token | undefined): boolean {
    return token === undefined || token.kind === 'open' || token.kind === 'close' || token.kind === 'comma' ||
        (token.kind === 'operator' && (token.text === '&' || token.text === '|'));
}

const NOT_LOADING = 'is not an XPP operator, and the file will not load';

/** "!=", "&&", "||" and "!": XPP has none of them and refuses the whole file. */
function unsupportedOperator(tokens: Token[], index: number, text: string): Finding {
    const token = tokens[index];
    if (token.text === '!=') return notEqualFinding(tokens, index, text);
    if (token.text === '&&' || token.text === '||') {
        const single = token.text.charAt(0);
        return {
            type: 'unsupported-operator',
            start: token.start,
            end: token.end,
            message: `"${token.text}" ${NOT_LOADING} ("Illegal syntax"). XPP's "${single === '&' ? 'and' : 'or'}" ` +
                `is a single "${single}": write "${single}".`,
            replacement: single,
        };
    }
    // "!a" becomes "not(a)", and "!(a<b)" becomes "not(a<b)".
    const end = operandEnd(tokens, index + 1);
    const sure = end !== -1 && isOperandBoundary(tokens[end]);
    const operand = sure ? text.substring(tokens[index + 1].start, tokens[end - 1].end) : '';
    const negated = !sure ? 'not(...)' : tokens[index + 1].text === '(' ? `not${operand}` : `not(${operand})`;
    return {
        type: 'unsupported-operator',
        start: token.start,
        end: sure ? tokens[end - 1].end : token.end,
        message: `"!" ${NOT_LOADING} ("illegal expression: !"). XPP writes "not" as a function: ` +
            `write "${negated.replace(/\s+/g, '')}".`,
        ...(sure ? { replacement: negated } : {}),
    };
}

/** "a!=b" becomes "not(a==b)", but only when both operands are certain to be complete. */
function notEqualFinding(tokens: Token[], index: number, text: string): Finding {
    const token = tokens[index];
    const leftStart = operandStartBefore(tokens, index);
    const rightEnd = operandEnd(tokens, index + 1);
    const reason = `"!=" ${NOT_LOADING} ("illegal expression"): XPP's parser stops at the "!".`;
    const sure = leftStart !== -1 && rightEnd !== -1 &&
        isOperandBoundary(tokens[leftStart - 1]) && isOperandBoundary(tokens[rightEnd]);
    if (!sure) {
        return { type: 'unsupported-operator', start: token.start, end: token.end, message: `${reason} Write "not(a==b)" instead.` };
    }
    const raw = (from: number, to: number) => text.substring(tokens[from].start, tokens[to - 1].end);
    const shown = `not(${sliceText(text, tokens, leftStart, index)}==${sliceText(text, tokens, index + 1, rightEnd)})`;
    return {
        type: 'unsupported-operator',
        start: tokens[leftStart].start,
        end: tokens[rightEnd - 1].end,
        message: `${reason} Write "${shown}" instead.`,
        replacement: `not(${raw(leftStart, index)}==${raw(index + 1, rightEnd)})`,
    };
}

/** XPP's priority of a binary operator: 7 for "^" and comparisons, 6 for "*", "/" and "&", else 4. */
function priority(token: Token): number {
    if (token.kind === 'power' || isComparison(token)) return 7;
    return token.text === '*' || token.text === '/' || token.text === '&' ? 6 : 4;
}

/** True when tokens[index] is a binary operator at `depth`. */
function isBinaryAt(tokens: Token[], index: number, depth: number): boolean {
    const token = tokens[index];
    return token !== undefined && token.depth === depth && (token.kind === 'operator' || token.kind === 'power') &&
        !inOperandPosition(tokens, index);
}

const LOGICAL_NOTE =
    '"&" has the same priority as "*" and "/", and "|" the same as "+" and "-", so XPP does not ' +
    'finish the arithmetic around them first.';

/**
 * "a+b&c" and "a|b-c": the usual reading does all arithmetic before "&" and "|", XPP does not.
 * Reported only where the two readings group differently; "a*b&c" and "a+b|c" agree.
 */
function logicalFinding(tokens: Token[], index: number, text: string): Finding | undefined {
    const op = tokens[index];
    const depth = op.depth;
    const leftStart = operandStartBefore(tokens, index);
    let rightEnd = operandEnd(tokens, index + 1);
    if (leftStart === -1 || rightEnd === -1) return undefined;

    // Right: what binds tighter than "op" is its operand in both readings. Arithmetic after that is
    // applied to the result of "op" by XPP, but belongs to the operand in the usual reading.
    while (isBinaryAt(tokens, rightEnd, depth) && priority(tokens[rightEnd]) > priority(op)) {
        const next = operandEnd(tokens, rightEnd + 1);
        if (next === -1) return undefined;
        rightEnd = next;
    }
    const right = sliceText(text, tokens, index + 1, rightEnd);
    if (isBinaryAt(tokens, rightEnd, depth) && ARITHMETIC.has(tokens[rightEnd].text)) {
        const rhsEnd = operandEnd(tokens, rightEnd + 1);
        if (rhsEnd === -1) return undefined;
        const left = sliceText(text, tokens, leftStart, index);
        const next = tokens[rightEnd].text;
        const rhs = sliceText(text, tokens, rightEnd + 1, rhsEnd);
        return {
            type: 'logical-precedence',
            start: tokens[leftStart].start,
            end: tokens[rhsEnd - 1].end,
            message: `XPP reads "${left}${op.text}${right}${next}${rhs}" as "(${left}${op.text}${right})${next}${rhs}", ` +
                `not "${left}${op.text}(${right}${next}${rhs})". ${LOGICAL_NOTE} ${example(true, '"1+1&1" is 2, not 1')}`,
        };
    }

    // Left, for "&" only ("|" is as weak as "+" and "-"): XPP's left operand stops at a "+" or "-",
    // which is then applied to the result of "&". A "&" before it was reported already.
    if (op.text !== '&') return undefined;
    let from = leftStart;
    while (isBinaryAt(tokens, from - 1, depth) && priority(tokens[from - 1]) >= 6 && tokens[from - 1].text !== '&') {
        const previous = operandStartBefore(tokens, from - 1);
        if (previous === -1) return undefined;
        from = previous;
    }
    const before = tokens[from - 1];
    if (!isBinaryAt(tokens, from - 1, depth) || !ARITHMETIC.has(before.text)) return undefined;
    const lhsStart = operandStartBefore(tokens, from - 1);
    if (lhsStart === -1) return undefined;
    const lhs = `${sliceText(text, tokens, lhsStart, from - 1)}${before.text}`;
    const middle = sliceText(text, tokens, from, index);
    return {
        type: 'logical-precedence',
        start: tokens[lhsStart].start,
        end: tokens[rightEnd - 1].end,
        message: `XPP reads "${lhs}${middle}&${right}" as "${lhs}(${middle}&${right})", not "(${lhs}${middle})&${right}". ` +
            `${LOGICAL_NOTE} ${example(`${lhs}${middle}&${right}` !== '1+1&1', '"1+1&1" is 2, not 1')}`,
    };
}

/** "x/0", "x/0.0", "x/(0)": XPP replaces a zero divisor by about 2.2e-15 and says nothing. */
function divisionByZero(tokens: Token[], index: number): Finding | undefined {
    const isZero = (token: Token | undefined) => token?.kind === 'operand' && ZERO.test(token.text);
    const bracketed = tokens[index + 1]?.text === '(' && isZero(tokens[index + 2]) && tokens[index + 3]?.text === ')';
    if (!bracketed && !isZero(tokens[index + 1])) return undefined;
    return {
        type: 'division-by-zero',
        start: tokens[index].start,
        end: tokens[index + (bracketed ? 3 : 1)].end,
        message: 'Division by zero. XPP neither stops nor warns: it silently replaces a zero divisor by a tiny ' +
            'number (about 2.2e-15), so "1/0" is about 4.5e14 and "0/0" is 0.',
    };
}

/** True when the token is the word `word` in any case, as XPP is case-insensitive. */
function isWord(token: Token | undefined, word: string): boolean {
    return token?.kind === 'operand' && token.text.toLowerCase() === word;
}

/** The index just past "word(...)" at `index`, or -1 when it is not written that way. */
function bracketedPart(tokens: Token[], index: number, word: string): number {
    if (!isWord(tokens[index], word) || tokens[index + 1]?.text !== '(') return -1;
    return operandEnd(tokens, index + 1);
}

/**
 * The "if" at `index`. XPP only understands "if(c)then(a)else(b)": it removes all spaces before
 * parsing, so "then 10 else 20" is "then10else20", and "10else" reads as a number with an exponent.
 */
function ifFinding(tokens: Token[], index: number, text: string): Finding | undefined {
    let end = index;
    for (const word of ['if', 'then', 'else']) {
        const next = bracketedPart(tokens, end, word);
        if (next === -1) return ifSyntaxError(tokens, index, end, word === 'else' && tokens[end]?.kind !== 'operand');
        end = next;
    }
    return ifTrailingOperator(tokens, index, end, text);
}

/** An "if" XPP cannot parse, reported from the "if" to the part that went wrong. */
function ifSyntaxError(tokens: Token[], index: number, failedAt: number, missingElse: boolean): Finding {
    const form = 'XPP needs if(...)then(...)else(...), each part in brackets.';
    return {
        type: 'if-syntax',
        start: tokens[index].start,
        end: tokens[Math.min(failedAt, tokens.length - 1)].end,
        message: missingElse
            ? `This "if" has no else part, and the file will not load ("If statement missing ELSE or THEN"). ${form}`
            : `XPP cannot parse this "if", and the file will not load. ${form} Spaces do not separate the ` +
              'parts: XPP removes them first, so "then 10 else 20" is read as "then10else20".',
    };
}

/** "if(c)then(a)else(b)+5": the operator applies to the whole "if", not to its else part. */
function ifTrailingOperator(tokens: Token[], index: number, end: number, text: string): Finding | undefined {
    const op = tokens[end];
    if (op?.kind !== 'operator' && op?.kind !== 'power') return undefined;
    const rhsEnd = operandEnd(tokens, end + 1);
    if (rhsEnd === -1) return undefined;
    const whole = sliceText(text, tokens, index, end);
    const tail = sliceText(text, tokens, end, rhsEnd);
    return {
        type: 'if-trailing-operator',
        start: tokens[index].start,
        end: tokens[rhsEnd - 1].end,
        message: `XPP applies "${tail}" to the whole if, not to its else part: "${whole}${tail}" is "(${whole})${tail}". ` +
            `Write the brackets to make that visible, or move "${tail}" into the else part if that is what you meant.`,
    };
}

/** "-a^b": the minus applies to the whole power, not just to "a". */
function unaryMinusFinding(tokens: Token[], index: number, text: string): Finding | undefined {
    const minus = tokens[index];
    const baseEnd = operandEnd(tokens, index + 1);
    if (baseEnd === -1 || baseEnd >= tokens.length) return undefined;
    const operator = tokens[baseEnd];
    if (operator.kind !== 'power' || operator.depth !== minus.depth) return undefined;

    const rightEnd = operandEnd(tokens, baseEnd + 1);
    if (rightEnd === -1) return undefined;

    const left = sliceText(text, tokens, index + 1, baseEnd);
    const right = sliceText(text, tokens, baseEnd + 1, rightEnd);
    const op = operator.text;
    return {
        start: minus.start,
        end: tokens[rightEnd - 1].end,
        type: 'unary-minus-power',
        message:
            `XPP reads "-${left}${op}${right}" as "-(${left}${op}${right})", not "(-${left})${op}${right}": ` +
            `unary minus binds more weakly than "${op}". ` +
            example(`${left}${op}${right}` !== '2^2', '"-2^2" is -4, not 4'),
    };
}

/**
 * The priority-7 chain a comparison belongs to. "^" is priority 7 too, so in "a^2<b" the whole
 * "a^2" is the comparison's left operand. Returns the chain's first and last token index.
 */
function comparisonChain(tokens: Token[], index: number): { from: number; to: number } | undefined {
    const depth = tokens[index].depth;
    const binds = (token: Token) => token.depth === depth && (token.kind === 'power' || isComparison(token));

    let from = operandStartBefore(tokens, index);
    if (from === -1) return undefined;
    while (from > 0 && binds(tokens[from - 1])) {
        const previous = operandStartBefore(tokens, from - 1);
        if (previous === -1) break;
        from = previous;
    }

    let to = operandEnd(tokens, index + 1);
    if (to === -1) return undefined;
    while (to < tokens.length && binds(tokens[to])) {
        const next = operandEnd(tokens, to + 1);
        if (next === -1) break;
        to = next;
    }
    return { from, to };
}

const BRANCH_NOTE =
    'That silently flips the branch an "if" takes: "-1<0" is -0, i.e. false, even though -1 really ' +
    'is below 0, and "-1>=0" is -1, i.e. true.';

/**
 * "a*b<c" and "-a<b": a comparison has priority 7 and every arithmetic operator 4 or 6, so the
 * comparison is evaluated first and the arithmetic is applied to its 0 or 1 result. Reported for
 * the operator before the comparison chain if there is one, otherwise for the one after it.
 */
function comparisonFinding(tokens: Token[], index: number, text: string): { result: Finding; chainEnd: number } | undefined {
    const chain = comparisonChain(tokens, index);
    if (!chain) return undefined;
    const { from, to } = chain;
    const depth = tokens[index].depth;
    const comparison = sliceText(text, tokens, from, to);

    // "a<b<c" is "(a<b)<c": the second comparison tests the first one's 0 or 1 against "c", so
    // "3<2<1" is "(3<2)<1" = "0<1" = 1, i.e. TRUE although neither "3<2" nor "2<1" holds.
    const second = tokens.slice(index + 1, to).findIndex(token => isComparison(token) && token.depth === depth);
    if (second !== -1) {
        const secondIndex = index + 1 + second;
        const left = sliceText(text, tokens, from, index);
        const middle = sliceText(text, tokens, index + 1, secondIndex);
        const right = sliceText(text, tokens, secondIndex + 1, to);
        const op1 = tokens[index].text;
        const op2 = tokens[secondIndex].text;
        return {
            chainEnd: to,
            result: {
                type: 'chained-comparison',
                start: tokens[from].start,
                end: tokens[to - 1].end,
                message:
                    `XPP reads "${left}${op1}${middle}${op2}${right}" as "(${left}${op1}${middle})${op2}${right}": ` +
                    `comparisons group to the left, so the second one tests the first one's 0 or 1 against ` +
                    `"${right}", not "${middle}". For example "3<2<1" is 1, i.e. true, although neither "3<2" nor ` +
                    `"2<1" holds. Write "(${left}${op1}${middle})&(${middle}${op2}${right})" if you meant both.`,
            },
        };
    }
    const neighbours = (token: Token | undefined) =>
        token !== undefined && token.depth === depth && token.kind === 'operator' && ARITHMETIC.has(token.text);

    const before = from > 0 ? tokens[from - 1] : undefined;
    if (neighbours(before) && before) {
        // A sign here has no left operand of its own: it negates the comparison's whole result.
        if (inOperandPosition(tokens, from - 1)) {
            const left = sliceText(text, tokens, from, index);
            const rest = comparison.substring(left.length);
            return {
                chainEnd: to,
                result: {
                    type: 'comparison-precedence',
                    start: before.start,
                    end: tokens[to - 1].end,
                    message:
                        `XPP reads "${before.text}${comparison}" as "${before.text}(${comparison})", not ` +
                        `"(${before.text}${left})${rest}": a comparison binds tighter than a sign, so the sign is ` +
                        `applied to the comparison's 0 or 1 result. ${BRANCH_NOTE} ` +
                        `Write "(${before.text}${left})${rest}" if that is what you meant.`,
                },
            };
        }
        const lhsStart = operandStartBefore(tokens, from - 1);
        const lhs = lhsStart === -1 ? '...' : sliceText(text, tokens, lhsStart, from - 1);
        const op = before.text;
        const left = sliceText(text, tokens, from, index);
        const rest = comparison.substring(left.length);
        return {
            chainEnd: to,
            result: {
                type: 'comparison-precedence',
                start: lhsStart === -1 ? before.start : tokens[lhsStart].start,
                end: tokens[to - 1].end,
                message:
                    `XPP gives a comparison a higher priority than "${op}", so it reads "${comparison}" first: ` +
                    `"${lhs}${op}${comparison}" is "${lhs}${op}(${comparison})", not "(${lhs}${op}${left})${rest}". ` +
                    `The arithmetic is applied to the comparison's 0 or 1 result. ` +
                    `${example(true, '"2*3<4" is 2, not 0, and "3-1<2" is 2, not 0')}`,
            },
        };
    }

    const after = to < tokens.length ? tokens[to] : undefined;
    if (neighbours(after) && after && !inOperandPosition(tokens, to)) {
        const rhsEnd = operandEnd(tokens, to + 1);
        if (rhsEnd === -1) return undefined;
        const rhs = sliceText(text, tokens, to + 1, rhsEnd);
        const op = after.text;
        const right = sliceText(text, tokens, index + 1, to);
        return {
            chainEnd: rhsEnd,
            result: {
                type: 'comparison-precedence',
                start: tokens[from].start,
                end: tokens[rhsEnd - 1].end,
                message:
                    `XPP gives a comparison a higher priority than "${op}", so it reads "${comparison}" first: ` +
                    `"${comparison}${op}${rhs}" is "(${comparison})${op}${rhs}", not a comparison against ` +
                    `"${right}${op}${rhs}". The arithmetic is applied to the comparison's 0 or 1 result. ` +
                    `${example(true, '"1+2<3+4" is 6, not 1')}`,
            },
        };
    }
    return undefined;
}

/** "a^b^c": an unparenthesised chain, which XPP groups to the left. */
function powerChainFinding(tokens: Token[], index: number, text: string): { result: Finding; lastToken: number } | undefined {
    const token = tokens[index];
    const baseStart = operandStartBefore(tokens, index);
    const firstEnd = operandEnd(tokens, index + 1);
    if (baseStart === -1 || firstEnd === -1) return undefined;
    if (firstEnd >= tokens.length || tokens[firstEnd].kind !== 'power' || tokens[firstEnd].depth !== token.depth) return undefined;

    const operands = [sliceText(text, tokens, baseStart, index), sliceText(text, tokens, index + 1, firstEnd)];
    let end = firstEnd;
    while (end < tokens.length && tokens[end].kind === 'power' && tokens[end].depth === token.depth) {
        const next = operandEnd(tokens, end + 1);
        if (next === -1) break;
        operands.push(sliceText(text, tokens, end + 1, next));
        end = next;
    }
    const power = token.text;
    return {
        lastToken: end - 1,
        result: {
            type: 'power-associativity',
            start: tokens[baseStart].start,
            end: tokens[end - 1].end,
            message:
                `XPP groups "${power}" to the left: it reads "${operands.join(power)}" as "${groupLeft(operands, power)}", ` +
                `not "${groupRight(operands, power)}" as standard maths notation would. ` +
                example(operands.join(power) !== '2^3^2', '"2^3^2" is 64, not 512'),
        },
    };
}

/** The closing sentence, with the stock example unless the expression already is that example. */
function example(include: boolean, text: string): string {
    return `${include ? `For example ${text}. ` : ''}Write the parentheses to say which you mean.`;
}

/** "a^b^c" as XPP reads it: "(a^b)^c". */
function groupLeft(operands: string[], power: string): string {
    let text = `${operands[0]}${power}${operands[1]}`;
    for (let i = 2; i < operands.length; i++) text = `(${text})${power}${operands[i]}`;
    return text;
}

/** "a^b^c" as standard maths notation reads it: "a^(b^c)". */
function groupRight(operands: string[], power: string): string {
    let text = `${operands[operands.length - 2]}${power}${operands[operands.length - 1]}`;
    for (let i = operands.length - 3; i >= 0; i--) text = `${operands[i]}${power}(${text})`;
    return text;
}

/** Index of the token that starts the operand ending just before `index`, or -1. */
function operandStartBefore(tokens: Token[], index: number): number {
    let i = index - 1;
    if (i < 0) return -1;
    if (tokens[i].kind === 'close') {
        const depth = tokens[i].depth;
        while (i >= 0 && !(tokens[i].kind === 'open' && tokens[i].depth === depth)) i--;
        if (i < 0) return -1;
    } else if (tokens[i].kind !== 'operand') {
        return -1;
    }
    // Step back over a call or index that belongs to the name, e.g. "sin(x)^2" or "v[1]^2".
    while (i > 0 && tokens[i].kind === 'open' && tokens[i - 1].kind === 'operand') i--;
    return i;
}

/**
 * Checks every expression of a parsed file. Comments, comment lines and everything after "done"
 * are already excluded by the model, so nothing inside them can be reported.
 */
export function checkOperators(model: XppModel): OperatorResult[] {
    const results: OperatorResult[] = [];
    for (const expression of model.expressions) {
        for (const finding of checkExpression(expression.text)) {
            const span = toSpan(expression, finding.start, finding.end);
            if (!span) continue;
            // A span clipped to the first line of a continued expression cannot take the replacement.
            const whole = span.end - span.start === finding.end - finding.start;
            const result: OperatorResult = { ...finding, ...span };
            if (!whole) delete result.replacement;
            results.push(result);
        }
    }
    return results;
}

/** Maps an offset range inside a segment back to a document range, clipped to its first line. */
function toSpan(expression: ExpressionSegment, start: number, end: number): { line: number; start: number; end: number } | undefined {
    const first = expression.positions[start];
    if (!first) return undefined;
    let last = first;
    for (let i = start; i < end && i < expression.positions.length; i++) {
        const position = expression.positions[i];
        if (position.line !== first.line) break; // a continued expression: mark the first line only
        last = position;
    }
    return { line: first.line, start: first.col, end: last.col + 1 };
}
