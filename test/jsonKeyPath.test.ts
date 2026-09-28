import * as assert from 'assert';
import { keyPathAt } from '../src/utils/jsonKeyPathCore';

suite('JSON key path', () => {
    test('top-level key positions give an empty path', () => {
        assert.deepStrictEqual(keyPathAt('{ '), []);
        assert.deepStrictEqual(keyPathAt('{ "var'), []);
        assert.deepStrictEqual(keyPathAt('{ "a": "#fff", "'), []);
    });

    test('key positions inside nested objects give the enclosing keys', () => {
        assert.deepStrictEqual(keyPathAt('{ "variables": { '), ['variables']);
        assert.deepStrictEqual(keyPathAt('{ "variables": { "x": { "color": "#fff" }, "g'), ['variables']);
        assert.deepStrictEqual(keyPathAt('{ "variables": { "x": { "'), ['variables', 'x']);
        assert.deepStrictEqual(keyPathAt('{ "other": {}, "variables": {\n  "a": "#f,{", '), ['variables']);
    });

    test('value positions and arrays are not key positions', () => {
        assert.strictEqual(keyPathAt(''), undefined);
        assert.strictEqual(keyPathAt('{ "a": '), undefined);
        assert.strictEqual(keyPathAt('{ "a": "#f'), undefined);
        assert.strictEqual(keyPathAt('{ "a": [ '), undefined);
        assert.strictEqual(keyPathAt('{ "a": {} }'), undefined);
    });
});
