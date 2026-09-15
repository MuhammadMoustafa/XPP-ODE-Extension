import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Test that specifically reproduces and verifies the fix for the user's reported issue:
 * - When moving cursor forward past 't' in dx/dt, dt should NOT be highlighted
 * - When moving cursor backward from positions before 'd' or '/', the variable should be highlighted (not dt)
 * - Rename functionality should always work correctly regardless of cursor position
 */

suite('User Reported Issue - dt Highlighting Fix', () => {
    
    test('reproduce exact user scenario: cursor movement in dx/dt', () => {
        const line = 'dx/dt=x+y';
        
        // Scenario 1: Moving forward - when cursor passes 't', dt should NOT be highlighted
        
        // Position 4 is on 't', should highlight variable 'x'
        const pos4 = detectWordRangeCore(line, 4, 0);
        assert.ok(pos4, "Position 4 (on 't') should detect something");
        assert.strictEqual(pos4?.actualVariableName, 'x', "Position 4 should detect variable 'x', not 'dt'");
        
        // Position 5 is after 't' (on '='), should NOT detect dx/dt pattern
        const pos5 = detectWordRangeCore(line, 5, 0);
        assert.notStrictEqual(pos5?.actualVariableName, 'x', "Position 5 (on '=') should not detect the derivative pattern");

        // Scenario 2: Moving backward - cursor in front of 'd' or '/' should highlight variable
        
        // Position 0 (on 'd') should highlight variable 'x'
        const pos0 = detectWordRangeCore(line, 0, 0);
        assert.ok(pos0, "Position 0 (on 'd') should detect variable");
        assert.strictEqual(pos0?.actualVariableName, 'x', "Position 0 should detect variable 'x'");
        
        // Position 2 (on '/') should highlight variable 'x'  
        const pos2 = detectWordRangeCore(line, 2, 0);
        assert.ok(pos2, "Position 2 (on '/') should detect variable");
        assert.strictEqual(pos2?.actualVariableName, 'x', "Position 2 should detect variable 'x'");
        
        // Verify that all positions within dx/dt pattern return the same variable
        for (let pos = 0; pos <= 4; pos++) {
            const result = detectWordRangeCore(line, pos, 0);
            assert.ok(result, `Position ${pos} should detect variable`);
            assert.strictEqual(result?.actualVariableName, 'x', `Position ${pos} should detect 'x'`);
            assert.strictEqual(result?.range.start.character, 1, `Position ${pos} should highlight variable at position 1`);
            assert.strictEqual(result?.range.end.character, 2, `Position ${pos} should highlight variable until position 2`);
        }
        
    });

    test('verify rename behavior is consistent with highlighting', () => {
        
        const line = 'dx/dt=x+y';
        
        // Test that rename detection matches highlighting detection for all valid positions
        for (let pos = 0; pos <= 4; pos++) {
            const result = detectWordRangeCore(line, pos, 0);
            
            if (result && result.actualVariableName) {
                // If our detector finds a variable, rename should work with that variable
                assert.strictEqual(result.actualVariableName, 'x', `Position ${pos} rename should target variable 'x'`);
            }
        }
        
        // Test position 5 (after 't') - this should NOT be part of derivative pattern
        const pos5 = detectWordRangeCore(line, 5, 0);
        assert.notStrictEqual(pos5?.actualVariableName, 'x', 'Position 5 should not detect derivative pattern');
    });

    test('test with longer variable names to ensure fix works universally', () => {
        
        const line = 'dmyLongVar/dt=myLongVar+1';
        
        // Find the 't' position in this line
        const tPos = line.indexOf('/dt') + 2; // position of 't' in dt
        
        // Position on 't' should detect the variable
        const onT = detectWordRangeCore(line, tPos, 0);
        assert.ok(onT, "Position on 't' should detect variable");
        assert.strictEqual(onT?.actualVariableName, 'myLongVar', "Should detect the correct variable name");
        
        // Position after 't' should NOT detect the derivative pattern
        const afterT = detectWordRangeCore(line, tPos + 1, 0);
        assert.notStrictEqual(afterT?.actualVariableName, 'myLongVar', 'Position after t should not detect derivative pattern');
        
        // Test a few positions backward from 't'
        for (let pos = tPos; pos >= tPos - 3; pos--) {
            const result = detectWordRangeCore(line, pos, 0);
            if (result) {
                assert.strictEqual(result.actualVariableName, 'myLongVar', `Position ${pos} should detect correct variable`);
            }
        }
    });

    test('final verification: the fix prevents dt highlighting issue', () => {
        
        const testCases = [
            { line: 'dx/dt=x+y', variable: 'x', tPos: 4 },
            { line: 'dy/dt=2*y', variable: 'y', tPos: 4 },
            { line: 'dmyVar/dt=myVar*3', variable: 'myVar', tPos: 8 }
        ];
        
        for (const testCase of testCases) {
            
            // Position on t should detect the variable
            const onTResult = detectWordRangeCore(testCase.line, testCase.tPos, 0);
            assert.ok(onTResult, `Should detect variable at position ${testCase.tPos}`);
            assert.strictEqual(onTResult?.actualVariableName, testCase.variable, 
                `Should detect variable '${testCase.variable}'`);
            
            // Position after t should NOT detect the derivative (this was the bug)
            const afterTResult = detectWordRangeCore(testCase.line, testCase.tPos + 1, 0);
            const afterTDetectsDerivative = afterTResult && afterTResult.actualVariableName === testCase.variable;
            
            assert.ok(!afterTDetectsDerivative, 
                `Position ${testCase.tPos + 1} should NOT detect derivative pattern (this was the bug)`);
            
        }
        
    });
});