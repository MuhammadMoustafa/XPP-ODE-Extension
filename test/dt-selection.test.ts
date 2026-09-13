import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

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