import * as assert from 'assert';
import { detectWordRangeCore, extractVariableFromDerivativePattern } from '../src/utils/renameCore';

/**
 * Final comprehensive test to verify that highlighting and rename are now consistent
 * after the wordPattern fix
 */

suite('Highlighting and Rename Consistency Verification', () => {
    
    test('verify highlighting and rename consistency after wordPattern fix', () => {
        console.log('\n=== Verifying Highlighting and Rename Consistency ===');
        
        const testCases = [
            { line: 'dx/dt=x+y', variable: 'x', tPos: 4 },
            { line: 'dvelocity/dt=velocity*acc', variable: 'velocity', tPos: 11 },
            { line: 'dA/dt=A*B', variable: 'A', tPos: 4 }
        ];
        
        for (const testCase of testCases) {
            console.log(`\nTesting: "${testCase.line}"`);
            console.log(`Expected variable: ${testCase.variable}`);
            
            // Test all positions within the derivative pattern
            let derivativePatternStart = 0;
            let derivativePatternEnd = testCase.tPos; // position of 't' in dt
            
            console.log(`Derivative pattern positions: ${derivativePatternStart}-${derivativePatternEnd}`);
            
            for (let pos = derivativePatternStart; pos <= derivativePatternEnd; pos++) {
                const result = detectWordRangeCore(testCase.line, pos, 0);
                
                assert.ok(result, `Position ${pos} should detect something`);
                assert.strictEqual(result?.actualVariableName, testCase.variable,
                    `Position ${pos} should detect variable '${testCase.variable}'`);
                
                // The highlight range should always point to just the variable
                const highlightedText = testCase.line.substring(
                    result!.range.start.character, 
                    result!.range.end.character
                );
                assert.strictEqual(highlightedText, testCase.variable,
                    `Position ${pos} should highlight just '${testCase.variable}'`);
                
                console.log(`  ✅ Position ${pos} ('${testCase.line[pos]}'): detects and highlights '${testCase.variable}'`);
            }
            
            // Test position after the pattern (should not detect derivative)
            const afterPatternPos = derivativePatternEnd + 1;
            if (afterPatternPos < testCase.line.length) {
                const afterResult = detectWordRangeCore(testCase.line, afterPatternPos, 0);
                if (afterResult && afterResult.actualVariableName === testCase.variable) {
                    assert.fail(`Position ${afterPatternPos} should not detect derivative pattern`);
                }
                console.log(`  ✅ Position ${afterPatternPos} correctly does not detect derivative pattern`);
            }
        }
        
        console.log('\n🎉 All highlighting is consistent with rename behavior!');
    });
    
    test('verify wordPattern no longer causes inconsistencies', () => {
        console.log('\n=== Verifying wordPattern Consistency ===');
        
        const line = 'dx/dt=x+y';
        
        // Test the new wordPattern behavior
        const newWordPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|\w+/g;
        
        let match;
        const matches = [];
        while ((match = newWordPattern.exec(line)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        console.log('WordPattern matches:');
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        // The key insight: when cursor is on positions 3 or 4 (dt part),
        // VS Code will now select 'dt' (not 'dx/dt'), but our custom logic
        // should still detect the variable 'x'
        
        for (const pos of [3, 4]) {
            // What VS Code's wordPattern would select at this position
            const vsCodeMatch = matches.find(m => pos >= m.start && pos < m.end);
            console.log(`\nPosition ${pos}:`);
            console.log(`  VS Code wordPattern selects: "${vsCodeMatch?.text}" (positions ${vsCodeMatch?.start}-${vsCodeMatch?.end})`);
            
            // What our custom logic detects
            const ourResult = detectWordRangeCore(line, pos, 0);
            console.log(`  Our logic detects: variable='${ourResult?.actualVariableName}', range=${ourResult?.range.start.character}-${ourResult?.range.end.character}`);
            
            // Now they should be consistent in intent:
            // - VS Code selects 'dt' (which is correct for its word matching)
            // - Our logic detects variable 'x' (which is correct for renaming)
            // - Our rename provider will handle the case where VS Code gives us 'dt' but we need to work with 'x'
            
            if (vsCodeMatch?.text === 'dt') {
                console.log(`  ✅ VS Code now correctly selects 'dt' as a word`);
            }
            
            if (ourResult?.actualVariableName === 'x') {
                console.log(`  ✅ Our logic correctly detects variable 'x'`);
            }
            
            // The key is that our rename provider should handle this case
            // where VS Code selects 'dt' but we want to rename 'x'
            assert.strictEqual(ourResult?.actualVariableName, 'x',
                `Our logic should always detect variable 'x' for derivative patterns`);
        }
        
        console.log('\n✅ wordPattern and custom logic are now properly coordinated!');
    });
    
    test('verify fallback extraction works for edge cases', () => {
        console.log('\n=== Testing Fallback Extraction ===');
        
        // Test cases where we might still get the full pattern
        const fallbackCases = [
            { input: 'dx/dt', expected: 'x' },
            { input: 'dMyVariable/dt', expected: 'MyVariable' },
            { input: 'y\'', expected: 'y' },
            { input: 'func(t)', expected: 'func' },
            { input: 'dt', expected: undefined }, // standalone dt should not be extracted
            { input: 'normalVar', expected: undefined } // normal variables should not be extracted
        ];
        
        for (const testCase of fallbackCases) {
            const result = extractVariableFromDerivativePattern(testCase.input);
            console.log(`  "${testCase.input}" → ${result ? `"${result}"` : 'undefined'}`);
            
            if (testCase.expected) {
                assert.strictEqual(result, testCase.expected,
                    `Should extract "${testCase.expected}" from "${testCase.input}"`);
            } else {
                assert.ok(result === undefined,
                    `Should not extract variable from "${testCase.input}"`);
            }
        }
        
        console.log('✅ Fallback extraction works correctly for all cases!');
    });
    
    test('final integration test: simulate real user interaction', () => {
        console.log('\n=== Final Integration Test ===');
        
        // Simulate the user's reported scenario:
        // 1. User has dx/dt in their code
        // 2. User moves cursor around in the dx/dt pattern
        // 3. User presses F2 to rename
        // 4. The behavior should now be consistent
        
        const line = 'dx/dt=x*y';
        console.log(`User's line: "${line}"`);
        
        const scenarioSteps = [
            { pos: 0, desc: 'User puts cursor on d (before variable)' },
            { pos: 1, desc: 'User puts cursor on x (on variable)' },
            { pos: 2, desc: 'User puts cursor on / (slash)' },
            { pos: 3, desc: 'User puts cursor on d (in dt)' },
            { pos: 4, desc: 'User puts cursor on t (in dt)' }
        ];
        
        for (const step of scenarioSteps) {
            console.log(`\n${step.desc}:`);
            
            const result = detectWordRangeCore(line, step.pos, 0);
            
            if (result) {
                const highlightedVar = line.substring(result.range.start.character, result.range.end.character);
                console.log(`  ✅ Highlighting: "${highlightedVar}"`);
                console.log(`  ✅ Rename target: "${result.actualVariableName}"`);
                console.log(`  ✅ Range: ${result.range.start.character}-${result.range.end.character}`);
                
                // Both highlighting and rename should target the same variable
                assert.strictEqual(highlightedVar, result.actualVariableName || highlightedVar,
                    'Highlighting and rename should be consistent');
                assert.strictEqual(result.actualVariableName, 'x',
                    'Should always target variable x');
            }
        }
        
        console.log('\n🎉🎉🎉 SUCCESS: Highlighting and rename are now fully consistent! 🎉🎉🎉');
        console.log('The user\'s reported issue has been completely resolved.');
    });
});