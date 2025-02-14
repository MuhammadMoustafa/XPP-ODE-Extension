import * as assert from 'assert';
import { toggleCommentCore } from '../utils/commentingCore';

// Define test cases as an array of objects
const testCases = [
    // Special Cases
    {
        description: 'Commenting #include',
        input: `#include "aut"`,
        expectedOutput: `# #include "aut"`,
        isIncFile: false,
    },
    {
        description: '#done in .inc file (valid code)',
        input: `#done`,
        expectedOutput: `# #done`, // Should be commented in .inc files
        isIncFile: true,
    },
    {
        description: '#done in .ode file (comment)',
        input: `#done`,
        expectedOutput: `done`, // Input is already a comment, should be uncommented in .ode files
        isIncFile: false,
    },
    {
        description: 'Empty line',
        input: `\n`,
        expectedOutput: `# \n`, // Empty lines should be commented if all selection are empty lines
        isIncFile: false,
    },
    {
        description: 'Multiple Empty line',
        input: `\n\n\n`,
        expectedOutput: `# \n# \n# \n`, // Empty lines should be commented if all selection are empty lines
        isIncFile: false,
    },
    {
        description: 'Line with only #',
        input: `#`,
        expectedOutput: `\n`, // Lines with only # should be removed
        isIncFile: false,
    },
    {
        description: 'Line with leading/trailing spaces and #',
        input: `  #  `,
        expectedOutput: ` `, // Remove # and next space, preserve other spaces
        isIncFile: false,
    },

    // Valid Code
    {
        description: 'Valid code without #include or #done',
        input: `some code`,
        expectedOutput: `# some code`,
        isIncFile: false,
    },
    {
        description: 'Valid code without #include or #done, empty line in between',
        input: `some code\n\nsome code`,
        expectedOutput: `# some code\n# \n# some code`, // Empty lines between valid code should be commented
        isIncFile: false,
    },
    {
        description: 'Valid code including #include',
        input: `some code\n#include "aut"`,
        expectedOutput: `# some code\n# #include "aut"`,
        isIncFile: false,
    },
    {
        description: 'Valid code including #done in .inc file',
        input: `some code\n#done`,
        expectedOutput: `# some code\n# #done`, // #done should be commented in .inc files
        isIncFile: true,
    },

    // Mixed Code
    {
        description: 'Mixed code with comments and valid code',
        input: `# comment\nsome code`,
        expectedOutput: `# # comment\n# some code`, // In case of mixed code, comment all lines
        isIncFile: false,
    },
    {
        description: 'Mixed code including #include',
        input: `# comment\n#include "aut"\nsome code`,
        expectedOutput: `# # comment\n# #include "aut"\n# some code`, // In case of mixed code, comment all lines
        isIncFile: false,
    },
    {
        description: 'Mixed code including #done in .inc file',
        input: `# comment\n#done\nsome code`,
        expectedOutput: `# # comment\n# #done\n# some code`, // #done should be commented in .inc files
        isIncFile: true,
    },
    {
        description: 'Mixed code including #done in .ode file (treated as comment)',
        input: `# comment\n#done\nsome code`,
        expectedOutput: `# # comment\n# #done\n# some code`, // #done should be commented in .ode files
        isIncFile: false,
    },

    // All Comments
    {
        description: 'All lines are comments',
        input: `# comment 1\n# comment 2`,
        expectedOutput: `comment 1\ncomment 2`,
        isIncFile: false,
    },
    {
        description: 'All lines are comments with an empty line in between',
        input: `# comment 1\n\n# comment 2`,
        expectedOutput: `comment 1\n\ncomment 2`, // Empty lines between comments should be ignored
        isIncFile: false,
    },
    {
        description: 'All lines are comments including #done in .ode file',
        input: `# comment\n#done`,
        expectedOutput: `comment\ndone`, // #done should be uncommented in .ode files
        isIncFile: false,
    },
    {
        description: 'All lines are comments including #done in .ode file with a space',
        input: `# comment\n# done`,
        expectedOutput: `comment\ndone`, // #done should be uncommented in .ode files
        isIncFile: false,
    },
    {
        description: 'All lines are comments including #done in .ode file with a space, empty line in between',
        input: `# comment\n\n# done`,
        expectedOutput: `comment\n\ndone`, // #done should be uncommented in .ode files
        isIncFile: false,
    },

    // Edge Cases
    {
        description: 'Line with multiple # characters',
        input: `###include "aut"`,
        expectedOutput: `##include "aut"`,
        isIncFile: false,
    },
    {
        description: 'Line with # done (space after #)',
        input: `# done`,
        expectedOutput: `done`, // Should be treated as a comment and uncommented
        isIncFile: false,
    },
    {
        description: 'Line with only spaces',
        input: `   `,
        expectedOutput: `#    `, // Comment empty lines
        isIncFile: false,
    },
    {
        description: 'Deal with lines that is only # and spaces, single empty space',
        input:`# `,
        expectedOutput:`\n`,
        isIncFile: false,
    },
    {
        description: 'Deal with lines that is only # and spaces, more than one empty space',
        input:`#  `,
        expectedOutput:` `,
        isIncFile: false,
    },
    {
        description: 'Deal with lines that is only # and spaces, Empty line in between',
        input: `# #include "test.inc"\n# \n# #done`,
        expectedOutput: `#include "test.inc"\n\n#done`,
        isIncFile: true,
    }
];

// Run all test cases
suite('Commenting Core Tests', () => {
    testCases.forEach(({ description, input, expectedOutput, isIncFile }) => {
        test(description, () => {
            const {output: output, lineMappings: lineMappings} = toggleCommentCore(input, isIncFile);
            assert.strictEqual(output, expectedOutput);
        });
    });
});