import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Test file specifically for the highlighting issue with "dt" 
 * 
 * Issue description:
 * - When cursor moves forward past 't' in dx/dt, "dt" gets highlighted instead of the variable
 * - When cursor moves backward to positions before 'd' or '/', "dt" is highlighted but rename works correctly
 * - The variable should always be highlighted when cursor is anywhere in the dx/dt pattern
 */

suite('Highlighting Issue Tests', () => {
    suite('dt highlighting issue reproduction', () => {
        test('cursor positions in dx/dt should always highlight variable, not dt', () => {
            const line = 'dx/dt=x+y';
            
            // Test all cursor positions in the dx/dt pattern
            // Line layout: d x / d t = x + y
            // Positions:   0 1 2 3 4 5 6 7 8
            
            const testCases = [
                { pos: 0, desc: 'cursor on d (before variable)' },
                { pos: 1, desc: 'cursor on x (variable)' },
                { pos: 2, desc: 'cursor on / (slash)' },
                { pos: 3, desc: 'cursor on d (in dt)' },
                { pos: 4, desc: 'cursor on t (in dt)' },
                { pos: 5, desc: 'cursor after t (just after dt)' }
            ];
            
            for (const testCase of testCases) {
                const result = detectWordRangeCore(line, testCase.pos, 0);
                
                if (testCase.pos <= 4) {
                    // For positions 0-4 (within dx/dt), should detect variable 'x'
                    assert.ok(result, `${testCase.desc}: Should detect variable`);
                    assert.strictEqual(result?.actualVariableName, 'x', 
                        `${testCase.desc}: Should detect variable 'x', not 'dt'`);
                    assert.strictEqual(result?.range.start.character, 1, 
                        `${testCase.desc}: Range should start at variable 'x'`);
                    assert.strictEqual(result?.range.end.character, 2, 
                        `${testCase.desc}: Range should end after variable 'x'`);
                } else if (testCase.pos === 5) {
                    // Position 5 is after the derivative pattern, should not detect dx/dt pattern
                    // This position should either detect nothing or detect '=' as a separate token
                    if (result) {
                        assert.notStrictEqual(result?.actualVariableName, 'dt', 
                            `${testCase.desc}: Should NOT highlight 'dt' when cursor is after the pattern`);
                        // If it detects something, it should be the variable from the pattern, not 'dt'
                        if (result?.actualVariableName) {
                            assert.strictEqual(result?.actualVariableName, 'x', 
                                `${testCase.desc}: If detecting anything, should be 'x', not 'dt'`);
                        }
                    }
                }
            }
        });
        
        test('cursor positions in longer variable dx/dt should always highlight variable', () => {
            const line = 'dmyVar/dt=myVar+1';
            
            // Test all cursor positions in the dmyVar/dt pattern
            // Line layout: d m y V a r / d t = m y V a r + 1
            // Positions:   0 1 2 3 4 5 6 7 8 9 ...
            
            const derivativeEnd = line.indexOf('/dt') + 2; // Position of 't' in dt
            
            for (let pos = 0; pos <= derivativeEnd + 1; pos++) {
                const result = detectWordRangeCore(line, pos, 0);
                
                if (pos <= derivativeEnd) {
                    // Within dmyVar/dt pattern
                    assert.ok(result, `Position ${pos}: Should detect variable`);
                    assert.strictEqual(result?.actualVariableName, 'myVar', 
                        `Position ${pos}: Should detect variable 'myVar', not 'dt'`);
                    assert.strictEqual(result?.range.start.character, 1, 
                        `Position ${pos}: Range should start at variable 'myVar'`);
                    assert.strictEqual(result?.range.end.character, 6, 
                        `Position ${pos}: Range should end after variable 'myVar'`);
                } else {
                    // After the derivative pattern
                    if (result && result.actualVariableName) {
                        assert.notStrictEqual(result?.actualVariableName, 'dt', 
                            `Position ${pos}: Should NOT highlight 'dt' when cursor is after the pattern`);
                    }
                }
            }
        });
        
        test('multiple derivative patterns in same line should highlight correct variable', () => {
            const line1 = 'dx/dt=x+y, dy/dt=2*x-y';
            
            // Test first derivative (dx/dt)
            for (let pos = 0; pos <= 4; pos++) {
                const result = detectWordRangeCore(line1, pos, 0);
                assert.ok(result, `First dx/dt position ${pos}: Should detect variable`);
                assert.strictEqual(result?.actualVariableName, 'x', 
                    `First dx/dt position ${pos}: Should detect 'x'`);
            }
            
            // Test second derivative (dy/dt) - starts at position 11
            const dyStart = line1.indexOf('dy/dt');
            for (let pos = dyStart; pos <= dyStart + 4; pos++) {
                const result = detectWordRangeCore(line1, pos, 0);
                assert.ok(result, `Second dy/dt position ${pos}: Should detect variable`);
                assert.strictEqual(result?.actualVariableName, 'y', 
                    `Second dy/dt position ${pos}: Should detect 'y'`);
            }
        });
        
        test('edge case: cursor exactly at boundary positions', () => {
            const line = 'dx/dt=x';
            
            // Test boundary conditions more precisely
            const testPositions = [
                { pos: 0, expected: 'x', desc: 'at d' },
                { pos: 1, expected: 'x', desc: 'at x' }, 
                { pos: 2, expected: 'x', desc: 'at /' },
                { pos: 3, expected: 'x', desc: 'at d (in dt)' },
                { pos: 4, expected: 'x', desc: 'at t (in dt)' },
                { pos: 5, expected: null, desc: 'at = (after pattern)' }
            ];
            
            for (const test of testPositions) {
                const result = detectWordRangeCore(line, test.pos, 0);
                
                if (test.expected) {
                    assert.ok(result, `Position ${test.pos} ${test.desc}: Should detect something`);
                    assert.strictEqual(result?.actualVariableName, test.expected, 
                        `Position ${test.pos} ${test.desc}: Should detect '${test.expected}'`);
                    // Ensure we're not accidentally highlighting 'dt'
                    assert.notStrictEqual(result?.actualVariableName, 'dt', 
                        `Position ${test.pos} ${test.desc}: Should never highlight 'dt'`);
                }
            }
        });
    });
});