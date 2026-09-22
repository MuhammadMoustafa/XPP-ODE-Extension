/**
 * Every expectation about XPP below was produced by compiling the expression with `add_expr()`
 * and running it through `evaluate()` in xppautX (core/parserslow2.c), and the "file will not
 * load" cases were confirmed by running the file through `xppautX -silent`. The comment next to
 * each case is what the parser actually returned, so a future change to these rules has to
 * disagree with the parser, not just with this file.
 */
import * as assert from 'assert';
import { parseXpp } from '../src/utils/xppModel';
import { checkOperators, checkExpression, OperatorResult, DEFAULT_SEVERITY } from '../src/utils/operatorCheckerCore';

function run(text: string): OperatorResult[] {
    return checkOperators(parseXpp(text));
}
function types(expression: string): string[] {
    return checkExpression(expression).map(r => r.type);
}
function snippet(expression: string): string[] {
    return checkExpression(expression).map(r => expression.substring(r.start, r.end));
}

suite('XPP operator rules', () => {
    suite('severities', () => {
        test('only what XPP refuses is an error; the rest is advisory', () => {
            assert.deepStrictEqual(DEFAULT_SEVERITY, {
                'unary-sign': 'error',                  // the file does not load at all
                'comparison-precedence': 'warning',     // silently takes the wrong branch
                'chained-comparison': 'warning',        // silently true when neither half holds
                'unary-minus-power': 'information',     // usually intended, e.g. exp(-x^2)
                'power-associativity': 'information',   // legal, just not what maths notation means
            });
        });
    });

    suite('"^" groups to the left', () => {
        test('flags an unparenthesised chain', () => {
            assert.deepStrictEqual(types('2^3^2'), ['power-associativity']);   // XPP: 64, not 512
            assert.deepStrictEqual(types('a^b^c'), ['power-associativity']);
            assert.deepStrictEqual(types('x ^ y ^ z'), ['power-associativity']);
        });

        test('treats "**" as the same operator', () => {
            assert.deepStrictEqual(types('2**3**2'), ['power-associativity']); // XPP: 64
            assert.deepStrictEqual(types('2^3**2'), ['power-associativity']);  // XPP: 64
        });

        test('accepts either explicit grouping', () => {
            assert.deepStrictEqual(types('(2^3)^2'), []);   // XPP: 64
            assert.deepStrictEqual(types('2^(3^2)'), []);   // XPP: 512
        });

        test('does not flag separate powers', () => {
            assert.deepStrictEqual(types('a^2 + b^2'), []);
            assert.deepStrictEqual(types('a^2*b^2'), []);
            assert.deepStrictEqual(types('max(a^2,b^2)'), []);
            assert.deepStrictEqual(types('sin(x)^2 + cos(x)^2'), []);
        });

        test('reports a long chain once and covers all of it', () => {
            assert.deepStrictEqual(types('a^b^c^d'), ['power-associativity']);
            assert.deepStrictEqual(snippet('1 + a^b^c^d'), ['a^b^c^d']);
            assert.deepStrictEqual(types('2^3^2^2'), ['power-associativity']); // XPP: 4096
        });

        test('handles calls and indices as single operands', () => {
            assert.deepStrictEqual(snippet('sin(x)^2^3'), ['sin(x)^2^3']);
        });

        test('spells out both readings', () => {
            const [result] = checkExpression('2^3^2');
            assert.ok(result.message.includes('"(2^3)^2"'), result.message);
            assert.ok(result.message.includes('"2^(3^2)"'), result.message);
        });
    });

    suite('unary minus is weaker than "^"', () => {
        test('flags a sign in front of a power', () => {
            assert.deepStrictEqual(types('-2^2'), ['unary-minus-power']);      // XPP: -4
            assert.deepStrictEqual(types('-x^2'), ['unary-minus-power']);
            assert.deepStrictEqual(types('sin(-x^2)'), ['unary-minus-power']);
            assert.deepStrictEqual(types('max(1,-x^2)'), ['unary-minus-power']);
        });

        test('applies to scientific notation too', () => {
            assert.deepStrictEqual(types('-3E5^2'), ['unary-minus-power']);    // XPP: -9e10
            assert.deepStrictEqual(types('-3E-5^2'), ['unary-minus-power']);   // XPP: -9e-10
        });

        test('does not flag a subtraction', () => {
            assert.deepStrictEqual(types('a - b^2'), []);   // XPP: a-(b^2), as expected
            assert.deepStrictEqual(types('a-b^2'), []);
            assert.deepStrictEqual(types('3-2^2'), []);     // XPP: -1
        });

        test('does not flag an explicit grouping', () => {
            assert.deepStrictEqual(types('(-x)^2'), []);    // XPP: (-2)^2 is 4
            assert.deepStrictEqual(types('-(x^2)'), []);    // XPP: -(2^2) is -4
        });

        test('spells out both readings', () => {
            const [result] = checkExpression('-2^2');
            assert.ok(result.message.includes('"-(2^2)"'), result.message);
            assert.ok(result.message.includes('"(-2)^2"'), result.message);
        });
    });

    suite('a comparison binds tighter than the arithmetic beside it', () => {
        test('flags a comparison next to arithmetic', () => {
            assert.deepStrictEqual(types('2*3<4'), ['comparison-precedence']);   // XPP: 2*(3<4) is 2, not 0
            assert.deepStrictEqual(types('3-1<2'), ['comparison-precedence']);   // XPP: 3-(1<2) is 2, not 0
            assert.deepStrictEqual(types('1/2<1'), ['comparison-precedence']);   // XPP: 1/(2<1), a division by zero
            assert.deepStrictEqual(types('a-b<0'), ['comparison-precedence']);   // XPP: a-(b<0)
            assert.deepStrictEqual(types('a*b^2<c'), ['comparison-precedence']); // XPP: a*(b^2<c)
        });

        test('flags arithmetic on the right of the comparison too', () => {
            assert.deepStrictEqual(types('1+2<3+4'), ['comparison-precedence']); // XPP: 1+(2<3)+4 is 6, not 1
            assert.deepStrictEqual(types('x<y+1'), ['comparison-precedence']);
        });

        test('reports a comparison chain once', () => {
            assert.deepStrictEqual(types('1+2<3+4'), ['comparison-precedence']);
        });

        test('a sign is the same rule: it negates the comparison, not its left side', () => {
            // XPP: -1<0 is -0, i.e. FALSE, while (-1)<0 is true.
            assert.deepStrictEqual(types('-1<0'), ['comparison-precedence']);
            // XPP: -1>=0 is -(1>=0) = -1, i.e. TRUE, while (-1)>=0 is false.
            assert.deepStrictEqual(types('-1>=0'), ['comparison-precedence']);
            assert.deepStrictEqual(types('-x<=y'), ['comparison-precedence']);
            assert.deepStrictEqual(types('if(-t<0)then(1)else(2)'), ['comparison-precedence']);
        });

        test('accepts a comparison that is already parenthesised', () => {
            assert.deepStrictEqual(types('x<0'), []);
            assert.deepStrictEqual(types('(2*3)<4'), []);    // XPP: 0, the usual reading
            assert.deepStrictEqual(types('2*(3<4)'), []);    // XPP: 2, said out loud
            assert.deepStrictEqual(types('(-x)<0'), []);     // XPP: (-1)<0 is 1
            assert.deepStrictEqual(types('(a-b)<0'), []);
        });

        test('does not flag operators that are weaker than the comparison', () => {
            assert.deepStrictEqual(types('1<2&3<4'), []);    // XPP: (1<2)&(3<4), as expected
            assert.deepStrictEqual(types('a<b|c<d'), []);
        });

        test('does not flag "^", which has the same priority as a comparison', () => {
            assert.deepStrictEqual(types('2^2<3'), []);      // XPP: (2^2)<3 is 0, the usual reading
        });

        test('spells out both readings and warns about the branch', () => {
            const [arithmetic] = checkExpression('2*3<4');
            assert.ok(arithmetic.message.includes('"2*(3<4)"'), arithmetic.message);
            assert.ok(arithmetic.message.includes('"(2*3)<4"'), arithmetic.message);

            const [sign] = checkExpression('-1<0');
            assert.ok(sign.message.includes('"-(1<0)"'), sign.message);
            assert.ok(sign.message.includes('"(-1)<0"'), sign.message);
            assert.ok(sign.message.includes('flips the branch'), sign.message);
        });
    });

    suite('chained comparisons', () => {
        test('flags a<b<c, which XPP reads as (a<b)<c', () => {
            // XPP: 3<2<1 is (3<2)<1 = 0<1 = 1, i.e. TRUE, although neither half holds.
            assert.deepStrictEqual(types('3<2<1'), ['chained-comparison']);
            assert.deepStrictEqual(types('a<b<c'), ['chained-comparison']);
            assert.deepStrictEqual(types('0<x<1'), ['chained-comparison']);
        });

        test('accepts the explicit form', () => {
            assert.deepStrictEqual(types('(a<b)<c'), []);       // XPP: 1<2<3 is 1 either way
            assert.deepStrictEqual(types('(a<b)&(b<c)'), []);   // what people usually mean
        });

        test('suggests the "&" form', () => {
            const [result] = checkExpression('0<x<1');
            assert.ok(result.message.includes('"(0<x)&(x<1)"'), result.message);
        });
    });

    suite('a sign XPP will not parse at all', () => {
        test('flags a sign after a binary operator', () => {
            // Each of these is REJECTED by add_expr(); the file fails with "ERROR compiling".
            assert.deepStrictEqual(types('2*-3'), ['unary-sign']);
            assert.deepStrictEqual(types('2/-3'), ['unary-sign']);
            assert.deepStrictEqual(types('2+-3'), ['unary-sign']);
            assert.deepStrictEqual(types('2--3'), ['unary-sign']);
            assert.deepStrictEqual(types('2^-3'), ['unary-sign']);
            assert.deepStrictEqual(types('2>-1'), ['unary-sign']);
            assert.deepStrictEqual(types('1&-1'), ['unary-sign']);
            assert.deepStrictEqual(types('--2'), ['unary-sign']);
            assert.deepStrictEqual(types('2*-3E-5'), ['unary-sign']);
        });

        test('flags a unary "+", which XPP has no operator for', () => {
            assert.deepStrictEqual(types('+2^2'), ['unary-sign']);   // REJECTED
            assert.deepStrictEqual(types('2*+3'), ['unary-sign']);   // REJECTED
        });

        test('tells you to drop a "+", since brackets do not rescue it', () => {
            // "(+2)" and "2*(+3)" are REJECTED too, so "(+2)" is not a fix.
            const [result] = checkExpression('+2*a');
            assert.ok(result.message.includes('Drop the "+"'), result.message);
            assert.ok(!result.message.includes('"(+2)"'), result.message);
        });

        test('accepts a sign where XPP does allow one', () => {
            assert.deepStrictEqual(types('-3'), []);         // XPP: -3
            assert.deepStrictEqual(types('(-3)'), []);       // XPP: -3
            assert.deepStrictEqual(types('2^(-3)'), []);     // XPP: 0.125
            assert.deepStrictEqual(types('max(1,-2)'), []);  // XPP: 1
            assert.deepStrictEqual(types('sin(-1)'), []);    // XPP: -0.8414...
            assert.deepStrictEqual(types('-(-2)'), []);      // XPP: 2
            assert.deepStrictEqual(types('-sin(1)'), []);    // XPP: -0.8414...
        });

        test('suggests the bracketing that works', () => {
            const [result] = checkExpression('2^-3');
            assert.ok(result.message.includes('will not load'), result.message);
            assert.ok(result.message.includes('"(-3)"'), result.message);
        });
    });

    suite('scientific notation', () => {
        test('a sign inside an exponent belongs to the number', () => {
            // XPP: 1e-3^2 is (1e-3)^2 = 1e-06, so the "-" here is not an operator at all.
            assert.deepStrictEqual(types('1e-3^2'), []);
            assert.deepStrictEqual(types('2*1e-3'), []);
            assert.deepStrictEqual(types('a+1E-5'), []);
            assert.deepStrictEqual(types('1.5e+10*x'), []);
        });

        test('a leading signed number is fine', () => {
            assert.deepStrictEqual(types('-3E5'), []);      // XPP: -300000
            assert.deepStrictEqual(types('-3E-5'), []);     // XPP: -3e-05
            assert.deepStrictEqual(types('-1e-3'), []);     // XPP: -0.001
        });

        test('a signed number after an operator is still a syntax error', () => {
            assert.deepStrictEqual(types('x*-3E-5'), ['unary-sign']);   // REJECTED
            assert.deepStrictEqual(types('2^-3E5'), ['unary-sign']);    // REJECTED
        });
    });

    suite('over a whole file', () => {
        test('checks every kind of right-hand side', () => {
            const results = run([
                "x'=-x^2",
                'f(u)=u^2^3',
                'aux e=-y^2',
                'v(t+1)=v^2^2',
                '!k=-a^2',
                'g(u)=if(-u<0)then(1)else(2)',
                "w'=2*-3",
            ].join('\n'));
            assert.deepStrictEqual(results.map(r => `${r.line}:${r.type}`), [
                '0:unary-minus-power',
                '1:power-associativity',
                '2:unary-minus-power',
                '3:power-associativity',
                '4:unary-minus-power',
                '5:comparison-precedence',
                '6:unary-sign',
            ]);
        });

        test('points at the right columns', () => {
            const [result] = run("x'=sin(-a^2)");
            assert.deepStrictEqual([result.type, result.line, result.start, result.end], ['unary-minus-power', 0, 7, 11]);
        });

        test('a sign after a binary operator is the error, not the precedence note', () => {
            // "1 + -a^2" is REJECTED by add_expr(), so the file would not load at all.
            const [result] = run("x'=1 + -a^2");
            assert.deepStrictEqual([result.type, result.line, result.start, result.end], ['unary-sign', 0, 7, 9]);
        });

        test('ignores comments, comment lines and text after "done"', () => {
            assert.deepStrictEqual(run("x'=-x # but -y^2, 2^3^2 and 2*-3 here are prose"), []);
            assert.deepStrictEqual(run('# -x^2 and 2^3^2'), []);
            assert.deepStrictEqual(run('" -x^2 and 2^3^2'), []);
            assert.deepStrictEqual(run("x'=-x\ndone\n-y^2 and 2^3^2"), []);
        });

        test('does not flag declaration values, which XPP reads as plain numbers', () => {
            assert.deepStrictEqual(run('par a=1, b=-3E-5\ninit x=0'), []);
        });

        test('follows a "\\" continuation onto the next line', () => {
            const results = run("x'=1 + \\\n  2^3^2");
            assert.deepStrictEqual(results.map(r => `${r.line}:${r.type}`), ['1:power-associativity']);
            assert.deepStrictEqual([results[0].start, results[0].end], [2, 7]);
        });
    });
});
