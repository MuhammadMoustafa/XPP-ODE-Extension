import * as assert from 'assert';
import { toggleCommentCore } from '../utils/commentingCore';

suite('Commenting Core Tests', () => {

    test('Commenting #include', () => {
        const input = `#include "aut"`;
        const expectedOutput = `# #include "aut"`;
        const output = toggleCommentCore(input);
        assert.strictEqual(output, expectedOutput);
    });

        test('Commenting lines in ode file', () => {
        const input = `#include "aut"\n#done\nsome code\n# some comment`;
        const expectedOutput = `# #include "aut"\ndone\n# some code\nsome comment`;
        const output = toggleCommentCore(input);
        assert.strictEqual(output, expectedOutput);
    });

    test('Uncommenting lines', () => {
        const input = `##include "aut"\n##done\n# some code\nsome comment`;
        const expectedOutput = `#include "aut"\n#done\nsome code\n# some comment`;
        const output = toggleCommentCore(input);
        assert.strictEqual(output, expectedOutput);
    });

    test('Commenting lines in .inc file', () => {
        const input = `#include "aut"\n#done\nsome code\n# some comment`;
        const expectedOutput = `# #include "aut"\n# #done\n# some code\nsome comment`;
        const output = toggleCommentCore(input, true); // Pass `true` for .inc files
        assert.strictEqual(output, expectedOutput);
    });

    test('Uncommenting lines in .inc file', () => {
        const input = `##include "aut"\n# #done\n# some code\nsome comment`;
        const expectedOutput = `#include "aut"\n#done\nsome code\n# some comment`;
        const output = toggleCommentCore(input, true); // Pass `true` for .inc files
        assert.strictEqual(output, expectedOutput);
    });
});