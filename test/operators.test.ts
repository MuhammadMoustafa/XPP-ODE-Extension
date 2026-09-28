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
                'unsupported-operator': 'error',        // "!=", "&&", "||", "!": the file does not load
                'if-syntax': 'error',                   // an unbracketed or else-less if: does not load
                'comparison-precedence': 'warning',     // silently takes the wrong branch
                'chained-comparison': 'warning',        // silently true when neither half holds
                'logical-precedence': 'warning',        // "&" or "|" silently regrouped with arithmetic
                'division-by-zero': 'warning',          // "1/0" is silently 4.48e14
                'if-trailing-operator': 'information',  // "if(..)else(b)+5" adds 5 to the whole if
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

        test('carries the text that fixes the sign, replacing the reported span', () => {
            const fixed = (expression: string) => checkExpression(expression).map(r =>
                expression.substring(0, r.start) + r.replacement + expression.substring(r.end));
            assert.deepStrictEqual(fixed('2*-3'), ['2*(-3)']);
            assert.deepStrictEqual(fixed('2*-sin(x)'), ['2*(-sin(x))']);
            assert.deepStrictEqual(fixed('x^-(a+b)'), ['x^(-(a+b))']);
            assert.deepStrictEqual(fixed('2*-3E-5'), ['2*(-3E-5)']);
            assert.deepStrictEqual(fixed('2*+3'), ['2*3']);      // a "+" is dropped, not bracketed
            assert.deepStrictEqual(fixed('+2^2'), ['2^2']);
        });

        test('offers no replacement without an operand, or across a continued line', () => {
            assert.strictEqual(checkExpression('2*-').map(r => r.replacement)[0], undefined);
            const [result] = run("x'=2*-\\\n3\n");
            assert.strictEqual(result.type, 'unary-sign');
            assert.strictEqual(result.replacement, undefined);
            assert.deepStrictEqual(run("x'=2*-3\n").map(r => r.replacement), ['(-3)']);
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

    suite('operators XPP does not have', () => {
        // Each of these was confirmed to stop the file from loading in xppautX.
        test('flags "!=", "&&", "||" and a unary "!"', () => {
            assert.deepStrictEqual(types('1!=2'), ['unsupported-operator']);   // "illegal expression: 1!"
            assert.deepStrictEqual(types('a&&b'), ['unsupported-operator']);   // "Illegal syntax"
            assert.deepStrictEqual(types('a||b'), ['unsupported-operator']);   // "Illegal syntax"
            assert.deepStrictEqual(types('!1'), ['unsupported-operator']);     // "illegal expression: !"
            assert.deepStrictEqual(types('a&!b'), ['unsupported-operator']);
        });

        test('"!=" is no longer treated as a comparison', () => {
            assert.deepStrictEqual(types('a+b!=c'), ['unsupported-operator']);
        });

        test('accepts the single "&" and "|" and not()', () => {
            assert.deepStrictEqual(types('a&b'), []);
            assert.deepStrictEqual(types('a|b'), []);
            assert.deepStrictEqual(types('not(a==b)'), []);
        });

        test('says what to write instead', () => {
            assert.ok(checkExpression('a!=b')[0].message.includes('"not(a==b)"'), checkExpression('a!=b')[0].message);
            assert.ok(checkExpression('a&&b')[0].message.includes('"&"'), checkExpression('a&&b')[0].message);
            assert.ok(checkExpression('!a')[0].message.includes('not('), checkExpression('!a')[0].message);
        });

        test('carries the text that fixes it', () => {
            const fixed = (expression: string) => checkExpression(expression).map(r =>
                r.replacement === undefined ? undefined : expression.substring(0, r.start) + r.replacement + expression.substring(r.end));
            assert.deepStrictEqual(fixed('a&&b'), ['a&b']);
            assert.deepStrictEqual(fixed('a || b'), ['a | b']);
            assert.deepStrictEqual(fixed('!x'), ['not(x)']);
            assert.deepStrictEqual(fixed('a&!(x<1)'), ['a&not(x<1)']);
            assert.deepStrictEqual(fixed('a!=b'), ['not(a==b)']);
            assert.deepStrictEqual(fixed('if(x!=0)then(1)else(2)'), ['if(not(x==0))then(1)else(2)']);
            assert.deepStrictEqual(fixed('a!=b&c<d'), ['not(a==b)&c<d']);
        });

        test('rewrites "!=" only when its operands are complete', () => {
            // "a+b!=c": which operands were meant is not certain, so there is no sure fix.
            const fixes = (expression: string) => checkExpression(expression).map(r => r.replacement);
            assert.deepStrictEqual(fixes('a+b!=c'), [undefined]);
            assert.deepStrictEqual(fixes('a!=b*c'), [undefined]);
            assert.deepStrictEqual(fixes('a^2!=b'), [undefined]);
        });

        test('never flags a derived parameter "!name=..."', () => {
            assert.deepStrictEqual(run('par a=1\n!b=a*2\n! c = a'), []);
        });
    });

    suite('"&" and "|" beside arithmetic', () => {
        // XPP: "&" has priority 6 like "*" and "/", "|" priority 4 like "+" and "-".
        test('flags a grouping that differs from the usual reading', () => {
            assert.deepStrictEqual(types('1+1&1'), ['logical-precedence']);   // XPP: 1+(1&1) = 2
            assert.deepStrictEqual(types('a&b*c'), ['logical-precedence']);   // XPP: (a&b)*c
            assert.deepStrictEqual(types('a&b+c'), ['logical-precedence']);   // XPP: (a&b)+c
            assert.deepStrictEqual(types('a|b-c'), ['logical-precedence']);   // XPP: (a|b)-c; a=2,b=0,c=1 gives 0
            assert.deepStrictEqual(types('a|b*c+d'), ['logical-precedence']); // XPP: (a|(b*c))+d
            assert.deepStrictEqual(types('a+b*c&d'), ['logical-precedence']); // XPP: a+((b*c)&d)
        });

        test('accepts groupings that agree with the usual reading', () => {
            assert.deepStrictEqual(types('a*b&c'), []);     // (a*b)&c either way
            assert.deepStrictEqual(types('a+b|c'), []);     // (a+b)|c either way
            assert.deepStrictEqual(types('a|b*c'), []);     // a|(b*c) either way
            assert.deepStrictEqual(types('a|b&c'), []);
            assert.deepStrictEqual(types('a&b|c'), []);
            assert.deepStrictEqual(types('x<1&y>2'), []);
            assert.deepStrictEqual(types('a&b^2'), []);
            assert.deepStrictEqual(types('(a+b)&c'), []);
            assert.deepStrictEqual(types('a&(b*c)'), []);
            assert.deepStrictEqual(types('-a&b'), []);
        });

        test('reports a chain once', () => {
            assert.deepStrictEqual(types('a+b&c&d'), ['logical-precedence']);
        });

        test('spells out both readings', () => {
            const [left] = checkExpression('a+b&c');
            assert.ok(left.message.includes('"a+(b&c)"'), left.message);
            assert.ok(left.message.includes('"(a+b)&c"'), left.message);
            const [right] = checkExpression('a|b-c');
            assert.ok(right.message.includes('"(a|b)-c"'), right.message);
            assert.ok(right.message.includes('"a|(b-c)"'), right.message);
        });
    });

    suite('if/then/else', () => {
        test('accepts the fully bracketed form, with or without spaces, and nested', () => {
            assert.deepStrictEqual(types('if(x>0)then(1)else(2)'), []);
            assert.deepStrictEqual(types('if (x>0) then (1) else (2)'), []);
            assert.deepStrictEqual(types('IF(x>0)THEN(1)ELSE(2)'), []);
            assert.deepStrictEqual(types('if(x>0)then(if(y>0)then(1)else(2))else(3)'), []);
            assert.deepStrictEqual(types('2*if(x>0)then(1)else(2)'), []);
        });

        test('flags any part that is not in brackets', () => {
            // All confirmed not to load in xppautX.
            assert.deepStrictEqual(types('if 1>0 then 10 else 20'), ['if-syntax']);    // "Illegal syntax"
            assert.deepStrictEqual(types('if(1>0)then 10 else 20'), ['if-syntax']);    // "illegal expression: 10EL"
            assert.deepStrictEqual(types('if(1>0)then -10 else 20'), ['if-syntax']);
            assert.deepStrictEqual(types('if(1>0)then(10)else 20'), ['if-syntax']);
            assert.deepStrictEqual(types('if(1>0)then10else20'), ['if-syntax']);
        });

        test('flags a missing else', () => {
            // "If statement missing ELSE or THEN"
            assert.deepStrictEqual(types('if(1>0)then(10)'), ['if-syntax']);
            assert.ok(checkExpression('if(1>0)then(10)')[0].message.includes('no else'), checkExpression('if(1>0)then(10)')[0].message);
        });

        test('explains that spaces do not separate the parts', () => {
            const [result] = checkExpression('if(1>0)then 10 else 20');
            assert.ok(result.message.includes('if(...)then(...)else(...)'), result.message);
            assert.ok(result.message.includes('"then10else20"'), result.message);
        });

        test('notes an operator right after the else part', () => {
            // XPP: if(1>0)then(10)else(20)+5 is 15, the "+5" applies to the whole if.
            assert.deepStrictEqual(types('if(1>0)then(10)else(20)+5'), ['if-trailing-operator']);
            assert.deepStrictEqual(types('if(x>0)then(1)else(2)*y'), ['if-trailing-operator']);
            assert.deepStrictEqual(types('(if(x>0)then(1)else(2))+5'), []);
            assert.deepStrictEqual(types('if(x>0)then(1)else(2+5)'), []);
            assert.deepStrictEqual(types('max(if(x>0)then(1)else(2),3)'), []);
            const [result] = checkExpression('if(1>0)then(10)else(20)+5');
            assert.ok(result.message.includes('"(if(1>0)then(10)else(20))+5"'), result.message);
        });
    });

    suite('division by a literal zero', () => {
        test('flags a divisor that is literally zero', () => {
            // XPP: 1/0 is 4.48e14 and 0/0 is 0, without a word.
            assert.deepStrictEqual(types('1/0'), ['division-by-zero']);
            assert.deepStrictEqual(types('0/0'), ['division-by-zero']);
            assert.deepStrictEqual(types('x/0.0'), ['division-by-zero']);
            assert.deepStrictEqual(types('x/(0)'), ['division-by-zero']);
            assert.deepStrictEqual(types('x/ 0'), ['division-by-zero']);
            assert.deepStrictEqual(snippet('1+x/(0)'), ['/(0)']);
        });

        test('accepts any other divisor', () => {
            assert.deepStrictEqual(types('x/0.5'), []);
            assert.deepStrictEqual(types('x/1e-3'), []);
            assert.deepStrictEqual(types('x/(0+a)'), []);
            assert.deepStrictEqual(types('x/y'), []);
            assert.deepStrictEqual(types('0/x'), []);
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

        test('ignores the new checks in comments, "@", "#include" and after "done"', () => {
            assert.deepStrictEqual(run("x'=-x # a!=b, a&&b, !a, 1/0, if 1 then 2"), []);
            assert.deepStrictEqual(run('#include a&&b.inc\n@ total=1/0'), []);
            assert.deepStrictEqual(run("x'=-x\ndone\na!=b and 1/0"), []);
            assert.deepStrictEqual(run("y(t)=int{exp(-t)#x}"), []);
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
