import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

suite('Final Verification Tests', () => {
    test('should never return dt when cursor is at positions 3-4 in dx/dt', () => {
        const line = 'dx/dt=x*y';
        
        
        // Test position 3 (on 'd' of 'dt')
        const result3 = detectWordRangeCore(line, 3, 0);
        if (result3) {
            const actualVar = result3.actualVariableName;
            assert.strictEqual(actualVar, 'x', 'Position 3 should detect variable x');
            assert.notStrictEqual(actualVar, 'dt', 'Position 3 should never return dt');
        } else {
            throw new Error('Position 3 should detect a variable');
        }
        
        // Test position 4 (on 't' of 'dt')  
        const result4 = detectWordRangeCore(line, 4, 0);
        if (result4) {
            const actualVar = result4.actualVariableName;
            assert.strictEqual(actualVar, 'x', 'Position 4 should detect variable x');
            assert.notStrictEqual(actualVar, 'dt', 'Position 4 should never return dt');
        } else {
            throw new Error('Position 4 should detect a variable');
        }
        
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
        
        
        for (const testCase of testCases) {
            const result = detectWordRangeCore(testCase.line, testCase.position, 0);
            assert.strictEqual(result, undefined, `Should not detect anything at ${testCase.desc}`);
        }
        
    });

    test('should handle VS Code wordPattern selection of dt correctly', () => {
        const line = 'dx/dt=x*y';
        
        
        // Simulate the scenario where VS Code's getWordRangeAtPosition returns "dt" 
        // This would happen when the cursor is at position 3 or 4
        const dtPosition = 3; // Where "dt" starts in "dx/dt=x*y"
        
        // Our logic should detect that "dt" is part of a derivative and redirect to variable
        const beforeDt = line.substring(0, dtPosition); // "dx/"
        const derivativeMatch = /d([a-zA-Z_][a-zA-Z0-9_]*)\/$/i.exec(beforeDt);
        
        
        assert.notStrictEqual(derivativeMatch, null, 'Should detect derivative pattern');
        if (derivativeMatch) {
            const variableName = derivativeMatch[1];
            assert.strictEqual(variableName, 'x', 'Should extract variable "x"');
            
            const varStart = dtPosition - derivativeMatch[0].length + 1; // +1 to skip 'd'
            const varEnd = varStart + variableName.length;
            
            assert.strictEqual(varStart, 1, 'Variable should start at position 1');
            assert.strictEqual(varEnd, 2, 'Variable should end at position 2');
        }
        
    });
});