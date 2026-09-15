import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

suite('DT Selection Handling Tests', () => {
    test('cursor on the "dt" of dx/dt resolves to the variable x', () => {
        const line = 'dx/dt=x*y';
        for (const position of [3, 4]) {
            const result = detectWordRangeCore(line, position, 0);
            assert.ok(result, `position ${position} should detect the derivative`);
            assert.strictEqual(result?.actualVariableName, 'x', `position ${position} should resolve to x, not dt`);
        }
    });

    test('should not detect numbers as words', () => {
        const line = 'x=2.5*y+3';
        for (const position of [2, 3, 4, 10]) {
            assert.strictEqual(detectWordRangeCore(line, position, 0), undefined, `position ${position} is inside a number`);
        }
    });
});
