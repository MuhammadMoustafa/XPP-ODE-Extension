import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

suite('F2 Rename Dialog Tests', () => {
    
    test('should NOT show rename dialog for comments', () => {
        const line = '# This variable x should not be renameable';
        
        // Test cursor on 'x' in comment (position 15)
        const detection = detectWordRangeCore(line, 15, 0);
        
        assert.strictEqual(detection, undefined, 'Should not detect variables in comments');
    });
    
    test('should NOT show rename dialog for whitespace', () => {
        const line = 'x = y + z';
        
        // Test cursor on space after 'x' (position 1)
        const spaceDetection1 = detectWordRangeCore(line, 1, 0);
        assert.strictEqual(spaceDetection1, undefined, 'Should not detect space after x');
        
        // Test cursor on space before 'y' (position 3)
        const spaceDetection2 = detectWordRangeCore(line, 3, 0); 
        assert.strictEqual(spaceDetection2, undefined, 'Should not detect space before y');
        
        // Test cursor on space after 'y' (position 5)
        const spaceDetection3 = detectWordRangeCore(line, 5, 0);
        assert.strictEqual(spaceDetection3, undefined, 'Should not detect space after y');
        
        // Test cursor on space after '+' (position 7)
        const spaceDetection4 = detectWordRangeCore(line, 7, 0);
        assert.strictEqual(spaceDetection4, undefined, 'Should not detect space after +');
    });
    
    test('should NOT show rename dialog for operators', () => {
        const line = 'dx/dt = x + y * z';
        
        // Test cursor on '=' operator (position 6)
        const equalDetection = detectWordRangeCore(line, 6, 0);
        assert.strictEqual(equalDetection, undefined, 'Should not detect equals operator');
        
        // Test cursor on '+' operator (position 10)  
        const plusDetection = detectWordRangeCore(line, 10, 0);
        assert.strictEqual(plusDetection, undefined, 'Should not detect plus operator');
        
        // Test cursor on '*' operator (position 14)
        const multDetection = detectWordRangeCore(line, 14, 0);
        assert.strictEqual(multDetection, undefined, 'Should not detect multiply operator');
    });
    
    test('should NOT show rename dialog for numbers', () => {
        const line = 'x = 2.5 + 123';
        
        // Test cursor on '2' (position 4)
        const detection2 = detectWordRangeCore(line, 4, 0);
        assert.strictEqual(detection2, undefined, 'Should not detect number 2');
        
        // Test cursor on '.' (position 5)
        const detectionDot = detectWordRangeCore(line, 5, 0);
        assert.strictEqual(detectionDot, undefined, 'Should not detect decimal point');
        
        // Test cursor on '5' (position 6)
        const detection5 = detectWordRangeCore(line, 6, 0);
        assert.strictEqual(detection5, undefined, 'Should not detect number 5');
        
        // Test cursor on '1' in '123' (position 10)
        const detection1 = detectWordRangeCore(line, 10, 0);
        assert.strictEqual(detection1, undefined, 'Should not detect number 1 in 123');
        
        // Test cursor on '2' in '123' (position 11)
        const detection12 = detectWordRangeCore(line, 11, 0);
        assert.strictEqual(detection12, undefined, 'Should not detect number 2 in 123');
        
        // Test cursor on '3' in '123' (position 12)
        const detection3 = detectWordRangeCore(line, 12, 0);
        assert.strictEqual(detection3, undefined, 'Should not detect number 3 in 123');
    });
    
    test('SHOULD show rename dialog for valid variables', () => {
        const line = 'dx/dt = x + y';
        
        // Test cursor on 'x' in derivative (position 1)
        const dxDetection = detectWordRangeCore(line, 1, 0);
        assert.notStrictEqual(dxDetection, undefined, 'Should detect variable x in dx/dt');
        assert.strictEqual(dxDetection?.actualVariableName, 'x', 'Should detect variable x');
        
        // Test cursor on 'x' after equals (position 8)
        const xDetection = detectWordRangeCore(line, 8, 0);
        assert.notStrictEqual(xDetection, undefined, 'Should detect variable x');
        
        // Test cursor on 'y' (position 12)
        const yDetection = detectWordRangeCore(line, 12, 0);
        assert.notStrictEqual(yDetection, undefined, 'Should detect variable y');
    });
    
    test('should handle edge cases correctly', () => {
        // Test end of line 
        const line1 = 'x=5';
        const endDetection = detectWordRangeCore(line1, 3, 0); // Position after '5'
        assert.strictEqual(endDetection, undefined, 'Should not detect beyond end of line');
        
        // Test parentheses
        const line2 = 'func(x)=x*2';
        const parenDetection1 = detectWordRangeCore(line2, 4, 0); // Position on '('
        assert.strictEqual(parenDetection1, undefined, 'Should not detect open parenthesis');
        
        // Position on ')' at end of parameter should detect the parameter - this is valid UX
        const parenDetection2 = detectWordRangeCore(line2, 6, 0); // Position on ')' 
        assert.notStrictEqual(parenDetection2, undefined, 'Should detect parameter at end boundary');
        
        // Test valid variable inside parentheses
        const paramDetection = detectWordRangeCore(line2, 5, 0); // Position on 'x' inside parentheses
        assert.notStrictEqual(paramDetection, undefined, 'Should detect parameter x');
    });
});