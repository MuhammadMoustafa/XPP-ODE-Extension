import * as assert from 'assert';
import { parseXpp } from '../src/utils/xppModel';
import { describeName, formatDescriptionHover, collectDescriptions } from '../src/utils/descriptionsCore';
import { parseColorConfig, collectStyledRanges, configDescriptionsFor } from '../src/utils/identifierColorsCore';

const ARRAY = "x[1..10]'=-x[j]\ndone";

suite('{j} in a description is the member index', () => {
    const base = { name: 'x4', kindLabel: 'state variable (array x[1..10])', declaredAt: { file: 'm.ode', line: 0 }, files: [] as never[] };

    test('describeName gives the member its index, and the array none', () => {
        const declarations = parseXpp(ARRAY).declarations;
        assert.strictEqual(describeName(declarations, 'x4')?.memberIndex, 4);
        assert.strictEqual(describeName(declarations, 'x10')?.memberIndex, 10);
        assert.strictEqual(describeName(declarations, 'x')?.memberIndex, undefined);
    });

    test('is replaced in comment and settings descriptions, whatever the case of j', () => {
        const hover = formatDescriptionHover({
            ...base, memberIndex: 4,
            files: [{ file: 'm.ode', entries: [{ text: 'cell {j} of 10', key: 'x', level: 'inherited', line: 0, start: 0, end: 1, placement: 'above' }] }],
            configDescriptions: [{ text: 'Cell {J}, {j} again', key: 'x' }],
        });
        assert.ok(hover.includes('cell 4 of 10'), hover);
        assert.ok(hover.includes('Cell 4, 4 again'), hover);
        assert.ok(!hover.includes('{j}') && !hover.includes('{J}'));
    });

    test('stays as written without an index, e.g. when hovering the array itself', () => {
        const hover = formatDescriptionHover({
            ...base, name: 'x',
            configDescriptions: [{ text: 'cell {j}', key: 'x' }],
        });
        assert.ok(hover.includes('cell {j}'), hover);
    });
});

suite('array members in .xppsettings.json: x[2,4], x[1..3, 7]', () => {
    test('a key with indices is accepted, anything else with brackets is reported', () => {
        const config = parseColorConfig({ 'vm[1..3, 7]': '#111', 'vm[a]': '#222', 'vm[2': '#333', vm: '#444' });
        assert.deepStrictEqual(config.selections.map(s => [s.base, s.indices]), [['vm', [1, 2, 3, 7]]]);
        assert.strictEqual(config.errors.length, 2);
    });

    const text = "vm[1..5]'=-vm[j]\naux z=vm1+vm2+vm3+vm4+vm5\ndone";
    const colours = (raw: object) => {
        const out = new Map<string, string[]>();
        for (const e of collectStyledRanges(text, parseColorConfig(raw))) {
            out.set(e.style.color!, e.ranges.map(r => `${r.line}:${r.start}`).sort());
        }
        return out;
    };

    test('colours: own entry, then a selection (the last listed wins), then the array', () => {
        const out = colours({ vm: '#111', 'vm[2..4]': '#222', 'vm[3,4]': '#333', vm4: '#444' });
        assert.deepStrictEqual(out.get('#111'), ['0:0', '0:11', '1:22', '1:6']);   // vm, vm1, vm5 and the array's own uses
        assert.deepStrictEqual(out.get('#222'), ['1:10']);                         // vm2
        assert.deepStrictEqual(out.get('#333'), ['1:14']);                         // vm3
        assert.deepStrictEqual(out.get('#444'), ['1:18']);                         // vm4
    });

    test('descriptions: own, selections last-listed first, then the array', () => {
        const config = parseColorConfig({
            vm: { description: 'array' }, 'vm[2..4]': { description: 'range' }, 'vm[3,4]': { description: 'pair' },
            vm4: { description: 'own' },
        });
        assert.deepStrictEqual(configDescriptionsFor('vm4', 'state', config, 'vm', 4), [
            { text: 'own', key: 'vm4' }, { text: 'pair', key: 'vm[3,4]' },
            { text: 'range', key: 'vm[2..4]' }, { text: 'array', key: 'vm' },
        ]);
        assert.deepStrictEqual(configDescriptionsFor('vm2', 'state', config, 'vm', 2), [
            { text: 'range', key: 'vm[2..4]' }, { text: 'array', key: 'vm' },
        ]);
        assert.deepStrictEqual(configDescriptionsFor('vm1', 'state', config, 'vm', 1), [{ text: 'array', key: 'vm' }]);
    });
});

suite('a "*" in a settings key matches anywhere in a name', () => {
    const config = parseColorConfig({ 'g*': '#111', '*k': '#222', 'f*g': '#333' });
    const match = (name: string) => config.wildcards.filter(w => w.regex.test(name)).map(w => w.pattern);

    test('at the end, at the start and in the middle', () => {
        assert.deepStrictEqual(match('gna'), ['g*']);
        assert.deepStrictEqual(match('gk'), ['g*', '*k']);
        assert.deepStrictEqual(match('xk'), ['*k']);
        assert.deepStrictEqual(match('fog'), ['f*g']);
        assert.deepStrictEqual(match('fg'), ['f*g']);
        assert.deepStrictEqual(match('gfg'), ['g*']);
    });
});

suite('a function\'s arguments are local to its line', () => {
    const text = "w[1..2]'=-w[j]\niion(v,w)=v*w+gk\naux z=w1\ndone";
    const colored = (raw: object) => {
        const out = new Map<string, string[]>();
        for (const e of collectStyledRanges(text, parseColorConfig(raw))) {
            out.set(e.style.color!, e.ranges.map(r => `${r.line}:${r.start}`).sort());
        }
        return out;
    };

    test('"w" in iion(v,w) is not the state array w, so it is not coloured as one', () => {
        assert.deepStrictEqual(colored({ '@states': '#111' }).get('#111'), ['0:0', '0:10', '2:6']);
        assert.deepStrictEqual(colored({ w: '#111' }).get('#111'), ['0:0', '0:10', '2:6']);
    });

    test('the function name and the global names it uses are still coloured', () => {
        assert.deepStrictEqual(colored({ iion: '#222', gk: '#333' }).get('#222'), ['1:0']);
        assert.deepStrictEqual(colored({ iion: '#222', gk: '#333' }).get('#333'), ['1:14']);
    });

    test('x(t)= is a state, not a function with an argument t', () => {
        const out = collectStyledRanges("x(t)=-x\ndone", parseColorConfig({ t: '#444' }));
        assert.strictEqual(out.length, 1);
    });
});

suite('x[3] and x3 are the same member, so the same level', () => {
    const ARRAY9 = "x[1..9]'=-x[j]";
    const names = (...lines: string[]) => collectDescriptions([...lines, ARRAY9, 'done'].join('\n'));

    test('in comments the later one comes first, whichever way it is written', () => {
        const a = names('# x[3]: first', '# x3: second').byName.get('x3')!;
        assert.deepStrictEqual(a.map(e => `${e.level}:${e.text}`), ['exact:second', 'exact:first']);
        const b = names('# x3: first', '# x[3]: second').byName.get('x3')!;
        assert.deepStrictEqual(b.map(e => `${e.level}:${e.text}`), ['exact:second', 'exact:first']);
    });

    test('a single index in a list or range is still a selection', () => {
        const d = names('# x[3, 4]: pair', '# x3: own').byName.get('x3')!;
        assert.deepStrictEqual(d.map(e => `${e.level}:${e.text}`), ['exact:own', 'selection:pair']);
    });

    test('in settings, "vm[4]" is the entry of vm4: the one listed last wins', () => {
        const first = parseColorConfig({ 'vm[4]': '#111', vm4: '#222' });
        assert.strictEqual(first.styles.get('vm4')?.color, '#222');
        assert.deepStrictEqual(first.selections, []);
        const second = parseColorConfig({ vm4: '#222', 'vm[4]': '#111' });
        assert.strictEqual(second.styles.get('vm4')?.color, '#111');
    });
});
