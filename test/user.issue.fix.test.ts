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
        console.log(`\nTesting user scenario with line: "${line}"`);
        
        // Scenario 1: Moving forward - when cursor passes 't', dt should NOT be highlighted
        console.log('\n=== Scenario 1: Moving forward past t ===');
        
        // Position 4 is on 't', should highlight variable 'x'
        const pos4 = detectWordRangeCore(line, 4, 0);
        assert.ok(pos4, "Position 4 (on 't') should detect something");
        assert.strictEqual(pos4?.actualVariableName, 'x', "Position 4 should detect variable 'x', not 'dt'");
        console.log(`✅ Position 4 (on 't'): correctly detects variable '${pos4?.actualVariableName}'`);
        
        // Position 5 is after 't' (on '='), should NOT detect dx/dt pattern
        const pos5 = detectWordRangeCore(line, 5, 0);
        if (pos5 && pos5.actualVariableName === 'x') {
            console.log('❌ Position 5 still detects derivative pattern - this would cause the reported issue!');
        } else {
            console.log('✅ Position 5 (after t) does not detect derivative pattern - issue is fixed!');
        }
        
        // Scenario 2: Moving backward - cursor in front of 'd' or '/' should highlight variable
        console.log('\n=== Scenario 2: Moving backward to positions before d or / ===');
        
        // Position 0 (on 'd') should highlight variable 'x'
        const pos0 = detectWordRangeCore(line, 0, 0);
        assert.ok(pos0, "Position 0 (on 'd') should detect variable");
        assert.strictEqual(pos0?.actualVariableName, 'x', "Position 0 should detect variable 'x'");
        console.log(`✅ Position 0 (on 'd'): correctly detects variable '${pos0?.actualVariableName}'`);
        
        // Position 2 (on '/') should highlight variable 'x'  
        const pos2 = detectWordRangeCore(line, 2, 0);
        assert.ok(pos2, "Position 2 (on '/') should detect variable");
        assert.strictEqual(pos2?.actualVariableName, 'x', "Position 2 should detect variable 'x'");
        console.log(`✅ Position 2 (on '/'): correctly detects variable '${pos2?.actualVariableName}'`);
        
        // Verify that all positions within dx/dt pattern return the same variable
        console.log('\n=== Verifying consistency across all positions ===');
        for (let pos = 0; pos <= 4; pos++) {
            const result = detectWordRangeCore(line, pos, 0);
            assert.ok(result, `Position ${pos} should detect variable`);
            assert.strictEqual(result?.actualVariableName, 'x', `Position ${pos} should detect 'x'`);
            assert.strictEqual(result?.range.start.character, 1, `Position ${pos} should highlight variable at position 1`);
            assert.strictEqual(result?.range.end.character, 2, `Position ${pos} should highlight variable until position 2`);
        }
        
        console.log('✅ All positions 0-4 consistently detect variable "x" with correct range');
    });

    test('verify rename behavior is consistent with highlighting', () => {
        console.log('\n=== Testing rename consistency ===');
        
        const line = 'dx/dt=x+y';
        
        // Test that rename detection matches highlighting detection for all valid positions
        for (let pos = 0; pos <= 4; pos++) {
            const result = detectWordRangeCore(line, pos, 0);
            
            if (result && result.actualVariableName) {
                // If our detector finds a variable, rename should work with that variable
                console.log(`Position ${pos}: Would rename variable '${result.actualVariableName}'`);
                assert.strictEqual(result.actualVariableName, 'x', `Position ${pos} rename should target variable 'x'`);
            }
        }
        
        // Test position 5 (after 't') - this should NOT be part of derivative pattern
        const pos5 = detectWordRangeCore(line, 5, 0);
        if (pos5 && pos5.actualVariableName === 'x') {
            console.log('❌ Position 5 would incorrectly try to rename derivative variable');
            assert.fail('Position 5 should not detect derivative pattern');
        } else {
            console.log('✅ Position 5 correctly does not detect derivative pattern');
        }
    });

    test('test with longer variable names to ensure fix works universally', () => {
        console.log('\n=== Testing with longer variable names ===');
        
        const line = 'dmyLongVar/dt=myLongVar+1';
        console.log(`Testing with: "${line}"`);
        
        // Find the 't' position in this line
        const tPos = line.indexOf('/dt') + 2; // position of 't' in dt
        console.log(`Position of 't' in dt: ${tPos}`);
        
        // Position on 't' should detect the variable
        const onT = detectWordRangeCore(line, tPos, 0);
        assert.ok(onT, "Position on 't' should detect variable");
        assert.strictEqual(onT?.actualVariableName, 'myLongVar', "Should detect the correct variable name");
        console.log(`✅ Position ${tPos} (on 't'): detects variable '${onT?.actualVariableName}'`);
        
        // Position after 't' should NOT detect the derivative pattern
        const afterT = detectWordRangeCore(line, tPos + 1, 0);
        if (afterT && afterT.actualVariableName === 'myLongVar') {
            console.log(`❌ Position ${tPos + 1} incorrectly detects derivative pattern`);
            assert.fail('Position after t should not detect derivative pattern');
        } else {
            console.log(`✅ Position ${tPos + 1} correctly does not detect derivative pattern`);
        }
        
        // Test a few positions backward from 't'
        for (let pos = tPos; pos >= tPos - 3; pos--) {
            const result = detectWordRangeCore(line, pos, 0);
            if (result) {
                console.log(`  Position ${pos} (moving backward): detects '${result.actualVariableName}'`);
                assert.strictEqual(result.actualVariableName, 'myLongVar', `Position ${pos} should detect correct variable`);
            }
        }
    });

    test('final verification: the fix prevents dt highlighting issue', () => {
        console.log('\n=== Final Verification ===');
        
        const testCases = [
            { line: 'dx/dt=x+y', variable: 'x', tPos: 4 },
            { line: 'dy/dt=2*y', variable: 'y', tPos: 4 },
            { line: 'dmyVar/dt=myVar*3', variable: 'myVar', tPos: 8 }
        ];
        
        for (const testCase of testCases) {
            console.log(`\nTesting: "${testCase.line}"`);
            
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
            
            console.log(`  ✅ Position ${testCase.tPos} (on 't'): detects '${testCase.variable}'`);
            console.log(`  ✅ Position ${testCase.tPos + 1} (after 't'): does not detect derivative pattern`);
        }
        
        console.log('\n🎉 All tests pass - the dt highlighting issue has been fixed!');
    });
});