import * as assert from 'assert';
import * as path from 'path';
import {
    parseColorConfig, mergeColorConfigs, findIdentifierRanges, styleKey, collectStyledRanges, configDescriptionsFor,
    parseSettingsFile, parseConfigFile, parseSettingValues, configFilesFor, LEGACY_COLORS_FILE_NAME, SETTINGS_FILE_NAME,
} from '../src/utils/identifierColorsCore';

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
            assert.deepStrictEqual(parseColorConfig(undefined), { styles: new Map(), wildcards: [], selections: [], groups: new Map(), errors: [] });
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

        test('the look and the description are overridden separately', () => {
            const merged = mergeColorConfigs(
                parseColorConfig({ x: { color: '#111', description: 'parent' }, y: '#222', '@states': '#333' }),
                parseColorConfig({ x: { description: 'child' }, y: { color: '#444', description: 'child' }, '@states': { fontWeight: 'bold' } }));
            assert.deepStrictEqual(merged.styles.get('x'), { color: '#111', description: 'child' });
            assert.deepStrictEqual(merged.styles.get('y'), { color: '#444', description: 'child' });
            assert.deepStrictEqual(merged.groups.get('@states'), { fontWeight: 'bold' });
        });
    });

    suite('parseSettingsFile', () => {
        test('reads the entries under "variables"', () => {
            const config = parseSettingsFile({ variables: { x: '#111', '@states': { fontWeight: 'bold' }, 'v_*': '#222' } }, 'f');
            assert.deepStrictEqual(config.errors, []);
            assert.deepStrictEqual([...config.styles.entries()], [['x', { color: '#111' }]]);
            assert.deepStrictEqual([...config.groups.keys()], ['@states']);
            assert.deepStrictEqual(config.wildcards.map(w => w.pattern), ['v_*']);
            assert.deepStrictEqual(parseSettingsFile({}, 'f').errors, []);
        });

        test('rejects a top level that is not an object', () => {
            for (const raw of [null, [], 'x', 3]) {
                const config = parseSettingsFile(raw, 'f');
                assert.deepStrictEqual(config.errors, ['f: expected an object with a "variables" key']);
                assert.strictEqual(config.styles.size, 0);
            }
        });

        test('reports unknown keys and still applies "variables"', () => {
            const config = parseSettingsFile({ 'x y': 1, variables: { a: '#fff' } }, 'f');
            assert.deepStrictEqual(config.errors, ['f: "x y" is not a known setting (expected "variables")']);
            assert.deepStrictEqual([...config.styles.keys()], ['a']);
        });

        test('points old flat entries to "variables"', () => {
            const config = parseSettingsFile({ gsyn: '#fff', '@states': '#000', 'v_*': '#111' }, 'f');
            assert.strictEqual(config.errors.length, 3);
            assert.ok(config.errors.every(e => e.endsWith('put name, wildcard and @group entries under "variables"')), config.errors.join('\n'));
            assert.strictEqual(config.styles.size + config.groups.size + config.wildcards.length, 0);
        });

        test('reports a bad "variables" value and bad entries inside it', () => {
            assert.deepStrictEqual(parseSettingsFile({ variables: '#fff' }, 'f').errors,
                ['f: "variables": expected an object mapping identifier names to colours']);
            const config = parseSettingsFile({ variables: { a: 'red', b: '#fff' } }, 'f');
            assert.deepStrictEqual([...config.styles.keys()], ['b']);
            assert.deepStrictEqual(config.errors.length, 1);
            assert.ok(config.errors[0].startsWith('f: "variables": "a":'), config.errors[0]);
        });
    });

    suite('legacy configuration', () => {
        const legacyFile = path.join('proj', LEGACY_COLORS_FILE_NAME);
        const settingsFile = path.join('proj', SETTINGS_FILE_NAME);

        test('.xppcolors.json is read flat, with a deprecation warning', () => {
            const config = parseConfigFile(legacyFile, { x: '#111' });
            assert.deepStrictEqual([...config.styles.keys()], ['x']);
            assert.deepStrictEqual(config.errors, [
                `${legacyFile}: ".xppcolors.json" is deprecated; move its entries under "variables" in a ".xppsettings.json" file`,
            ]);
            assert.deepStrictEqual(parseConfigFile(settingsFile, { variables: { x: '#111' } }).errors, []);
        });

        test('in one folder .xppsettings.json applies after .xppcolors.json', () => {
            const root = 'ws';
            const sub = path.join(root, 'models');
            const present = new Set([path.join(root, SETTINGS_FILE_NAME), path.join(sub, SETTINGS_FILE_NAME), path.join(sub, LEGACY_COLORS_FILE_NAME)]);
            assert.deepStrictEqual(configFilesFor(sub, root, f => present.has(f)), [
                path.join(root, SETTINGS_FILE_NAME), path.join(sub, LEGACY_COLORS_FILE_NAME), path.join(sub, SETTINGS_FILE_NAME),
            ]);
            assert.deepStrictEqual(configFilesFor(sub, undefined, f => present.has(f)),
                [path.join(sub, LEGACY_COLORS_FILE_NAME), path.join(sub, SETTINGS_FILE_NAME)]);

            const merged = mergeColorConfigs(
                parseConfigFile(legacyFile, { x: '#111', y: '#222' }),
                parseConfigFile(settingsFile, { variables: { x: '#333' } }));
            assert.deepStrictEqual([...merged.styles.entries()], [['x', { color: '#333' }], ['y', { color: '#222' }]]);
        });

        test('xpp-ode.variables wins over xpp-ode.identifierColors, which is deprecated when used', () => {
            const merged = parseSettingValues({ x: '#333' }, { x: '#111', y: '#222' });
            assert.deepStrictEqual([...merged.styles.entries()], [['x', { color: '#333' }], ['y', { color: '#222' }]]);
            assert.deepStrictEqual(merged.errors, ['setting "xpp-ode.identifierColors" is deprecated; use "xpp-ode.variables"']);
            assert.deepStrictEqual(parseSettingValues({ x: '#333' }, {}).errors, []);
            assert.deepStrictEqual(parseSettingValues(undefined, undefined).errors, []);
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

    suite('descriptions', () => {
        test('a description is trimmed and kept with the style', () => {
            const config = parseColorConfig({ gna: { color: '#f00', description: '  sodium conductance  ' } });
            assert.deepStrictEqual(config.errors, []);
            assert.deepStrictEqual(config.styles.get('gna'), { color: '#f00', description: 'sodium conductance' });
        });

        test('an object with only a description is valid', () => {
            const config = parseColorConfig({ gna: { description: 'sodium' }, 'v_*': { description: 'voltages' }, '@states': { description: 'states' } });
            assert.deepStrictEqual(config.errors, []);
            assert.deepStrictEqual(config.styles.get('gna'), { description: 'sodium' });
            assert.deepStrictEqual(config.wildcards.map(w => w.style), [{ description: 'voltages' }]);
            assert.deepStrictEqual(config.groups.get('@states'), { description: 'states' });
        });

        test('an empty or non-string description is an error', () => {
            const config = parseColorConfig({ a: { description: '   ' }, b: { color: '#fff', description: 5 }, ok: { description: 'fine' } }, 'f');
            assert.deepStrictEqual([...config.styles.keys()], ['ok']);
            assert.strictEqual(config.errors.length, 2);
            assert.ok(config.errors.every(e => e.startsWith('f: ')));
        });

        test('description-only entries produce no styled ranges', () => {
            const text = "par v_na=1, gna=2\nx'=-x*gna\ndone";
            assert.deepStrictEqual(collectStyledRanges(text, parseColorConfig({
                gna: { description: 'sodium' }, 'v_*': { description: 'voltages' }, '@states': { description: 'states' },
            })), []);
            const mixed = collectStyledRanges(text, parseColorConfig({ gna: { description: 'sodium' }, x: '#111' }));
            assert.deepStrictEqual(mixed.map(e => e.style.color), ['#111']);
        });
    });

    suite('configDescriptionsFor', () => {
        const config = parseColorConfig({
            'g*': { description: 'first wildcard' },
            '*na': { description: 'second wildcard' },
            '*a': '#123',
            gna: { color: '#f00', description: 'exact' },
            gk: '#0f0',
            '@parameters': { description: 'group' },
            x: { description: 'array' },
            x7: { description: 'member' },
            '@states': { description: 'states' },
        });

        test('exact, then wildcards last-listed first, then the group', () => {
            assert.deepStrictEqual(configDescriptionsFor('gna', 'parameter', config), [
                { text: 'exact', key: 'gna' },
                { text: 'second wildcard', key: '*na' },
                { text: 'first wildcard', key: 'g*' },
                { text: 'group', key: '@parameters' },
            ]);
        });

        test('levels without a description are skipped and do not hide the others', () => {
            assert.deepStrictEqual(configDescriptionsFor('gk', 'parameter', config), [
                { text: 'first wildcard', key: 'g*' },
                { text: 'group', key: '@parameters' },
            ]);
        });

        test('no kind means no group', () => {
            assert.deepStrictEqual(configDescriptionsFor('gk', undefined, config), [{ text: 'first wildcard', key: 'g*' }]);
            assert.deepStrictEqual(configDescriptionsFor('zz', undefined, config), []);
        });

        test('an array member gets its base after its own entry', () => {
            assert.deepStrictEqual(configDescriptionsFor('x7', 'state', config, 'x'), [
                { text: 'member', key: 'x7' },
                { text: 'array', key: 'x' },
                { text: 'states', key: '@states' },
            ]);
        });

        test('a name that is not an array member does not get a base', () => {
            assert.deepStrictEqual(configDescriptionsFor('x7', 'state', config).map(d => d.key), ['x7', '@states']);
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
