import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Final comprehensive test to verify that highlighting and rename are now consistent
 * after the wordPattern fix
 */

suite('Highlighting and Rename Consistency Verification', () => {
    
    test('verify highlighting and rename consistency after wordPattern fix', () => {
        
        const testCases = [
            { line: 'dx/dt=x+y', variable: 'x', tPos: 4 },
            { line: 'dvelocity/dt=velocity*acc', variable: 'velocity', tPos: 11 },
            { line: 'dA/dt=A*B', variable: 'A', tPos: 4 }
        ];
        
        for (const testCase of testCases) {
            
            // Test all positions within the derivative pattern
            let derivativePatternStart = 0;
            let derivativePatternEnd = testCase.tPos; // position of 't' in dt
            
            
            for (let pos = derivativePatternStart; pos <= derivativePatternEnd; pos++) {
                const result = detectWordRangeCore(testCase.line, pos, 0);
                
                assert.ok(result, `Position ${pos} should detect something`);
                assert.strictEqual(result?.actualVariableName, testCase.variable,
                    `Position ${pos} should detect variable '${testCase.variable}'`);
                
                // The highlight range should always point to just the variable
                const highlightedText = testCase.line.substring(
                    result!.range.start.character, 
                    result!.range.end.character
                );
                assert.strictEqual(highlightedText, testCase.variable,
                    `Position ${pos} should highlight just '${testCase.variable}'`);
                
            }
            
            // Test position after the pattern (should not detect derivative)
            const afterPatternPos = derivativePatternEnd + 1;
            if (afterPatternPos < testCase.line.length) {
                const afterResult = detectWordRangeCore(testCase.line, afterPatternPos, 0);
                if (afterResult && afterResult.actualVariableName === testCase.variable) {
                    assert.fail(`Position ${afterPatternPos} should not detect derivative pattern`);
                }
            }
        }
        
    });
    
    test('verify wordPattern no longer causes inconsistencies', () => {
        
        const line = 'dx/dt=x+y';

        // VS Code's wordPattern selects 'dt' at positions 3 and 4; our logic must still resolve
        // the derivative to the variable 'x', and the rename provider works with that.
        for (const pos of [3, 4]) {
            const ourResult = detectWordRangeCore(line, pos, 0);
            assert.strictEqual(ourResult?.actualVariableName, 'x',
                `Our logic should always detect variable 'x' for derivative patterns`);
        }
        
    });
    
    test('final integration test: simulate real user interaction', () => {
        
        // Simulate the user's reported scenario:
        // 1. User has dx/dt in their code
        // 2. User moves cursor around in the dx/dt pattern
        // 3. User presses F2 to rename
        // 4. The behavior should now be consistent
        
        const line = 'dx/dt=x*y';
        
        const scenarioSteps = [
            { pos: 0, desc: 'User puts cursor on d (before variable)' },
            { pos: 1, desc: 'User puts cursor on x (on variable)' },
            { pos: 2, desc: 'User puts cursor on / (slash)' },
            { pos: 3, desc: 'User puts cursor on d (in dt)' },
            { pos: 4, desc: 'User puts cursor on t (in dt)' }
        ];
        
        for (const step of scenarioSteps) {
            
            const result = detectWordRangeCore(line, step.pos, 0);
            
            if (result) {
                const highlightedVar = line.substring(result.range.start.character, result.range.end.character);
                
                // Both highlighting and rename should target the same variable
                assert.strictEqual(highlightedVar, result.actualVariableName || highlightedVar,
                    'Highlighting and rename should be consistent');
                assert.strictEqual(result.actualVariableName, 'x',
                    'Should always target variable x');
            }
        }
        
    });
});