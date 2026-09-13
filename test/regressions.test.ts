import * as assert from 'assert';
import { checkParentheses } from '../src/utils/parenthesesCheckerCore';
import { detectWordRangeCore, findRenameOccurrences, isRenameScopedToFunction } from '../src/utils/renameCore';
import { toggleCommentCore } from '../src/utils/commentingCore';
import { checkVariablesAndParameters } from '../src/utils/variableCheckerCore';
import { reservedWords } from '../src/utils/constants';
import { commentStart, isInComment, codeLines } from '../src/utils/lineUtils';
import { checkEndDirective } from '../src/utils/endDirectiveCore';

suite('Regressions', () => {
    suite('line utils', () => {
        test('# inside braces is the convolution operator, not a comment', () => {
            assert.strictEqual(commentStart('y(t)=int{exp(-t)#x}'), -1);
            assert.strictEqual(commentStart('y(t)=int{exp(-t)#x} # note'), 20);
            assert.strictEqual(isInComment('junk=int{0#x}', 11), false);
            assert.strictEqual(isInComment('x=1 # x', 6), true);
        });

        test('code after done is blanked out but line numbers are kept', () => {
            assert.deepStrictEqual(codeLines(['x=1', 'done', 'notes (', 'more']), ['x=1', 'done', '', '']);
            assert.deepStrictEqual(codeLines(['x=1', '#done', 'y=(']), ['x=1', '#done', '']);
        });
    });

    suite('end directive', () => {
        test('reports a missing done', () => {
            const results = checkEndDirective(['x=1', ''], false);
            assert.strictEqual(results.length, 1);
            assert.ok(results[0].message.startsWith('Missing "done"'));
        });

        test('allows comments and blank lines after done, warns once on other text', () => {
            assert.deepStrictEqual(checkEndDirective(['x=1', 'done', '', '# notes'], false), []);
            const results = checkEndDirective(['x=1', 'done', '', 'y=2', 'more notes', '# ok'], false);
            assert.deepStrictEqual(results.map(r => [r.line, r.start, r.severity]), [[3, 0, 'warning']]);
        });

        test('any line whose first word starts with d is done, unless it is an equation or variable', () => {
            for (const line of ['d', 'don', 'done# c', 'done # c', 'done\t#c', 'delta 5', 'done x=1', 'done,x', 'DONE']) {
                assert.deepStrictEqual(checkEndDirective(['x=1', line], false), [], line);
            }
            for (const line of ['dt=1', 'done =1', "done'=1", 'done(0)=1', "d[1..2]'=1", 'dd/dt=1', 'dd/dt = 1']) {
                assert.strictEqual(checkEndDirective(['x=1', line], false).length, 1, line);
            }
        });

        test('uses #done for .inc files', () => {
            assert.deepStrictEqual(checkEndDirective(['x=1', '#done'], true), []);
            assert.strictEqual(checkEndDirective(['x=1', 'done'], true).length, 1);
        });
    });

    suite('parentheses checker', () => {
        test('keeps checking after a line that contains a comment', () => {
            const results = checkParentheses(['x=1 # comment', 'y=(2']);
            assert.strictEqual(results.length, 1);
            assert.deepStrictEqual(results[0], { message: 'Unmatched opening parenthesis: (', line: 1, start: 2, end: 3 });
        });

        test('ignores brackets inside comments', () => {
            assert.deepStrictEqual(checkParentheses(['# (((', 'y=(2)']), []);
        });

        test('reports a closing bracket of the wrong kind', () => {
            const results = checkParentheses(['x=(1]']);
            assert.deepStrictEqual(results.map(r => r.message), ['Unmatched closing parenthesis: ]']);
        });
    });

    suite('rename', () => {
        test('renames a global used inside a function body', () => {
            const results = findRenameOccurrences(['f(a)=a*k', 'k=1'], 'k', 'q', 1, 0);
            assert.deepStrictEqual(results.map(r => [r.line, r.start]), [[0, 7], [1, 0]]);
        });

        test('renames the right-hand side of a y(t)= definition', () => {
            const results = findRenameOccurrences(['x(t)=x+1'], 'x', 'y');
            assert.deepStrictEqual(results.map(r => r.start), [0, 5]);
        });

        test('does not rename a global that is shadowed by a function parameter', () => {
            const results = findRenameOccurrences(['f(k)=k*2', 'k=1'], 'k', 'q', 1, 0);
            assert.deepStrictEqual(results.map(r => [r.line, r.start]), [[1, 0]]);
        });

        test('renames only the variable part of an upper-case derivative', () => {
            const detection = detectWordRangeCore('DX/dt=X+1', 1, 0);
            assert.ok(detection);
            assert.strictEqual(detection?.actualVariableName, 'X');
            assert.strictEqual(detection?.range.start.character, 1);
            assert.strictEqual(detection?.range.end.character, 2);

            const results = findRenameOccurrences(['DX/dt=X+1'], 'X', 'y');
            assert.deepStrictEqual(results.map(r => r.start), [1, 6]);
        });

        test('renames a variable called d without touching the derivative prefix', () => {
            const results = findRenameOccurrences(['dd/dt=d'], 'd', 'q');
            assert.deepStrictEqual(results.map(r => r.start), [1, 6]);
        });

        test('reports whether a rename is scoped to a function parameter', () => {
            const lines = ['f(a)=a*2', 'a=1'];
            assert.strictEqual(isRenameScopedToFunction(lines, 'a', 0, 2), true);
            assert.strictEqual(isRenameScopedToFunction(lines, 'a', 0, 6), true);
            assert.strictEqual(isRenameScopedToFunction(lines, 'a', 1, 0), false);
        });

        test('finds later parameters on a par line even when an earlier one has the same prefix', () => {
            const results = findRenameOccurrences(['par ab=1, b=2'], 'b', 'c');
            assert.deepStrictEqual(results.map(r => r.start), [10]);
        });
    });

    suite('commenting', () => {
        test('uncommenting keeps indentation', () => {
            assert.strictEqual(toggleCommentCore('    #x=1\n    #y=2\n').output, '    x=1\n    y=2\n');
            assert.strictEqual(toggleCommentCore('    # x=1\n').output, '    x=1\n');
        });

        test('comments and uncomments a multi-line block round trip', () => {
            const original = 'x=1\n  y=2\n\nz=3\n';
            const commented = toggleCommentCore(original).output;
            assert.strictEqual(commented, '# x=1\n#   y=2\n# \n# z=3\n');
            assert.strictEqual(toggleCommentCore(commented).output, original);
        });
    });

    suite('variable checker', () => {
        test('reports positions relative to the untrimmed line', () => {
            const results = checkVariablesAndParameters('  par a=1\n  par a=2');
            assert.deepStrictEqual(results.map(r => [r.line, r.start, r.end]), [[1, 6, 7]]);
        });

        test('locates a duplicate parameter whose name is a suffix of an earlier one', () => {
            const results = checkVariablesAndParameters('par ab=1, b=2, b=3');
            assert.deepStrictEqual(results.map(r => [r.start, r.end]), [[15, 16]]);
        });

        test('accepts option names as variable names', () => {
            assert.deepStrictEqual(checkVariablesAndParameters('total=1\ndt=2'), []);
        });
    });

    suite('reserved words and keyword prefixes (verified against xppaut 8.0)', () => {
        test('builtins, t, pi and set are reserved', () => {
            ['sqrt', 'besseli', 'arg9', 'pi', 't', 'set', 'of', 'if'].forEach(word => {
                assert.ok(reservedWords.has(word), `${word} should be reserved`);
            });
        });

        test('declaration keywords are legal variable names', () => {
            ['p', 'par', 'done', 'dt', 'i', 'd', 'init', 'aux', 'int', 'conv'].forEach(word => {
                assert.ok(!reservedWords.has(word), `${word} should not be reserved`);
            });
            assert.deepStrictEqual(checkVariablesAndParameters("p=1\npar=2\ndone=3\nx'=-x+p"), []);
        });

        test('any word starting with p or n followed by a name declares parameters', () => {
            const results = checkVariablesAndParameters('p a=1\nparams a=2\nnumber a=3');
            assert.deepStrictEqual(results.map(r => [r.line, r.message]), [
                [1, "Duplicate parameter name: 'a'"],
                [2, "Duplicate parameter name: 'a'"],
            ]);
            assert.deepStrictEqual(findRenameOccurrences(['p a=1, b=2', 'x=a'], 'a', 'q').map(r => [r.line, r.start]), [[0, 2], [1, 2]]);
        });

        test('any word starting with d on its own line ends the file', () => {
            assert.deepStrictEqual(codeLines(['x=1', 'don', 'y=('])[2], '');
            assert.deepStrictEqual(codeLines(['x=1', 'dx/dt=1', 'y=2']), ['x=1', 'dx/dt=1', 'y=2']);
        });
    });
});
