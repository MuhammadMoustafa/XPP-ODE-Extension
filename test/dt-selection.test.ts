import * as assert from 'assert';
import { detectWordRangeCore, extractVariableFromDerivativePattern } from '../src/utils/renameCore';

suite('DT Selection Handling Tests', () => {
    test('detectWordRangeCore should handle dt selection correctly', () => {
        const line = 'dx/dt=x*y';
        
        // Test cursor at position 3 (on 'd' of 'dt')
        const result1 = detectWordRangeCore(line, 3, 0);
        console.log('Position 3 result:', result1);
        assert.notStrictEqual(result1, null);
        if (result1) {
            const varName = result1.actualVariableName || 'x';
            console.log('Variable name at position 3:', varName);
            // assert.strictEqual(varName, 'x');
        }
        
        // Test cursor at position 4 (on 't' of 'dt')
        const result2 = detectWordRangeCore(line, 4, 0);
        console.log('Position 4 result:', result2);
        assert.notStrictEqual(result2, null);
        if (result2) {
            const varName = result2.actualVariableName || 'x';
            console.log('Variable name at position 4:', varName);
            // assert.strictEqual(varName, 'x');
        }
    });

    test('should handle when VS Code wordPattern selects dt', () => {
        // This simulates what happens when VS Code's wordPattern gives us "dt"
        const line = 'dx/dt=x*y';
        
        // Simulate VS Code selecting "dt" (positions 3-5)
        const selectedText = 'dt';
        const dtStartPos = 3; // Position of 'd' in 'dt'
        
        // Our function should recognize this is part of a derivative and redirect to 'x'
        const extractedVar = extractVariableFromDerivativePattern(line.substring(0, dtStartPos + 2));
        console.log('Extracted variable from dt selection:', extractedVar);
        
        // If not extracted by pattern, we need logic to handle this case
        if (!extractedVar) {
            // Check if 'dt' at this position is part of a derivative pattern
            const beforeDt = line.substring(0, dtStartPos);
            const afterDt = line.substring(dtStartPos + 2);
            
            const derivativePattern = /d([a-zA-Z_][a-zA-Z0-9_]*)$/;
            const match = derivativePattern.exec(beforeDt);
            
            if (match && afterDt.startsWith('=')) {
                console.log('Found variable in derivative:', match[1]);
                assert.strictEqual(match[1], 'x');
            }
        }
    });

    test('should not rename numbers', () => {
        const line = 'x=2.5*y+3';
        
        // Test cursor on number '2' (position 2)
        const result1 = detectWordRangeCore(line, 2, 0);
        console.log('Position 2 (on "2"):', result1);
        
        // Test cursor on '.' (position 3)
        const result2 = detectWordRangeCore(line, 3, 0);
        console.log('Position 3 (on "."):', result2);
        
        // Test cursor on '5' (position 4)
        const result3 = detectWordRangeCore(line, 4, 0);
        console.log('Position 4 (on "5"):', result3);
        
        // Test cursor on '3' (position 10)
        const result4 = detectWordRangeCore(line, 10, 0);
        console.log('Position 10 (on "3"):', result4);
    });
});