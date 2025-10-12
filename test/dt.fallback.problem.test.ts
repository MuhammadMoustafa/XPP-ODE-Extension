import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Test to reproduce the new issue: dt fallback problem after wordPattern fix
 */

suite('dt Fallback Problem Tests', () => {
    
    test('reproduce issue: cursor after t in dx/dt incorrectly highlights dt', () => {
        const line = 'dx/dt=x+y';
        
        console.log('\n=== Reproducing dt fallback issue ===');
        console.log(`Line: "${line}"`);
        
        // Test position 5 (after 't', on '=')
        // This position should NOT detect anything related to the derivative pattern
        const pos5 = detectWordRangeCore(line, 5, 0);
        
        console.log(`Position 5 (on '='): ${pos5 ? `detects '${pos5.actualVariableName}' range ${pos5.range.start.character}-${pos5.range.end.character}` : 'no detection'}`);
        
        // Position 5 should not detect the derivative pattern
        if (pos5 && pos5.actualVariableName === 'x') {
            console.log('❌ ISSUE: Position 5 still detects derivative pattern - this was the original bug we fixed');
        }
        
        // But if it detects 'dt', that's the new problem!
        if (pos5) {
            const detectedText = line.substring(pos5.range.start.character, pos5.range.end.character);
            if (detectedText === 'dt') {
                console.log('❌ NEW ISSUE: Position 5 detects "dt" - this is the fallback problem!');
            }
        }
    });
    
    test('test the wordPattern behavior that causes the dt fallback', () => {
        const line = 'dx/dt=x+y';
        
        console.log('\n=== Testing current wordPattern behavior ===');
        
        // Current wordPattern after our fix
        const currentWordPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|\w+/g;
        
        let match;
        const matches = [];
        while ((match = currentWordPattern.exec(line)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        console.log('Current wordPattern matches:');
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        // The problem: position 5 (on '=') might fall back to selecting 'dt' (positions 3-5)
        // when the user moves cursor around
        
        // Check what happens at position 4 (on 't')
        const pos4Match = matches.find(m => 4 >= m.start && 4 < m.end);
        console.log(`Position 4 ('t') would select: "${pos4Match?.text}"`);
        
        if (pos4Match?.text === 'dt') {
            console.log('❌ PROBLEM: Position 4 selects "dt" - this causes the fallback issue');
        }
    });
    
    test('identify the solution: exclude dt when it\'s part of dx/dt', () => {
        console.log('\n=== Identifying solution ===');
        
        const line = 'dx/dt=x+y';
        
        // We need a wordPattern that:
        // 1. Does NOT match dx/dt as a whole (✓ we fixed this)
        // 2. Does NOT match dt when it's part of dx/dt (❌ current problem)
        // 3. DOES match standalone dt variables (✓ should work)
        
        console.log('Requirements for wordPattern:');
        console.log('1. ✅ Should not match "dx/dt" as whole word');
        console.log('2. ❌ Should not match "dt" when part of "dx/dt"');
        console.log('3. ✅ Should match standalone "dt" variables');
        
        // Test case: standalone dt should be matchable
        const standaloneLine = 'dt = 0.01';
        console.log(`\nStandalone case: "${standaloneLine}"`);
        console.log('In this case, "dt" should be selectable and renameable');
        
        // Test case: dt in dx/dt should not be matchable
        console.log(`\nDerivative case: "${line}"`);
        console.log('In this case, "dt" should NOT be selectable, only "x" should be');
    });
    
    test('test improved wordPattern approach', () => {
        console.log('\n=== Testing improved wordPattern ===');
        
        const line = 'dx/dt=x+y';
        
        // Improved wordPattern that uses negative lookbehind to exclude dt when preceded by d.../
        // This pattern should not match 'dt' when it comes after 'd[variable]/'
        const improvedPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|(?<!d[a-zA-Z_][a-zA-Z0-9_]*\/)[a-zA-Z_][a-zA-Z0-9_]*|(?<![a-zA-Z_])\d+(?![a-zA-Z_])/g;
        
        console.log('Improved pattern (with negative lookbehind for dt):');
        
        let match;
        const matches = [];
        while ((match = improvedPattern.exec(line)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        // Check if 'dt' is matched
        const dtMatch = matches.find(m => m.text === 'dt');
        if (!dtMatch) {
            console.log('✅ Improved pattern does not match "dt" in derivative expression');
        } else {
            console.log('❌ Improved pattern still matches "dt"');
        }
        
        // Test with standalone dt
        console.log('\nTesting standalone dt:');
        const standaloneLine = 'dt = 0.01';
        improvedPattern.lastIndex = 0; // Reset regex
        
        const standaloneMatches = [];
        while ((match = improvedPattern.exec(standaloneLine)) !== null) {
            standaloneMatches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        standaloneMatches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        const standaloneDtMatch = standaloneMatches.find(m => m.text === 'dt');
        if (standaloneDtMatch) {
            console.log('✅ Improved pattern correctly matches standalone "dt"');
        }
    });
});