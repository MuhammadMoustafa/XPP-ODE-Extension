import * as assert from 'assert';
import { findRenameOccurrences, detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Test file for rename functionality in XPP-ODE Extension
 * 
 * Test cases:
 * - detectWordRangeCore
 *   - should detect variable in standard form dx/dt
 *   - should detect variable in prime notation
 *   - should detect variable in function notation X(t)
 *   - should detect variable in parameter definition (par x=7)
 * - findRenameOccurrences
 *   - should find all occurrences of a variable across different notations
 *   - should not rename variables in comments
 *   - should rename global variables and function body for default renaming
 *   - should rename only regular variables when cursor is on standard variable
 *   - should rename both parameter and body when renaming from inside a function
 *   - should rename parameter defined with 'par' keyword
 */

suite('Rename Tests', () => {
    suite('detectWordRangeCore', () => {
        test('should detect variable in standard form dx/dt', () => {
            const line = 'dx/dt=2*X+3*y';
            // Test cursor on 'd'
            const result1 = detectWordRangeCore(line, 0, 0);
            assert.ok(result1);
            assert.strictEqual(result1?.actualVariableName, 'x');
            
            // Test cursor on 'x'
            const result2 = detectWordRangeCore(line, 1, 0);
            assert.ok(result2);
            assert.strictEqual(result2?.actualVariableName, 'x');
            
            // Test cursor on '/'
            const result3 = detectWordRangeCore(line, 2, 0);
            assert.ok(result3);
            assert.strictEqual(result3?.actualVariableName, 'x');
        });
        
        test('should detect variable in prime notation', () => {
            const line = "y'=6";
            // Test cursor on 'y'
            const result = detectWordRangeCore(line, 0, 0);
            assert.ok(result);
            assert.strictEqual(result?.range.start.character, 0);
            assert.strictEqual(result?.range.end.character, 1);
            
            // Test cursor on prime
            const resultPrime = detectWordRangeCore(line, 1, 0);
            assert.ok(resultPrime);
            assert.strictEqual(resultPrime?.range.start.character, 0);
            assert.strictEqual(resultPrime?.range.end.character, 1);
        });
        
        test('should detect variable in function notation X(t)', () => {
            const line = 'X(t)=2*exp(3*t)+4*exp(5*t)';
            // Test cursor on 'X'
            const result = detectWordRangeCore(line, 0, 0);
            assert.ok(result);
            assert.strictEqual(result?.range.start.character, 0);
            assert.strictEqual(result?.range.end.character, 1);
        });

        test('should detect variable in parameter definition', () => {
            const line = 'par x=7';
            // Test cursor on 'x'
            const result = detectWordRangeCore(line, 4, 0);
            assert.ok(result);
            assert.strictEqual(result?.range.start.character, 4);
            assert.strictEqual(result?.range.end.character, 5);
        });
    });
    
    suite('findRenameOccurrences', () => {
        test('should find all occurrences of a variable across different notations', () => {
            const lines = [
                '#include "asdf"',
                '',
                'dx/dt=2*X+3*y', // lowercase x in derivative, uppercase X as variable
                'dy/dt=4*x+5*y', // lowercase x as variable
                '',
                "y'=6",
                '',
                'X(t)=2*exp(3*t)+4*exp(5*t)', // uppercase X in function notation
                '',
                'par x=7' // lowercase x as parameter
            ];
            
            // Rename 'x' to 'z' - should find dx/dt, X in expression, x in expression, X(t), AND x in parameter
            const results = findRenameOccurrences(lines, 'x', 'z');
            
            // Check number of occurrences (should be 5 now, including the parameter)
            assert.strictEqual(results.length, 5);
            
            // Check specific positions
            // dx/dt -> should convert 'x' in 'dx/dt'
            const dxdtResult = results.find(r => r.line === 2 && r.start === 1);
            assert.ok(dxdtResult);
            
            // X in expression -> should convert 'X' in '2*X+3*y'
            const xInExpressionResult = results.find(r => r.line === 2 && r.start === 8);
            assert.ok(xInExpressionResult);
            
            // x in '4*x+5*y' -> should convert lowercase 'x'
            const xInSecondExpressionResult = results.find(r => r.line === 3 && r.start === 8);
            assert.ok(xInSecondExpressionResult);
            
            // X(t) -> should convert 'X' in function notation
            const xInFunctionNotation = results.find(r => r.line === 7 && r.start === 0);
            assert.ok(xInFunctionNotation);
            
            // Should also match x in parameter
            const parameterMatch = results.find(r => r.line === 9 && r.start === 4);
            assert.ok(parameterMatch);
        });
        
        test('should not rename variables in comments', () => {
            const lines = [
                'dx/dt = x + y',
                '# This is a comment with x in it'
            ];
            
            const results = findRenameOccurrences(lines, 'x', 'z');
            
            // Should only match the two occurrences in the first line
            assert.strictEqual(results.length, 2);
            assert.ok(results.every(r => r.line === 0));
        });
        
        test('should rename only variable in the function scope', () => {
            const lines = [
                'func1(x) = x*2', // x is a parameter here
                'x = 5'           // x is a variable here
            ];
            
            const results = findRenameOccurrences(lines, 'x', 'z', 0, 6);
            
            // Should match the occurrence in the second line and inside the function body
            assert.strictEqual(results.length, 2);
            
            // Check that function body is renamed but parameter is not
            const bodyMatch = results.find(r => r.line === 0 && r.start > 6);
            assert.ok(bodyMatch, "Should rename x in function body");
            
            const globalVarMatch = results.find(r => r.line === 1 && r.start === 0);
            assert.ok(globalVarMatch, "Should rename global variable x");
            
            // Check that function parameter is NOT renamed
            const paramMatch = results.find(r => r.line === 0 && r.start === 6);
            assert.strictEqual(paramMatch, undefined, "Should not rename function parameter");
        });

        test('should rename only regular variables when cursor is on standard variable', () => {
            const lines = [
                'func1(x) = x*2', // x is a parameter here
                'x = 5'           // x is a variable here
            ];
            
            // Rename starting from the second line, position 0 (the variable x = 5)
            const results = findRenameOccurrences(lines, 'x', 'z', 1, 0);
            
            // Should only match the occurrence in the second line
            assert.strictEqual(results.length, 1, "Should only rename the variable where cursor is positioned");
            assert.strictEqual(results[0].line, 1, "Should rename on correct line");
            assert.strictEqual(results[0].start, 0, "Should rename at correct position");
            
            // Check that function parameter and body are NOT renamed
            const functionMatches = results.filter(r => r.line === 0);
            assert.strictEqual(functionMatches.length, 0, "Should not rename anything in function definition");
        });
        
        test('should rename both parameter and body when renaming from inside a function', () => {
            const lines = [
                'func1(x) = x*2', // x is a parameter here
                'x = 5'           // x is a variable here
            ];
            
            // Rename starting from the first line, position 6 (the parameter position)
            const paramResults = findRenameOccurrences(lines, 'x', 'z', 0, 6);
            
            // Should match both parameter and its usage in function body
            assert.strictEqual(paramResults.length, 2, "Should rename both parameter and its usage");
            
            // Check parameter replacement
            const paramMatch = paramResults.find(r => r.line === 0 && r.start === 6);
            assert.ok(paramMatch, "Should rename the parameter");
            
            // Check function body replacement
            const bodyMatch = paramResults.find(r => r.line === 0 && r.start > 10);
            assert.ok(bodyMatch, "Should rename usage in function body");
            
            // Make sure global variable isn't renamed
            const globalVarMatch = paramResults.find(r => r.line === 1);
            assert.strictEqual(globalVarMatch, undefined, "Should not rename global variable");
            
            // Now test from function body position
            const bodyResults = findRenameOccurrences(lines, 'x', 'z', 0, 11);
            
            // Should also match both parameter and its usage
            assert.strictEqual(bodyResults.length, 2, "Should rename both parameter and body when cursor is in body");
            assert.ok(bodyResults.some(r => r.line === 0 && r.start === 6), "Should rename parameter");
            assert.ok(bodyResults.some(r => r.line === 0 && r.start === 11), "Should rename in function body");
        });

        test('should rename parameter defined with par keyword', () => {
            const lines = [
                'par x=7',        // parameter definition with "par"
                'param y=10, x=2' // parameter definition with "param" and comma
            ];
            
            const results = findRenameOccurrences(lines, 'x', 'z');
            
            // Should match both parameter occurrences
            assert.strictEqual(results.length, 2);
            
            // Check specific matches
            assert.ok(results.some(r => r.line === 0 && r.start === 4));
            assert.ok(results.some(r => r.line === 1 && r.start === 12));
        });
    });
});