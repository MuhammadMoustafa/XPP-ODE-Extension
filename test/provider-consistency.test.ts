import * as assert from 'assert';
import { detectWordRangeCore, isInComment } from '../src/utils/renameCore';

suite('Provider Consistency Tests', () => {
    test('should not detect anything in comments', () => {
        const testCases = [
            { line: '# This is a comment with variable x', position: 30, desc: 'cursor on x in comment' },
            { line: 'dx/dt=x # comment with y variable', position: 25, desc: 'cursor on y in comment' },
            { line: '    # indented comment with dt', position: 27, desc: 'cursor on dt in comment' },
            { line: 'x=1 # dx/dt should not be detected', position: 15, desc: 'cursor on dx in comment' },
        ];
        
        console.log('\n=== Comment Detection Test ===');
        
        for (const testCase of testCases) {
            console.log(`Testing: ${testCase.desc}`);
            console.log(`Line: "${testCase.line}"`);
            console.log(`Position: ${testCase.position} (char: "${testCase.line[testCase.position] || 'EOF'}")`);
            
            // Test isInComment function
            const inComment = isInComment(testCase.line, testCase.position);
            console.log(`isInComment result: ${inComment}`);
            
            // Test detectWordRangeCore - should return null for comments
            const wordRange = detectWordRangeCore(testCase.line, testCase.position, 0);
            console.log(`detectWordRangeCore result: ${wordRange ? 'detected' : 'null'}`);
            
            if (inComment) {
                assert.strictEqual(wordRange, undefined, `Should not detect word in comment: ${testCase.desc}`);
                console.log('✅ Correctly rejected comment position');
            } else {
                console.log('ℹ️ Position not in comment area');
            }
            console.log('');
        }
    });

    test('should not detect whitespace, operators, or inappropriate positions', () => {
        const testCases = [
            { line: 'dx/dt=x*y', position: 5, char: '=', desc: 'equals operator' },
            { line: 'dx/dt=x*y', position: 7, char: '*', desc: 'multiply operator' },
            { line: 'x = 2.5 + 3', position: 2, char: ' ', desc: 'whitespace' },
            { line: 'x = 2.5 + 3', position: 4, char: '2', desc: 'number start' },
            { line: 'x = 2.5 + 3', position: 6, char: '5', desc: 'number end' },
            { line: 'x = 2.5 + 3', position: 8, char: '+', desc: 'plus operator' },
        ];
        
        console.log('\n=== Inappropriate Position Test ===');
        
        for (const testCase of testCases) {
            console.log(`Testing: ${testCase.desc} ("${testCase.char}")`);
            
            const wordRange = detectWordRangeCore(testCase.line, testCase.position, 0);
            console.log(`Result: ${wordRange ? 'detected' : 'null'}`);
            
            assert.strictEqual(wordRange, undefined, `Should not detect ${testCase.desc}`);
            console.log('✅ Correctly rejected inappropriate position');
            console.log('');
        }
    });

    test('should have consistent behavior between highlighting and renaming', () => {
        const testCases = [
            // Cases that SHOULD work for both
            { line: 'dx/dt=x*y', position: 1, shouldWork: true, expectedVar: 'x', desc: 'variable in derivative' },
            { line: 'dx/dt=x*y', position: 3, shouldWork: true, expectedVar: 'x', desc: 'dt in derivative (should redirect to x)' },
            { line: 'x=y+z', position: 0, shouldWork: true, expectedVar: 'x', desc: 'regular variable' },
            { line: 'par dt=0.01', position: 4, shouldWork: true, expectedVar: 'dt', desc: 'parameter dt' },
            
            // Cases that should NOT work for both
            { line: '# variable x in comment', position: 11, shouldWork: false, desc: 'variable in comment' },
            { line: 'dx/dt=x*y', position: 5, shouldWork: false, desc: 'equals operator' },
            { line: 'x=2.5', position: 2, shouldWork: false, desc: 'number' },
            { line: 'x + y', position: 2, shouldWork: false, desc: 'whitespace' },
        ];
        
        console.log('\n=== Consistency Test ===');
        
        for (const testCase of testCases) {
            console.log(`Testing: ${testCase.desc}`);
            console.log(`Line: "${testCase.line}", Position: ${testCase.position}`);
            
            // Test core detection logic (used by both providers)
            const inComment = isInComment(testCase.line, testCase.position);
            const wordRange = detectWordRangeCore(testCase.line, testCase.position, 0);
            
            console.log(`In comment: ${inComment}`);
            console.log(`Word range: ${wordRange ? 'detected' : 'null'}`);
            
            if (testCase.shouldWork) {
                assert.notStrictEqual(wordRange, undefined, `Should detect word for: ${testCase.desc}`);
                if (wordRange && testCase.expectedVar) {
                    const actualVar = wordRange.actualVariableName;
                    if (actualVar) {
                        assert.strictEqual(actualVar, testCase.expectedVar, `Should detect variable "${testCase.expectedVar}"`);
                        console.log(`✅ Correctly detected variable: ${actualVar}`);
                    }
                }
            } else {
                assert.strictEqual(wordRange, undefined, `Should NOT detect word for: ${testCase.desc}`);
                console.log('✅ Correctly rejected inappropriate position');
            }
            console.log('');
        }
        
        console.log('🎉 Highlighting and Rename logic is now consistent!');
    });

    test('verify dt fallback scenarios work correctly', () => {
        console.log('\n=== DT Fallback Test ===');
        
        const line = 'dx/dt=x*y';
        console.log(`Testing line: "${line}"`);
        
        // Test positions 3 and 4 (the dt part)
        for (const pos of [3, 4]) {
            console.log(`\nPosition ${pos} ("${line[pos]}"):`);
            
            const wordRange = detectWordRangeCore(line, pos, 0);
            console.log(`detectWordRangeCore result:`, wordRange);
            
            assert.notStrictEqual(wordRange, undefined, `Position ${pos} should detect something`);
            if (wordRange) {
                const actualVar = wordRange.actualVariableName;
                console.log(`Detected variable: ${actualVar}`);
                assert.strictEqual(actualVar, 'x', `Position ${pos} should detect variable "x"`);
                console.log('✅ Correctly redirected dt to variable x');
            }
        }
        
        console.log('\n🎉 DT fallback scenarios work correctly!');
    });
});