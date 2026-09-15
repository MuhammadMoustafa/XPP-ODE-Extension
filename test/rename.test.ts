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

            // Test cursor on 'd' in dt
            const result4 = detectWordRangeCore(line, 3, 0);
            assert.ok(result4);
            assert.strictEqual(result4?.actualVariableName, 'x');

            // Test cursor on 't' in dt
            const result5 = detectWordRangeCore(line, 4, 0);
            assert.ok(result5);
            assert.strictEqual(result5?.actualVariableName, 'x');
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

        test('should detect variable when cursor is at the beginning of word', () => {
            // Test case from line 18: func1(r)=5*r
            const line = 'func1(r)=5*r';
            
            // Test cursor at beginning of 'r' in parameter (position 6)
            const result1 = detectWordRangeCore(line, 6, 0);
            assert.ok(result1, "Should detect 'r' when cursor is at beginning of parameter");
            assert.strictEqual(result1?.range.start.character, 6);
            assert.strictEqual(result1?.range.end.character, 7);
            
            // Test cursor at beginning of 'r' in function body (position 11)
            const result2 = detectWordRangeCore(line, 11, 0);
            assert.ok(result2, "Should detect 'r' when cursor is at beginning of variable in body");
            assert.strictEqual(result2?.range.start.character, 11);
            assert.strictEqual(result2?.range.end.character, 12);
        });

        test('should detect variable when cursor is at the end of word', () => {
            // Test case from line 18: func1(r)=5*r
            const line = 'func1(r)=5*r';
            
            // Test cursor at end of 'r' in parameter (position 7)
            const result1 = detectWordRangeCore(line, 7, 0);
            assert.ok(result1, "Should detect 'r' when cursor is at end of parameter");
            assert.strictEqual(result1?.range.start.character, 6);
            assert.strictEqual(result1?.range.end.character, 7);
            
            // Test cursor at end of 'r' in function body (position 12)
            const result2 = detectWordRangeCore(line, 12, 0);
            assert.ok(result2, "Should detect 'r' when cursor is at end of variable in body");
            assert.strictEqual(result2?.range.start.character, 11);
            assert.strictEqual(result2?.range.end.character, 12);
        });

        test('should detect variable in function notation when cursor at beginning and end', () => {
            // Test case from line 8: X(t)=2*exp(3*t)+4*exp(5*t)
            const line = 'X(t)=2*exp(3*t)+4*exp(5*t)';
            
            // Test cursor at beginning of 'X' (position 0)
            const result1 = detectWordRangeCore(line, 0, 0);
            assert.ok(result1, "Should detect 'X' when cursor is at beginning");
            assert.strictEqual(result1?.range.start.character, 0);
            assert.strictEqual(result1?.range.end.character, 1);
            
            // Test cursor at end of 'X' (position 1)
            const result2 = detectWordRangeCore(line, 1, 0);
            assert.ok(result2, "Should detect 'X' when cursor is at end");
            assert.strictEqual(result2?.range.start.character, 0);
            assert.strictEqual(result2?.range.end.character, 1);
        });

        test('should detect variable in simple assignment when cursor at beginning and end', () => {
            // Test case from line 19: r=5
            const line = 'r=5';
            
            // Test cursor at beginning of 'r' (position 0)
            const result1 = detectWordRangeCore(line, 0, 0);
            assert.ok(result1, "Should detect 'r' when cursor is at beginning");
            assert.strictEqual(result1?.range.start.character, 0);
            assert.strictEqual(result1?.range.end.character, 1);
            
            // Test cursor at end of 'r' (position 1)
            const result2 = detectWordRangeCore(line, 1, 0);
            assert.ok(result2, "Should detect 'r' when cursor is at end");
            assert.strictEqual(result2?.range.start.character, 0);
            assert.strictEqual(result2?.range.end.character, 1);
        });

        test('should detect variables in complex expressions regardless of cursor position', () => {
            // Test case similar to line 20: de/dt=gamma*(((p2^2)/(k^2+p2^2))-e)*R
            const line = 'de/dt=gamma*(((p2^2)/(k^2+p2^2))-e)*R';
            
            // Test 'R' at the end - cursor at beginning (position 36)
            const result1 = detectWordRangeCore(line, 36, 0);
            assert.ok(result1, "Should detect 'R' when cursor is at beginning");
            assert.strictEqual(result1?.range.start.character, 36);
            assert.strictEqual(result1?.range.end.character, 37);
            
            // Test 'R' at the end - cursor at end (position 37)
            const result2 = detectWordRangeCore(line, 37, 0);
            assert.ok(result2, "Should detect 'R' when cursor is at end");
            assert.strictEqual(result2?.range.start.character, 36);
            assert.strictEqual(result2?.range.end.character, 37);
            
            // Test 'e' variable - cursor at beginning (position 33)
            const result3 = detectWordRangeCore(line, 33, 0);
            assert.ok(result3, "Should detect 'e' when cursor is at beginning");
            assert.strictEqual(result3?.range.start.character, 33);
            assert.strictEqual(result3?.range.end.character, 34);
            
            // Test 'e' variable - cursor at end (position 34)
            const result4 = detectWordRangeCore(line, 34, 0);
            assert.ok(result4, "Should detect 'e' when cursor is at end");
            assert.strictEqual(result4?.range.start.character, 33);
            assert.strictEqual(result4?.range.end.character, 34);
        });

        test('should return correct actualVariableName for dx/dt patterns', () => {
            // Test the specific issue: when cursor is on 'd' in dk/dt, 
            // it should return range for just 'k' and actualVariableName 'k'
            const line = 'dk/dt=sh*e';
            
            // Test cursor on 'd' (position 0)
            const result1 = detectWordRangeCore(line, 0, 0);
            assert.ok(result1, "Should detect variable when cursor is on 'd'");
            assert.strictEqual(result1?.range.start.character, 1, "Range should start at 'k'");
            assert.strictEqual(result1?.range.end.character, 2, "Range should end after 'k'");
            assert.strictEqual(result1?.actualVariableName, 'k', "actualVariableName should be 'k', not 'dk'");
            
            // Test cursor on 'k' (position 1)
            const result2 = detectWordRangeCore(line, 1, 0);
            assert.ok(result2, "Should detect variable when cursor is on 'k'");
            assert.strictEqual(result2?.range.start.character, 1, "Range should start at 'k'");
            assert.strictEqual(result2?.range.end.character, 2, "Range should end after 'k'");
            assert.strictEqual(result2?.actualVariableName, 'k', "actualVariableName should be 'k'");
            
            // Test cursor on '/' (position 2)
            const result3 = detectWordRangeCore(line, 2, 0);
            assert.ok(result3, "Should detect variable when cursor is on '/'");
            assert.strictEqual(result3?.range.start.character, 1, "Range should start at 'k'");
            assert.strictEqual(result3?.range.end.character, 2, "Range should end after 'k'");
            assert.strictEqual(result3?.actualVariableName, 'k', "actualVariableName should be 'k'");
        });

        test('should return correct actualVariableName for multi-character variables in dx/dt', () => {
            // Test with longer variable names like dsh/dt
            const line = 'dsh/dt=sh*e*Y';
            
            // Test cursor on 'd' (position 0)
            const result1 = detectWordRangeCore(line, 0, 0);
            assert.ok(result1, "Should detect variable when cursor is on 'd'");
            assert.strictEqual(result1?.range.start.character, 1, "Range should start at 'sh'");
            assert.strictEqual(result1?.range.end.character, 3, "Range should end after 'sh'");
            assert.strictEqual(result1?.actualVariableName, 'sh', "actualVariableName should be 'sh', not 'dsh'");
            
            // Test cursor on 's' (position 1)
            const result2 = detectWordRangeCore(line, 1, 0);
            assert.ok(result2, "Should detect variable when cursor is on 's'");
            assert.strictEqual(result2?.range.start.character, 1, "Range should start at 'sh'");
            assert.strictEqual(result2?.range.end.character, 3, "Range should end after 'sh'");
            assert.strictEqual(result2?.actualVariableName, 'sh', "actualVariableName should be 'sh'");
        });

        test('should detect variable for entire dVAR/dt pattern including /dt part', () => {
            // Test the specific issue: cursor anywhere in dsh/dt should detect sh
            const line = 'dsh/dt=sh*e*Y';
            
            // Test all positions within "dsh/dt" (positions 0-5)
            const positions = [
                { pos: 0, char: 'd' },
                { pos: 1, char: 's' },
                { pos: 2, char: 'h' },
                { pos: 3, char: '/' },
                { pos: 4, char: 'd' },
                { pos: 5, char: 't' }
            ];
            
            for (const { pos, char } of positions) {
                const result = detectWordRangeCore(line, pos, 0);
                assert.ok(result, `Should detect variable when cursor is on '${char}' at position ${pos}`);
                assert.strictEqual(result?.range.start.character, 1, `Range should start at 'sh' for position ${pos}`);
                assert.strictEqual(result?.range.end.character, 3, `Range should end after 'sh' for position ${pos}`);
                assert.strictEqual(result?.actualVariableName, 'sh', `actualVariableName should be 'sh' for position ${pos}`);
            }
            
            // Test position 6 (on '=') should NOT match the dx/dt pattern anymore (after boundary fix)
            const result6 = detectWordRangeCore(line, 6, 0);
            // Position 6 is outside the derivative pattern, so it should either:
            // 1. Not match anything, OR
            // 2. Match the 'sh' variable on the right side of the equation
            if (result6) {
                // If it matches something, it should be 'sh' from the right side, not from the derivative
                assert.strictEqual(result6!.actualVariableName, 'sh');
            }
            // The important thing is that it should NOT be trying to match the derivative pattern
        });

        test('should detect variable for long variable names in dx/dt pattern', () => {
            // Test longer variable names like dmyVariable/dt
            const line = 'dmyVariable/dt=myVariable+1';
            
            // Test all positions within "dmyVariable/dt" (positions 0-13, position 14 is '=' which is outside)
            const validPositions = [];
            for (let i = 0; i <= 13; i++) { // 0='d', 1-10='myVariable', 11='/', 12='d', 13='t'
                validPositions.push({ pos: i, char: line[i] });
            }
            
            for (const { pos, char } of validPositions) {
                const result = detectWordRangeCore(line, pos, 0);
                assert.ok(result, `Should detect variable when cursor is on '${char}' at position ${pos}`);
                assert.strictEqual(result?.range.start.character, 1, `Range should start at 'myVariable' for position ${pos}`);
                assert.strictEqual(result?.range.end.character, 11, `Range should end after 'myVariable' for position ${pos}`);
                assert.strictEqual(result?.actualVariableName, 'myVariable', `actualVariableName should be 'myVariable' for position ${pos}`);
            }
            
            // Position 14 (on '=') is outside the derivative pattern: whatever it detects, it must not be 'myVariable'
            const result14 = detectWordRangeCore(line, 14, 0);
            assert.notStrictEqual(result14?.actualVariableName, 'myVariable', "Position 14 (on '=') should not match the dx/dt pattern");
        });

        test('should detect variable for single character variables in dx/dt pattern', () => {
            // Test single character variables like dk/dt  
            const line = 'dk/dt=k*2';
            
            // Test all positions within "dk/dt" (positions 0-4)
            const positions = [
                { pos: 0, char: 'd' },
                { pos: 1, char: 'k' },
                { pos: 2, char: '/' },
                { pos: 3, char: 'd' },
                { pos: 4, char: 't' }
            ];
            
            for (const { pos, char } of positions) {
                const result = detectWordRangeCore(line, pos, 0);
                assert.ok(result, `Should detect variable when cursor is on '${char}' at position ${pos}`);
                assert.strictEqual(result?.range.start.character, 1, `Range should start at 'k' for position ${pos}`);
                assert.strictEqual(result?.range.end.character, 2, `Range should end after 'k' for position ${pos}`);
                assert.strictEqual(result?.actualVariableName, 'k', `actualVariableName should be 'k' for position ${pos}`);
            }
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

        test('should correctly handle global variable renaming outside function scope', () => {
            const lines = [
                'func1(r)=5*r',  // r is a function parameter
                'r=5',           // r is a global variable  
                'de/dt=gamma*(((p2^2)/(k^2+p2^2))-e)*R' // R is another global variable (case insensitive)
            ];
            
            // Test renaming 'r' from line 1 (global variable)
            // Should rename: line 1 'r' and line 2 'R' (case insensitive)
            // Should NOT rename: line 0 function parameter 'r' or function body 'r'
            const results = findRenameOccurrences(lines, 'r', 'newVar', 1, 0);
            
            assert.strictEqual(results.length, 2, "Should rename global 'r' and 'R' but not function parameter");
            
            // Should rename global variable r
            const globalR = results.find(r => r.line === 1 && r.start === 0);
            assert.ok(globalR, "Should rename global variable 'r' on line 1");
            
            // Should rename global variable R (case insensitive)
            const globalUpperR = results.find(r => r.line === 2 && r.start === 36);
            assert.ok(globalUpperR, "Should rename global variable 'R' on line 2 (case insensitive)");
            
            // Should NOT rename function parameter or function body
            const funcParam = results.find(r => r.line === 0 && r.start === 6);
            assert.strictEqual(funcParam, undefined, "Should NOT rename function parameter 'r'");
            
            const funcBody = results.find(r => r.line === 0 && r.start === 10);
            assert.strictEqual(funcBody, undefined, "Should NOT rename function body 'r'");
        });

        test('should correctly handle case insensitive variable renaming', () => {
            const lines = [
                'func1(r)=5*r',  // function scope
                'r=5',           // global lowercase r
                'R=10',          // global uppercase R  
                'de/dt=r*R'      // both r and R in expression
            ];
            
            // Test renaming 'R' from line 2 (global uppercase R)
            const results = findRenameOccurrences(lines, 'R', 'newVar', 2, 0);
            
            // Should rename all global r/R variables (case insensitive)
            // Should NOT rename function parameter/body
            const expectedMatches = [
                { line: 1, start: 0 },  // global r
                { line: 2, start: 0 },  // global R
                { line: 3, start: 6 },  // r in expression
                { line: 3, start: 8 }   // R in expression
            ];
            
            assert.strictEqual(results.length, expectedMatches.length, "Should rename all global r/R occurrences");
            
            for (const expected of expectedMatches) {
                const match = results.find(r => r.line === expected.line && r.start === expected.start);
                assert.ok(match, `Should rename variable at line ${expected.line}, position ${expected.start}`);
            }
            
            // Should NOT rename function occurrences
            const funcMatches = results.filter(r => r.line === 0);
            assert.strictEqual(funcMatches.length, 0, "Should NOT rename function parameter or body");
        });

        test('should correctly rename variables in derivative patterns', () => {
            const lines = [
                'dx/dt = x + y',
                'dy/dt = 2*x - y',
                'x = 5',
                'y = 10'
            ];
            
            // Test renaming 'x' - should match all x occurrences
            const results = findRenameOccurrences(lines, 'x', 'newX');
            
            const expectedMatches = [
                { line: 0, start: 1 },  // x in dx/dt
                { line: 0, start: 8 },  // x in expression
                { line: 1, start: 10 }, // x in dy/dt expression
                { line: 2, start: 0 }   // x assignment
            ];
            
            assert.strictEqual(results.length, expectedMatches.length, "Should rename all x occurrences");
            
            for (const expected of expectedMatches) {
                const match = results.find(r => r.line === expected.line && r.start === expected.start);
                assert.ok(match, `Should rename 'x' at line ${expected.line}, position ${expected.start}`);
            }
        });

        test('should NOT rename dt in derivative expressions when renaming standalone dt', () => {
            // Issue: dt = 0.1 should not cause dt in dx/dt to be highlighted/renamed
            const lines = [
                'dt = 0.1',
                'dx/dt = x + y',
                'dz/dt = z * dt'  // dt here is both in derivative and as standalone variable
            ];
            
            // Test renaming dt from line 0 (standalone dt variable)
            const renameResults = findRenameOccurrences(lines, 'dt', 'newDt', 0, 0);
            
            // Should only rename standalone dt variables, not the dt in dx/dt or dz/dt
            const expectedMatches = [
                { line: 0, start: 0 },  // standalone dt on line 0
                { line: 2, start: 12 }  // standalone dt on line 2 (after z *)
            ];
            
            assert.strictEqual(renameResults.length, expectedMatches.length, 
                `Should only find ${expectedMatches.length} occurrences to rename`);
            
            for (const expected of expectedMatches) {
                const match = renameResults.find(r => r.line === expected.line && r.start === expected.start);
                assert.ok(match, `Should rename standalone dt at line ${expected.line}, position ${expected.start}`);
                assert.strictEqual(match.end, expected.start + 2, "Should rename exactly 'dt'");
            }
            
            // Verify it doesn't rename dt in derivative patterns
            const derivativeMatches = renameResults.filter(r => 
                (r.line === 1 && r.start === 3) || // dt in dx/dt
                (r.line === 2 && r.start === 3)    // dt in dz/dt
            );
            assert.strictEqual(derivativeMatches.length, 0, 
                "Should NOT rename dt when it's part of derivative pattern");
        });

        test('should correctly detect variable in dx/dt when cursor is on dt part', () => {
            // Issue: when cursor is on 'd' or 't' in dx/dt, should detect x, not dt
            const lines = ['dx/dt = x + y'];
            
            // Test that positioning cursor anywhere in dx/dt detects 'x'
            for (let pos = 0; pos <= 4; pos++) { // positions: d(0)x(1)/(2)d(3)t(4)
                const result = detectWordRangeCore(lines[0], pos, 0);
                assert.ok(result, `Should detect variable at position ${pos}`);
                assert.strictEqual(result.actualVariableName, 'x', 
                    `At position ${pos} ('${lines[0][pos]}'), should detect 'x', not 'dt'`);
            }
            
            // Test renaming x from dx/dt should work correctly
            const renameResults = findRenameOccurrences(lines, 'x', 'newX', 0, 1);
            const expectedMatches = [
                { line: 0, start: 1 },  // x in dx/dt
                { line: 0, start: 8 }   // x in expression
            ];
            
            assert.strictEqual(renameResults.length, expectedMatches.length, 
                "Should rename both x occurrences when originating from dx/dt");
        });
    });

    suite('Range Detection Tests', () => {
        test('should detect correct range and variable for dx/dt patterns at all positions', () => {
            const line = 'dsh/dt=sh*e*Y';
            // Positions: d(0)s(1)h(2)/(3)d(4)t(5)=(6)s(7)h(8)...
            
            // Test positions within the dx/dt pattern (0-5: 'd', 'sh', '/', 'd', 't')
            for (let pos = 0; pos <= 5; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                assert.ok(result, `Should detect variable at position ${pos} (char: '${line[pos]}')`)
                assert.strictEqual(result?.range.start.character, 1, `Position ${pos}: range should start at 'sh'`);
                assert.strictEqual(result?.range.end.character, 3, `Position ${pos}: range should end after 'sh'`);
                assert.strictEqual(result?.actualVariableName, 'sh', `Position ${pos}: should detect 'sh'`);
            }
            
            // Test position 6 ('=') should not detect the dx/dt pattern
            const result6 = detectWordRangeCore(line, 6, 0);
            if (result6) {
                // If it detects something, it should not be the dx/dt pattern variable 'sh'
                assert.notStrictEqual(result6?.actualVariableName, 'sh', "Position 6 should not match dx/dt pattern");
            }

            // Test position 7-8 ('sh' after '=') should detect the regular variable 'sh'
            const result7 = detectWordRangeCore(line, 7, 0);
            assert.ok(result7, "Should detect regular variable 'sh' at position 7");
            assert.strictEqual(result7?.range.start.character, 7, "Regular 'sh' should start at position 7");
            assert.strictEqual(result7?.range.end.character, 9, "Regular 'sh' should end at position 9");
        });

        test('should detect correct range for function scope vs global scope', () => {
            const lines = [
                'func1(r)=5*r',  // line 0
                'r=5',           // line 1  
                'de/dt=gamma*(((p2^2)/(k^2+p2^2))-e)*R' // line 2
            ];

            // Test function parameter 'r' (line 0, pos 6)
            const funcParam = detectWordRangeCore(lines[0], 6, 0);
            assert.ok(funcParam, "Should detect function parameter 'r'");
            assert.strictEqual(funcParam.range.start.character, 6, "Function param range start");
            assert.strictEqual(funcParam.range.end.character, 7, "Function param range end");

            // Test global 'r' (line 1, pos 0) 
            const globalR = detectWordRangeCore(lines[1], 0, 1);
            assert.ok(globalR, "Should detect global 'r'");
            assert.strictEqual(globalR.range.start.character, 0, "Global r range start");
            assert.strictEqual(globalR.range.end.character, 1, "Global r range end");

            // Test global 'R' (line 2, pos 36)
            const globalUpperR = detectWordRangeCore(lines[2], 36, 2);
            assert.ok(globalUpperR, "Should detect global 'R'");
            assert.strictEqual(globalUpperR.range.start.character, 36, "Global R range start");
            assert.strictEqual(globalUpperR.range.end.character, 37, "Global R range end");
        });

        test('should handle highlighting with correct scoping', () => {
            const lines = [
                'func1(r)=5*r',  // line 0: function parameter and body
                'r=5',           // line 1: global variable
                'de/dt=gamma*(((p2^2)/(k^2+p2^2))-e)*R' // line 2: global variable (case insensitive)
            ];

            // Test highlighting from function parameter (should only highlight within function)
            const funcResults = findRenameOccurrences(lines, 'r', 'newR', 0, 6);
            assert.strictEqual(funcResults.length, 2, "Function scope should highlight 2 occurrences");
            assert.ok(funcResults.every(r => r.line === 0), "Function scope should only highlight on same line");

            // Test highlighting from global variable (should highlight global occurrences, case insensitive)
            const globalResults = findRenameOccurrences(lines, 'r', 'newR', 1, 0);
            assert.strictEqual(globalResults.length, 2, "Global scope should highlight 2 occurrences");
            assert.ok(globalResults.some(r => r.line === 1), "Should highlight global 'r'");
            assert.ok(globalResults.some(r => r.line === 2), "Should highlight global 'R' (case insensitive)");
            assert.ok(!globalResults.some(r => r.line === 0), "Should NOT highlight function parameter");

            // Test highlighting from uppercase global R (should be same as lowercase r)
            const upperResults = findRenameOccurrences(lines, 'R', 'newR', 2, 36);
            assert.strictEqual(upperResults.length, 2, "Uppercase R should highlight same as lowercase r");
            assert.deepStrictEqual(
                upperResults.sort((a, b) => a.line - b.line || a.start - b.start),
                globalResults.sort((a, b) => a.line - b.line || a.start - b.start),
                "Uppercase and lowercase should highlight same positions"
            );
        });

        test('should NOT highlight dt when cursor is after t in dx/dt pattern', () => {
            const line = 'dmyVariable/dt = myVariable + 1';
            // Positions: d(0)m(1)y(2)V(3)a(4)r(5)i(6)a(7)b(8)l(9)e(10)/(11)d(12)t(13) (14)=(15)...
            
            // Test position immediately after 't' (position 14, on space)
            const result14 = detectWordRangeCore(line, 14, 0);
            if (result14) {
                // Should NOT detect "dt" - if anything detected, it should be something else
                assert.notStrictEqual(result14?.actualVariableName, 'dt', "Position 14 should not detect 'dt'");
                assert.notStrictEqual(result14?.range.start.character, 12, "Should not start at 'd' in 'dt'");
            }

            // Test position on 't' (position 13)
            const result13 = detectWordRangeCore(line, 13, 0);
            assert.ok(result13, "Should detect dx/dt pattern at position 13 (on 't')");
            assert.strictEqual(result13?.actualVariableName, 'myVariable', "Position 13 should detect 'myVariable'");
            assert.strictEqual(result13?.range.start.character, 1, "Should start at 'myVariable'");
            assert.strictEqual(result13?.range.end.character, 11, "Should end after 'myVariable'");

            // Test position on 'd' in '/dt' (position 12) 
            const result12 = detectWordRangeCore(line, 12, 0);
            assert.ok(result12, "Should detect dx/dt pattern at position 12 (on 'd' in '/dt')");
            assert.strictEqual(result12?.actualVariableName, 'myVariable', "Position 12 should detect 'myVariable'");
            assert.strictEqual(result12?.range.start.character, 1, "Should start at 'myVariable'");
        });

        test('should detect dx/dt pattern consistently when moving backward from t', () => {
            const line = 'dsh/dt=sh*e*Y';
            // Positions: d(0)s(1)h(2)/(3)d(4)t(5)=(6)...

            // Test moving backward from position after 't'
            // Position 6 ('=') is outside the derivative pattern: whatever it detects, it must not be 'sh'
            const result6 = detectWordRangeCore(line, 6, 0);
            assert.notStrictEqual(result6?.actualVariableName, 'sh', "Position 6 ('=') should not detect the dx/dt pattern");

            // Position 5 ('t') should detect dx/dt pattern
            const result5 = detectWordRangeCore(line, 5, 0);
            assert.ok(result5, "Position 5 should detect dx/dt pattern");
            assert.strictEqual(result5?.actualVariableName, 'sh', "Position 5 should detect 'sh'");

            // Position 4 ('d' in '/dt') should detect dx/dt pattern  
            const result4 = detectWordRangeCore(line, 4, 0);
            assert.ok(result4, "Position 4 should detect dx/dt pattern");
            assert.strictEqual(result4?.actualVariableName, 'sh', "Position 4 should detect 'sh'");

            // Position 3 ('/') should detect dx/dt pattern
            const result3 = detectWordRangeCore(line, 3, 0);
            assert.ok(result3, "Position 3 should detect dx/dt pattern");
            assert.strictEqual(result3?.actualVariableName, 'sh', "Position 3 should detect 'sh'");

            // All positions within dx/dt (0-5) should return same range
            const expectedStart = 1;
            const expectedEnd = 3;
            for (let pos = 0; pos <= 5; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                assert.ok(result, `Position ${pos} should detect dx/dt pattern`);
                assert.strictEqual(result?.range.start.character, expectedStart, `Position ${pos} should have consistent start`);
                assert.strictEqual(result?.range.end.character, expectedEnd, `Position ${pos} should have consistent end`);
            }
        });

        test('should handle legitimate dt variable vs dx/dt pattern dt', () => {
            // Test that legitimate 'dt' variable (not part of dx/dt) still works
            const line1 = 'dt = 0.1';  // legitimate dt variable
            const result1 = detectWordRangeCore(line1, 0, 0);
            assert.ok(result1, "Should detect legitimate 'dt' variable");
            assert.strictEqual(result1?.range.start.character, 0, "Should start at 'dt'");
            assert.strictEqual(result1?.range.end.character, 2, "Should end after 'dt'");

            // Test that 'dt' in dx/dt pattern is NOT detected by fallback
            const line2 = 'dx/dt = x + y';
            const result2 = detectWordRangeCore(line2, 3, 0); // Position after 't'
            if (result2) {
                assert.notStrictEqual(result2.range.start.character, 2, "Should NOT detect 'dt' from dx/dt pattern");
            }
            
            // But legitimate dt variable after dx/dt should work
            const line3 = 'dx/dt = x + dt';  // 'dt' at end is a separate variable
            const result3 = detectWordRangeCore(line3, 12, 0); // Position on the separate 'dt'
            assert.ok(result3, "Should detect legitimate 'dt' variable even when dx/dt exists");
            assert.strictEqual(result3?.range.start.character, 12, "Should detect separate 'dt' variable");
        });

        test('should handle cursor positioning in derivative expressions correctly', () => {
            // Issue: dmyVariable/dt - cursor after 't' should highlight myVariable, not dt
            const line1 = 'dmyVariable/dt';
            
            // Cursor at position 13 (after 't')
            const result1 = detectWordRangeCore(line1, 13, 0);
            assert.ok(result1, "Should detect variable when cursor is after 't'");
            assert.strictEqual(result1?.actualVariableName, 'myVariable', "Should detect myVariable, not dt");
            assert.strictEqual(result1?.range.start.character, 1, "Should start at 'm' in myVariable");
            assert.strictEqual(result1?.range.end.character, 11, "Should end after 'myVariable'");

            // Cursor at position 12 (on 't')
            const result2 = detectWordRangeCore(line1, 12, 0);
            assert.ok(result2, "Should detect variable when cursor is on 't'");
            assert.strictEqual(result2?.actualVariableName, 'myVariable', "Should detect myVariable, not dt");

            // Cursor at position 11 (on 'd' in 'dt')
            const result3 = detectWordRangeCore(line1, 11, 0);
            assert.ok(result3, "Should detect variable when cursor is on 'd' in dt");
            assert.strictEqual(result3?.actualVariableName, 'myVariable', "Should detect myVariable, not dt");

            // Cursor at position 10 (on '/')
            const result4 = detectWordRangeCore(line1, 10, 0);
            assert.ok(result4, "Should detect variable when cursor is on '/'");
            assert.strictEqual(result4?.actualVariableName, 'myVariable', "Should detect myVariable, not dt");
        });

        test('should handle cursor movement in derivative expressions', () => {
            // Test moving cursor forward and backward in dx/dt expression
            const line = 'dx/dt = x + y';
            
            // Moving forward: cursor positions 0, 1, 2, 3, 4
            for (let pos = 0; pos <= 4; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                if (result) {
                    // Should always detect 'x' when cursor is within dx/dt pattern
                    assert.strictEqual(result.actualVariableName, 'x', 
                        `At position ${pos}, should detect 'x', not 'dt'`);
                }
            }

            // Test specific positions that were problematic
            // Position 3 (on 'd' in 'dt')
            const result3 = detectWordRangeCore(line, 3, 0);
            assert.ok(result3, "Should detect variable at position 3");
            assert.strictEqual(result3.actualVariableName, 'x', "Should detect 'x' at position 3, not 'dt'");

            // Position 4 (on 't' in 'dt')  
            const result4 = detectWordRangeCore(line, 4, 0);
            assert.ok(result4, "Should detect variable at position 4");
            assert.strictEqual(result4.actualVariableName, 'x', "Should detect 'x' at position 4, not 'dt'");
        });

        test('should handle backward cursor movement after dt correctly', () => {
            // Issue: When moving cursor backward from after 't', dt gets highlighted
            const line = 'dmyVariable/dt = something';
            // Positions: d(0)m(1)y(2)V(3)a(4)r(5)i(6)a(7)b(8)l(9)e(10)/(11)d(12)t(13) (14)=(15)...
            
            // Test moving backward from position 15 (after =) to position 0
            for (let pos = 13; pos >= 0; pos--) {  // From 't' backward to 'd'
                const result = detectWordRangeCore(line, pos, 0);
                if (result) {
                    assert.strictEqual(result.actualVariableName, 'myVariable', 
                        `Moving backward: at position ${pos} ('${line[pos]}'), should detect 'myVariable', not 'dt'`);
                    assert.strictEqual(result.range.start.character, 1, 
                        `Moving backward: at position ${pos}, range should start at 'm' in myVariable`);
                    assert.strictEqual(result.range.end.character, 11, 
                        `Moving backward: at position ${pos}, range should end after 'myVariable'`);
                }
            }
        });

        test('should never highlight dt when cursor is in derivative pattern', () => {
            const testCases = [
                { line: 'dx/dt', desc: 'simple dx/dt' },
                { line: 'dmyVar/dt', desc: 'multi-char variable' },
                { line: 'dA/dt = A', desc: 'with assignment' },
                { line: 'dvelocity/dt = acceleration', desc: 'long variable name' }
            ];

            for (const testCase of testCases) {
                const line = testCase.line;
                const dtStart = line.indexOf('/dt') + 1; // Position of 'd' in 'dt'
                const dtEnd = dtStart + 1; // Position of 't' in 'dt'

                // Test positions on 'd' and 't' in 'dt' part
                for (let pos = dtStart; pos <= dtEnd; pos++) {
                    const result = detectWordRangeCore(line, pos, 0);
                    if (result) {
                        // Should NEVER return a range that starts at the 'dt' part
                        assert.notStrictEqual(result.range.start.character, dtStart, 
                            `${testCase.desc}: at position ${pos}, should NOT detect 'dt' range`);
                        
                        // Should detect the variable, not 'dt'
                        assert.notStrictEqual(result.actualVariableName, 'dt',
                            `${testCase.desc}: at position ${pos} ('${line[pos]}'), should NOT detect 'dt'`);
                    }
                }
            }
        });

        test('should handle cursor at exact boundary positions', () => {
            const line = 'dtest/dt';
            // Positions: d(0)t(1)e(2)s(3)t(4)/(5)d(6)t(7)
            
            const boundaryTests = [
                { pos: 5, desc: 'at slash /' },
                { pos: 6, desc: 'at d in dt' },
                { pos: 7, desc: 'at t in dt' }
            ];

            for (const test of boundaryTests) {
                const result = detectWordRangeCore(line, test.pos, 0);
                assert.ok(result, `Should detect variable ${test.desc}`);
                assert.strictEqual(result.actualVariableName, 'test', 
                    `${test.desc}: should detect 'test', not 'dt'`);
                assert.strictEqual(result.range.start.character, 1, 
                    `${test.desc}: should start at 't' in 'test'`);
                assert.strictEqual(result.range.end.character, 5, 
                    `${test.desc}: should end after 'test'`);
            }
        });

        test('should not fall back to word detection when in derivative pattern', () => {
            // Test that the derivative pattern is matched and fallback is not triggered
            const line = 'dmyVariable/dt';
            // Test all positions to ensure no fallback to dt detection
            
            for (let pos = 0; pos < line.length; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                if (result) {
                    // If we get a result, it should be from the derivative pattern, not fallback
                    assert.strictEqual(result.actualVariableName, 'myVariable', 
                        `At position ${pos} ('${line[pos]}'): should use derivative pattern, not fallback to 'dt'`);
                    
                    // The range should be for the variable, not for 'dt'
                    assert.notStrictEqual(result.range.start.character, pos >= 11 ? 11 : -1,
                        `At position ${pos}: should not detect 'dt' range starting at position 11`);
                }
            }
        });

        test('fallback should properly skip dt in derivative expressions', () => {
            // Test the fallback logic directly by using a line that won't match derivative patterns
            const line = 'x = y + dx/dt + z';
            // This should use fallback for x, y, z but NOT for dt in dx/dt
            
            // Position on dt in dx/dt (positions 10,11 for 'dt')
            const dtStartPos = line.indexOf('/dt') + 1; // Position of 'd' in 'dt'
            const dtEndPos = dtStartPos + 1; // Position of 't' in 'dt'
            
            for (let pos = dtStartPos; pos <= dtEndPos; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                if (result) {
                    // Should not detect 'dt' when it's part of dx/dt
                    assert.notStrictEqual(result.actualVariableName, 'dt',
                        `At position ${pos} in "${line}": should not detect 'dt' from dx/dt pattern`);
                }
            }
            
            // But should detect other variables
            const xPos = line.indexOf('x');
            const resultX = detectWordRangeCore(line, xPos, 0);
            assert.ok(resultX, "Should detect 'x'");
            
            const yPos = line.indexOf('y');
            const resultY = detectWordRangeCore(line, yPos, 0);
            assert.ok(resultY, "Should detect 'y'");
        });

        test('simulate exact cursor movement scenario from user report', () => {
            // User reported: moving cursor backward from after 't', dt gets highlighted
            const line = 'dmyVariable/dt = something';
            
            // Test positions beyond the dt pattern
            const testPositions = [
                { pos: 16, desc: 'after space' },
                { pos: 15, desc: 'on equals' },
                { pos: 14, desc: 'after t' },
                { pos: 13, desc: 'on t' },
                { pos: 12, desc: 'on d in dt' },
                { pos: 11, desc: 'on slash' },
                { pos: 10, desc: 'end of variable' }
            ];
            
            for (const test of testPositions) {
                const result = detectWordRangeCore(line, test.pos, 0);
                
                if (test.pos <= 14 && result) { // Within or at the derivative pattern
                    assert.strictEqual(result.actualVariableName, 'myVariable', 
                        `${test.desc}: should detect myVariable, not dt`);
                }
            }
        });

        test('test positions that might trigger fallback incorrectly', () => {
            const line = 'dmyVariable/dt';
            // Test each position and verify what gets detected
            
            // Position 15 (beyond the string) - should return nothing
            let result = detectWordRangeCore(line, 15, 0);
            assert.strictEqual(result, undefined, "Position beyond string should return undefined");
            
            // Position 13 (on 't') - should detect myVariable
            result = detectWordRangeCore(line, 13, 0);
            assert.ok(result, "Position 13 should detect something");
            assert.strictEqual(result!.actualVariableName, 'myVariable', "Position 13 should detect myVariable");
            
            // Position 12 (on 'd' in dt) - should detect myVariable
            result = detectWordRangeCore(line, 12, 0);
            assert.ok(result, "Position 12 should detect something");  
            assert.strictEqual(result!.actualVariableName, 'myVariable', "Position 12 should detect myVariable");
        });

        test('should handle derivative patterns in mixed expressions', () => {
            // Test derivative patterns that don't start at line beginning
            const testCases = [
                { line: 'x = dmyVariable/dt + y', varName: 'myVariable', dtStartPos: 16 },
                { line: 'result = dmyVariable/dt', varName: 'myVariable', dtStartPos: 21 },
                { line: 'if dmyVariable/dt > 0:', varName: 'myVariable', dtStartPos: 15 },
                { line: 'y = dx/dt * 2', varName: 'x', dtStartPos: 7 }
            ];

            for (const testCase of testCases) {
                // Test positions on the dt part should detect the variable, not dt
                for (let offset = 0; offset < 2; offset++) { // Test 'd' and 't' in 'dt'
                    const pos = testCase.dtStartPos + offset;
                    const result = detectWordRangeCore(testCase.line, pos, 0);
                    
                    assert.ok(result, `${testCase.line}: position ${pos} should detect variable`);
                    assert.strictEqual(result!.actualVariableName, testCase.varName,
                        `${testCase.line}: position ${pos} should detect '${testCase.varName}', not 'dt'`);
                }
            }
        });
    });
});