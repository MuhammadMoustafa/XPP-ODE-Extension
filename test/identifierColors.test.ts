import * as assert from 'assert';
import { parseColorConfig, mergeColorConfigs, findIdentifierRanges, styleKey, collectStyledRanges } from '../src/utils/identifierColorsCore';

suite('Identifier colours', () => {
    suite('parseColorConfig', () => {
        test('accepts hex strings and style objects, lower-casing names', () => {
            const config = parseColorConfig({ X: '#ff0000', a: { color: '#0F0', fontWeight: 'bold' }, b: { color: '#00000080', fontStyle: 'italic' } });
            assert.deepStrictEqual(config.errors, []);
            assert.deepStrictEqual([...config.styles.entries()], [
                ['x', { color: '#ff0000' }],
                ['a', { color: '#0F0', fontWeight: 'bold' }],
                ['b', { color: '#00000080', fontStyle: 'italic' }],
            ]);
        });

        test('rejects bad names, colours and styles but keeps the valid entries', () => {
            const config = parseColorConfig({
                'x y': '#fff', a: 'red', b: { color: '#fff', fontStyle: 'bold' }, c: {}, d: 5,
                e: { backgroundColor: 'blue' }, f: { textDecoration: 'underline; color: red' }, g: { opacity: 2 },
                h: { light: '#fff' }, i: { dark: { color: 'x' } }, ok: '#123456',
            }, 'f');
            assert.deepStrictEqual([...config.styles.keys()], ['ok']);
            assert.strictEqual(config.errors.length, 10);
            assert.ok(config.errors.every(e => e.startsWith('f: ')));
        });

        test('accepts background, text decoration, opacity and light/dark variants', () => {
            const config = parseColorConfig({
                v: { backgroundColor: '#ffff0080', textDecoration: 'underline wavy', opacity: '0.7' },
                w: { light: { color: '#000' }, dark: { color: '#fff', fontWeight: 'bold' } },
                z: { color: '#123', dark: { backgroundColor: '#456' } },
            });
            assert.deepStrictEqual(config.errors, []);
            assert.deepStrictEqual(config.styles.get('v'), { backgroundColor: '#ffff0080', textDecoration: 'underline wavy', opacity: 0.7 });
            assert.deepStrictEqual(config.styles.get('w'), { light: { color: '#000' }, dark: { color: '#fff', fontWeight: 'bold' } });
            assert.notStrictEqual(styleKey(config.styles.get('w')!), styleKey(config.styles.get('z')!));
            assert.strictEqual(styleKey({ light: { color: '#ABC' } }), styleKey({ light: { color: '#abc' } }));
        });

        test('non-object input is an error, undefined is empty', () => {
            assert.strictEqual(parseColorConfig(['#fff']).errors.length, 1);
            assert.deepStrictEqual(parseColorConfig(undefined), { styles: new Map(), wildcards: [], groups: new Map(), errors: [] });
        });

        test('accepts * wildcards and rejects other pattern characters', () => {
            const config = parseColorConfig({ 'V_*': '#111', '*_syn': '#222', 'u*x': '#333', '*': '#444', 'a.*': '#555' });
            assert.deepStrictEqual(config.wildcards.map(w => w.pattern), ['v_*', '*_syn', 'u*x']);
            assert.strictEqual(config.errors.length, 2);
            assert.ok(config.wildcards[0].regex.test('v_na') && !config.wildcards[0].regex.test('xv_na'));
            assert.ok(config.wildcards[2].regex.test('ux') && config.wildcards[2].regex.test('u_1_x') && !config.wildcards[2].regex.test('uxy'));
        });

        test('accepts borders and known @groups, rejects unknown groups', () => {
            const config = parseColorConfig({
                '@States': { borderColor: '#ff0', borderStyle: 'dashed', borderWidth: 2, borderRadius: '3px' },
                '@nope': '#fff', x: { borderColor: 'red' }, y: { borderStyle: 'wavy' }, z: { borderWidth: '1px solid' },
            });
            assert.deepStrictEqual([...config.groups.entries()], [['@states', { borderColor: '#ff0', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '3px' }]]);
            assert.strictEqual(config.errors.length, 4);
        });

        test('later configurations override earlier ones', () => {
            const merged = mergeColorConfigs(parseColorConfig({ x: '#111', y: '#222' }), parseColorConfig({ x: '#333' }));
            assert.deepStrictEqual([...merged.styles.entries()], [['x', { color: '#333' }], ['y', { color: '#222' }]]);
            assert.strictEqual(styleKey({ color: '#ABC' }), styleKey({ color: '#abc', fontStyle: undefined }));
        });
    });

    suite('collectStyledRanges with groups', () => {
        const text = [
            'par a=1,b=2',
            'c=a*2',
            'f(u)=u*b',
            "x'=-x*a+sin(t)+f(c)",
            'aux z=x+c',
            '@ xp=x,total=100',
            'done',
        ].join('\n');
        const styled = (raw: object) => {
            const out = new Map<string, string[]>();
            for (const e of collectStyledRanges(text, parseColorConfig(raw))) {
                out.set(e.style.color!, e.ranges.map(r => `${r.line}:${r.start}`).sort());
            }
            return out;
        };

        test('colours every use of the names in a group, resolved through the parser', () => {
            const out = styled({ '@states': '#111', '@parameters': '#222', '@fixed': '#333', '@functions': '#444', '@aux': '#555' });
            assert.deepStrictEqual(out.get('#111'), ['3:0', '3:4', '4:6', '5:5']);
            assert.deepStrictEqual(out.get('#222'), ['0:4', '0:8', '1:2', '2:7', '3:6']);
            assert.deepStrictEqual(out.get('#333'), ['1:0', '3:17', '4:8']);
            assert.deepStrictEqual(out.get('#444'), ['2:0', '3:15']);
            assert.deepStrictEqual(out.get('#555'), ['4:4']);
        });

        test('builtins, options and keywords', () => {
            const out = styled({ '@builtins': '#111', '@options': '#222', '@keywords': '#333' });
            assert.deepStrictEqual(out.get('#111'), ['3:12', '3:8']);
            assert.deepStrictEqual(out.get('#222'), ['5:2', '5:7']);
            assert.deepStrictEqual(out.get('#333'), ['0:0', '4:0', '6:0']);
        });

        test('an explicit name wins over its group, and options beat name groups on @ lines', () => {
            const out = styled({ '@parameters': '#222', a: '#999', '@states': '#111', '@options': '#333' });
            assert.deepStrictEqual(out.get('#999'), ['0:4', '1:2', '3:6']);
            assert.deepStrictEqual(out.get('#222'), ['0:8', '2:7']);
            assert.deepStrictEqual(out.get('#111'), ['3:0', '3:4', '4:6', '5:5']);
            assert.deepStrictEqual(out.get('#333'), ['5:2', '5:7']);
        });
    });

    suite('collectStyledRanges with wildcards and arrays', () => {
        const styled = (text: string, raw: object) => {
            const out = new Map<string, string[]>();
            for (const e of collectStyledRanges(text, parseColorConfig(raw))) {
                out.set(e.style.color!, e.ranges.map(r => `${r.line}:${r.start}`).sort());
            }
            return out;
        };

        test('wildcards match whole words, later patterns win, exact names beat wildcards, wildcards beat groups', () => {
            const text = "par v_na=1,v_k=2,g_k=3\nx'=-x*v_na+v_k+g_k\ndone";
            const out = styled(text, { 'v_*': '#111', '*_k': '#222', v_na: '#333', '@parameters': '#444' });
            assert.deepStrictEqual(out.get('#333'), ['0:4', '1:6']);
            assert.deepStrictEqual(out.get('#222'), ['0:11', '0:17', '1:11', '1:15']);
            assert.strictEqual(out.get('#111'), undefined);
            assert.strictEqual(out.get('#444'), undefined);
        });

        test('an array name covers its members and its indexed uses, in explicit entries and groups', () => {
            const text = "u[0..2]'=-u[j]+u[j+1]\naux z=u1+u0\nx'=-x\ndone";
            const explicit = styled(text, { u: '#111' });
            assert.deepStrictEqual(explicit.get('#111'), ['0:0', '0:10', '0:15', '1:6', '1:9']);
            const grouped = styled(text, { '@states': '#222', u1: '#333' });
            assert.deepStrictEqual(grouped.get('#222'), ['0:0', '0:10', '0:15', '1:9', '2:0', '2:4']);
            assert.deepStrictEqual(grouped.get('#333'), ['1:6']);
        });
    });

    suite('findIdentifierRanges', () => {
        test('matches whole words in code only, case-insensitively, including dx/dt', () => {
            const lines = [
                'par a=1, ab=2   # a in a comment',
                "x'=-x*a+A",
                'dX/dt=-x+ab',
                'y(t)=int{exp(-t)#x}',
                'done',
                'x a text after done',
            ];
            const ranges = findIdentifierRanges(lines, new Set(['x', 'a']));
            assert.deepStrictEqual(ranges.get('a'), [
                { line: 0, start: 4, end: 5 }, { line: 1, start: 6, end: 7 }, { line: 1, start: 8, end: 9 },
            ]);
            assert.deepStrictEqual(ranges.get('x'), [
                { line: 1, start: 0, end: 1 }, { line: 1, start: 4, end: 5 },
                { line: 2, start: 1, end: 2 }, { line: 2, start: 7, end: 8 },
                { line: 3, start: 17, end: 18 },
            ]);
        });

        test('does not match inside numbers or longer names', () => {
            const ranges = findIdentifierRanges(["x'=1e-3*e+ex"], new Set(['e']));
            assert.deepStrictEqual(ranges.get('e'), [{ line: 0, start: 8, end: 9 }]);
            assert.strictEqual(findIdentifierRanges(['x=1'], new Set()).size, 0);
        });
    });
});
