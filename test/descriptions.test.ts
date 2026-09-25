import * as assert from 'assert';
import {
    parseDescriptionKey, collectDescriptions, formatDescriptionHover,
    DocumentDescriptions, DescriptionEntry,
} from '../src/utils/descriptionsCore';

const ARRAY = "x[1..10]'=-x[j]";

function describe(...lines: string[]): DocumentDescriptions {
    return collectDescriptions([...lines, 'done'].join('\n'));
}
/** "level:text" for every entry of a name, in byName order. */
function summary(d: DocumentDescriptions, name: string): string[] {
    return (d.byName.get(name) ?? []).map(e => `${e.level}:${e.text}`);
}
function only(d: DocumentDescriptions, name: string): DescriptionEntry {
    const entries = d.byName.get(name) ?? [];
    assert.strictEqual(entries.length, 1, `${name} should have one entry`);
    return entries[0];
}
function conflictSummary(d: DocumentDescriptions): string[] {
    return d.conflicts.map(c => `${c.name}: ${c.loser.text} -> ${c.winner.text}`);
}

suite('Descriptions', () => {
    suite('parseDescriptionKey', () => {
        test('a plain name has no indices', () => {
            const key = parseDescriptionKey('gna');
            assert.strictEqual(key?.base, 'gna');
            assert.strictEqual(key?.indices, undefined);
        });

        test('a single index, a list and a range', () => {
            assert.deepStrictEqual(parseDescriptionKey('x[3]')?.indices, [3]);
            assert.deepStrictEqual(parseDescriptionKey('x[3,5]')?.indices, [3, 5]);
            assert.deepStrictEqual(parseDescriptionKey('x[1..3]')?.indices, [1, 2, 3]);
        });

        test('mixed selections with spaces are sorted and unique', () => {
            const key = parseDescriptionKey('x[1..3, 7, 9]');
            assert.strictEqual(key?.base, 'x');
            assert.deepStrictEqual(key?.indices, [1, 2, 3, 7, 9]);
            assert.deepStrictEqual(parseDescriptionKey('v[ 5 , 3..4, 3 ]')?.indices, [3, 4, 5]);
        });

        test('malformed keys are undefined', () => {
            for (const bad of ['', 'x y', '3x', 'x[]', 'x[1', 'x[a]', 'x[1..]', 'x[1,,2]']) {
                assert.strictEqual(parseDescriptionKey(bad), undefined, bad);
            }
        });
    });

    suite('trailing comments', () => {
        test('a one-name line gets an exact entry with the comment text and span', () => {
            const e = only(describe('par gna=120 # sodium conductance'), 'gna');
            assert.deepStrictEqual(e, {
                text: 'sodium conductance', key: 'gna', level: 'exact',
                line: 0, start: 14, end: 32, placement: 'trailing',
            });
        });

        test('keyed parts separated by ";" describe each name, with the span of each part', () => {
            const d = describe('par a=1, b=2 # a: x; b: y');
            assert.deepStrictEqual(only(d, 'a'), { text: 'x', key: 'a', level: 'exact', line: 0, start: 15, end: 19, placement: 'trailing' });
            assert.deepStrictEqual(only(d, 'b'), { text: 'y', key: 'b', level: 'exact', line: 0, start: 21, end: 25, placement: 'trailing' });
        });

        test('a plain comment on a multi-name line is shared by every name', () => {
            const d = describe('par a=1, b=2 # gating constants');
            assert.deepStrictEqual(summary(d, 'a'), ['inherited:gating constants']);
            assert.deepStrictEqual(summary(d, 'b'), ['inherited:gating constants']);
            assert.strictEqual(only(d, 'a').key, 'a');
        });

        test('a colon that is not a name on the line keeps the whole comment as plain text', () => {
            const e = only(describe('par v=1 # units: mV'), 'v');
            assert.strictEqual(e.text, 'units: mV');
            assert.strictEqual(e.level, 'exact');
            assert.strictEqual(e.key, 'v');
        });

        test('if any part is not keyed, the whole comment is plain', () => {
            const d = describe('par a=1, b=2 # a: x; see paper');
            assert.deepStrictEqual(summary(d, 'a'), ['inherited:a: x; see paper']);
            assert.deepStrictEqual(summary(d, 'b'), ['inherited:a: x; see paper']);
        });

        test('keys are case-insensitive', () => {
            const d = describe('par gNa=1, EK=2 # GNA: sodium; ek: potassium');
            assert.deepStrictEqual(summary(d, 'gna'), ['exact:sodium']);
            assert.deepStrictEqual(summary(d, 'ek'), ['exact:potassium']);
        });

        test('a comment on a continuation line covers names on every physical line', () => {
            const d = describe('par a=1, \\', '  b=2 # a: first; b: second');
            assert.deepStrictEqual(summary(d, 'a'), ['exact:first']);
            assert.deepStrictEqual(summary(d, 'b'), ['exact:second']);
            assert.strictEqual(only(d, 'a').line, 1);
        });

        test('"#" inside int{...} is not a comment', () => {
            assert.deepStrictEqual(summary(describe('y(t)=int{exp(-t)#y} # kernel'), 'y'), ['exact:kernel']);
            assert.strictEqual(describe('y(t)=int{exp(-t)#y}').byName.size, 0);
        });

        test('comments after "done" are ignored', () => {
            const d = collectDescriptions('par a=1\ndone\n# b: late\npar b=2 # late too');
            assert.strictEqual(d.byName.size, 0);
        });
    });

    suite('block above', () => {
        test('key lines describe names; other comment lines are ignored', () => {
            const d = describe(
                '# ---- Sodium current ----',
                '# gna: max conductance',
                '# see Hodgkin & Huxley',
                '# ena: reversal potential',
                'par gna=120, ena=50',
            );
            assert.deepStrictEqual(summary(d, 'gna'), ['exact:max conductance']);
            assert.deepStrictEqual(summary(d, 'ena'), ['exact:reversal potential']);
            const e = only(d, 'gna');
            assert.strictEqual(e.placement, 'above');
            assert.strictEqual(e.line, 1);
            assert.strictEqual(e.end, '# gna: max conductance'.length);
        });

        test('a blank line breaks the block', () => {
            assert.strictEqual(describe('# gna: far away', '', 'par gna=120').byName.size, 0);
        });

        test('a key for a name that is not on the next declaration line is ignored silently', () => {
            const d = describe('# gk: potassium', 'par gna=120', 'par gk=36');
            assert.strictEqual(d.byName.size, 0);
            assert.deepStrictEqual(d.problems, []);
        });

        test('a block above a continued line reaches names on the continuation', () => {
            const d = describe('# b: second', 'par a=1, \\', '  b=2');
            assert.deepStrictEqual(summary(d, 'b'), ['exact:second']);
        });
    });

    suite('arrays', () => {
        test('a key for the base is exact for the array and inherited by its members', () => {
            const d = describe('# x: potentials', ARRAY);
            assert.deepStrictEqual(summary(d, 'x'), ['exact:potentials']);
            assert.deepStrictEqual(summary(d, 'x7'), ['inherited:potentials']);
            assert.strictEqual(only(d, 'x7').key, 'x');
        });

        test('a plain trailing comment on the array line works like a key for the base', () => {
            const d = describe(`${ARRAY} # potentials`);
            assert.deepStrictEqual(summary(d, 'x'), ['exact:potentials']);
            assert.deepStrictEqual(summary(d, 'x10'), ['inherited:potentials']);
        });

        test('a range selection covers only its members', () => {
            const d = describe('# x[1..3]: first three', ARRAY);
            for (const n of ['x1', 'x2', 'x3']) assert.deepStrictEqual(summary(d, n), ['selection:first three'], n);
            assert.strictEqual(d.byName.get('x4'), undefined);
            assert.strictEqual(d.byName.get('x'), undefined);
            assert.strictEqual(only(d, 'x2').key, 'x[1..3]');
        });

        test('a list selection covers only the listed members', () => {
            const d = describe('# x[3,5]: odd ones', ARRAY);
            assert.deepStrictEqual(summary(d, 'x3'), ['selection:odd ones']);
            assert.deepStrictEqual(summary(d, 'x5'), ['selection:odd ones']);
            assert.strictEqual(d.byName.get('x4'), undefined);
        });

        test('a mixed selection covers ranges and single indices', () => {
            const d = describe('# x[1..3, 7, 9]: mixed', ARRAY);
            const covered = [...d.byName.keys()].sort();
            assert.deepStrictEqual(covered, ['x1', 'x2', 'x3', 'x7', 'x9']);
        });

        test('a member key is exact for that member only', () => {
            const d = describe('# x7: seventh', ARRAY);
            assert.deepStrictEqual([...d.byName.keys()], ['x7']);
            assert.deepStrictEqual(summary(d, 'x7'), ['exact:seventh']);
        });

        test('a member lists exact, then selection, then inherited', () => {
            const d = describe('# x: all', '# x7: seventh', '# x[5..8]: middle', ARRAY);
            assert.deepStrictEqual(summary(d, 'x7'), ['exact:seventh', 'selection:middle', 'inherited:all']);
        });

        test('within a level, later entries come first', () => {
            const d = describe('# x: above', `${ARRAY} # trailing`);
            assert.deepStrictEqual(summary(d, 'x7'), ['inherited:trailing', 'inherited:above']);
        });

        test('an out-of-range member is a problem on the key', () => {
            const d = describe('# x11: nope', ARRAY);
            assert.strictEqual(d.problems.length, 1);
            const p = d.problems[0];
            assert.deepStrictEqual({ line: p.line, start: p.start, end: p.end }, { line: 0, start: 2, end: 5 });
            assert.ok(p.message.includes('x11'), p.message);
            assert.strictEqual(d.byName.get('x11'), undefined);
        });

        test('an out-of-range selection is a problem on the key', () => {
            const d = describe('# x[9..12]: nope', ARRAY);
            assert.strictEqual(d.problems.length, 1);
            const p = d.problems[0];
            assert.deepStrictEqual({ line: p.line, start: p.start, end: p.end }, { line: 0, start: 2, end: 10 });
        });
    });

    suite('duplicates', () => {
        test('a trailing comment beats the block above', () => {
            const d = describe('# gna: above', 'par gna=120 # trailing');
            assert.deepStrictEqual(summary(d, 'gna'), ['exact:trailing', 'exact:above']);
            assert.deepStrictEqual(conflictSummary(d), ['gna: above -> trailing']);
            assert.strictEqual(d.conflicts[0].loser.placement, 'above');
            assert.strictEqual(d.conflicts[0].winner.placement, 'trailing');
        });

        test('two exact keys: the later wins', () => {
            const d = describe('# gna: first', '# gna: second', 'par gna=120');
            assert.deepStrictEqual(conflictSummary(d), ['gna: first -> second']);
        });

        test('every loser gets its own conflict against the last entry', () => {
            const d = describe('# gna: A', '# gna: B', '# gna: C', 'par gna=120');
            assert.deepStrictEqual(conflictSummary(d).sort(), ['gna: A -> C', 'gna: B -> C']);
        });

        test('overlapping selections conflict only on the shared members', () => {
            const d = describe('# x[1..3]: A', '# x[3..5]: B', ARRAY);
            assert.deepStrictEqual(conflictSummary(d), ['x3: A -> B']);
            assert.deepStrictEqual(summary(d, 'x3'), ['selection:B', 'selection:A']);
        });

        test('different levels do not conflict', () => {
            const d = describe('# x: all', '# x[1..3]: some', '# x2: one', ARRAY);
            assert.deepStrictEqual(d.conflicts, []);
        });

        test('inherited and shared entries never conflict', () => {
            const d = describe('# x: above', `${ARRAY} # trailing`);
            assert.deepStrictEqual(d.conflicts.map(c => c.name), ['x']);
        });
    });

    suite('formatDescriptionHover', () => {
        const entry = (text: string, key: string, level: DescriptionEntry['level'], line: number): DescriptionEntry =>
            ({ text, key, level, line, start: 0, end: 1, placement: 'above' });
        const hover = formatDescriptionHover({
            name: 'x7',
            kindLabel: 'state variable (array x[1..10])',
            entries: [entry('seventh cell', 'x7', 'exact', 4), entry('all cells', 'x', 'inherited', 2)],
            configDescriptions: [{ text: 'from settings', key: 'x*' }],
        });

        test('the first line names the symbol and its kind', () => {
            const first = hover.split('\n')[0];
            assert.ok(first.includes('**x7**'), first);
            assert.ok(first.includes('state variable (array x[1..10])'), first);
        });

        test('each entry shows its text and 1-based line, in order', () => {
            const a = hover.indexOf('seventh cell');
            const b = hover.indexOf('all cells');
            assert.ok(a >= 0 && a < hover.indexOf('(line 5)'), hover);
            assert.ok(hover.indexOf('(line 5)') < b, hover);
            assert.ok(b < hover.indexOf('(line 3)'), hover);
        });

        test('only entries keyed by another name show where they come from', () => {
            assert.ok(hover.includes('from x'), hover);
            assert.ok(!hover.includes('from x7'), hover);
        });

        test('config descriptions follow the comment entries with their key', () => {
            const c = hover.indexOf('from settings');
            assert.ok(c > hover.indexOf('all cells'), hover);
            assert.ok(hover.indexOf('(.xppcolors.json: x*)') > c, hover);
        });
    });
});
