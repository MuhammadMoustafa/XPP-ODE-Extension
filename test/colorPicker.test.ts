import * as assert from 'assert';
import { findHexColors, hexToRgba, rgbaToHex } from '../src/utils/colorPickerCore';

suite('Colour picker support', () => {
    test('converts hex to components and back', () => {
        assert.deepStrictEqual(hexToRgba('#f00'), { red: 1, green: 0, blue: 0, alpha: 1 });
        assert.deepStrictEqual(hexToRgba('#00ff0080').alpha, 128 / 255);
        assert.strictEqual(rgbaToHex(1, 0, 0, 1), '#ff0000');
        assert.strictEqual(rgbaToHex(0, 1, 0, 0.5), '#00ff0080');
    });

    test('finds every hex string in a colours file with line and column', () => {
        const text = '{\n  "v": "#ff5555",\n  "w": { "color": "#0F0", "dark": { "backgroundColor": "#12345678" } },\n  "bad": "red"\n}';
        const found = findHexColors(text);
        assert.deepStrictEqual(found.map(m => [m.line, m.start, m.end]), [[1, 8, 15], [2, 19, 23], [2, 56, 65]]);
    });

    test('in settings.json only looks inside the identifierColors object', () => {
        const text = '{\n  "workbench.colorCustomizations": { "editor.background": "#000000" },\n' +
            '  "xpp-ode.identifierColors": { "v": "#ff5555", "x": { "color": "#00ff00" } },\n  "other": "#123456"\n}';
        const found = findHexColors(text, 'xpp-ode.identifierColors');
        assert.deepStrictEqual(found.map(m => [m.line, m.start]), [[2, 38], [2, 65]]);
        assert.deepStrictEqual(findHexColors('{ "a": "#fff" }', 'xpp-ode.identifierColors'), []);
    });
});
