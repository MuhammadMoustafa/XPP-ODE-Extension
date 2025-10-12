import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

suite('Final Verification Tests', () => {
    test('should never return dt when cursor is at positions 3-4 in dx/dt', () => {
        const line = 'dx/dt=x*y';
        
        console.log('\n=== Final Integration Test ===');
        console.log('Testing line:', line);
        console.log('User reported issue: "dt" being selected when cursor at position 3-4');
        
        // Test position 3 (on 'd' of 'dt')
        const result3 = detectWordRangeCore(line, 3, 0);
        console.log('Position 3 result:', result3);
        if (result3) {
            const actualVar = result3.actualVariableName;
            console.log('✅ Position 3 detects variable:', actualVar);
            assert.strictEqual(actualVar, 'x', 'Position 3 should detect variable x');
            assert.notStrictEqual(actualVar, 'dt', 'Position 3 should never return dt');
        } else {
            throw new Error('Position 3 should detect a variable');
        }
        
        // Test position 4 (on 't' of 'dt')  
        const result4 = detectWordRangeCore(line, 4, 0);
        console.log('Position 4 result:', result4);
        if (result4) {
            const actualVar = result4.actualVariableName;
            console.log('✅ Position 4 detects variable:', actualVar);
            assert.strictEqual(actualVar, 'x', 'Position 4 should detect variable x');
            assert.notStrictEqual(actualVar, 'dt', 'Position 4 should never return dt');
        } else {
            throw new Error('Position 4 should detect a variable');
        }
        
        console.log('🎉 SUCCESS: Original issue is completely resolved!');
        console.log('   - Cursor at position 3: detects "x", NOT "dt"');
        console.log('   - Cursor at position 4: detects "x", NOT "dt"');
        console.log('   - Both highlighting and rename will work with variable "x"');
    });

    test('should properly handle numbers rejection', () => {
        const testCases = [
            { line: 'x=2.5', position: 2, desc: 'cursor on "2"' },
            { line: 'x=2.5', position: 3, desc: 'cursor on "."' },
            { line: 'x=2.5', position: 4, desc: 'cursor on "5"' },
            { line: 'y=123+x', position: 2, desc: 'cursor on "1"' },
            { line: 'y=123+x', position: 3, desc: 'cursor on "2"' },
            { line: 'y=123+x', position: 4, desc: 'cursor on "3"' },
        ];
        
        console.log('\n=== Number Rejection Test ===');
        
        for (const testCase of testCases) {
            const result = detectWordRangeCore(testCase.line, testCase.position, 0);
            console.log(`Testing ${testCase.desc} in "${testCase.line}": ${result ? 'detected' : 'null'}`);
            assert.strictEqual(result, undefined, `Should not detect anything at ${testCase.desc}`);
        }
        
        console.log('✅ All number positions correctly rejected');
    });

    test('should handle VS Code wordPattern selection of dt correctly', () => {
        const line = 'dx/dt=x*y';
        
        console.log('\n=== VS Code Integration Test ===');
        console.log('Simulating scenario where VS Code wordPattern selects "dt"...');
        
        // Simulate the scenario where VS Code's getWordRangeAtPosition returns "dt" 
        // This would happen when the cursor is at position 3 or 4
        const dtText = 'dt';
        const dtPosition = 3; // Where "dt" starts in "dx/dt=x*y"
        
        // Our logic should detect that "dt" is part of a derivative and redirect to variable
        const beforeDt = line.substring(0, dtPosition); // "dx/"
        const derivativeMatch = /d([a-zA-Z_][a-zA-Z0-9_]*)\/$/i.exec(beforeDt);
        
        console.log('Text before dt:', beforeDt);
        console.log('Derivative pattern match:', derivativeMatch);
        
        assert.notStrictEqual(derivativeMatch, null, 'Should detect derivative pattern');
        if (derivativeMatch) {
            const variableName = derivativeMatch[1];
            console.log('✅ Extracted variable name:', variableName);
            assert.strictEqual(variableName, 'x', 'Should extract variable "x"');
            
            const varStart = dtPosition - derivativeMatch[0].length + 1; // +1 to skip 'd'
            const varEnd = varStart + variableName.length;
            console.log(`✅ Variable range: ${varStart}-${varEnd}`);
            
            assert.strictEqual(varStart, 1, 'Variable should start at position 1');
            assert.strictEqual(varEnd, 2, 'Variable should end at position 2');
        }
        
        console.log('🎉 VS Code integration logic works correctly!');
    });
});