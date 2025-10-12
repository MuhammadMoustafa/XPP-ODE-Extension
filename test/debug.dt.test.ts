import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

/**
 * Debug test to see what detectWordRangeCore returns when cursor is on dt part
 */

suite('Debug dt Detection', () => {
    
    test('debug what happens at each position in dx/dt', () => {
        const line = 'dx/dt=x+y';
        
        console.log('\n=== Debugging dt detection ===');
        console.log(`Line: "${line}"`);
        console.log('Positions: d(0) x(1) /(2) d(3) t(4) =(5) x(6) +(7) y(8)');
        
        for (let pos = 0; pos <= 8; pos++) {
            const result = detectWordRangeCore(line, pos, 0);
            const char = line[pos];
            
            if (result) {
                const highlightedText = line.substring(result.range.start.character, result.range.end.character);
                console.log(`Position ${pos} ('${char}'): detects '${result.actualVariableName}', highlights '${highlightedText}' (range ${result.range.start.character}-${result.range.end.character})`);
                
                // Check for the problem cases
                if (pos === 3 || pos === 4) { // positions on dt part
                    if (result.actualVariableName === 'dt' || highlightedText === 'dt') {
                        console.log(`  ❌ PROBLEM: Position ${pos} detects/highlights 'dt' instead of variable!`);
                    } else if (result.actualVariableName === 'x') {
                        console.log(`  ✅ Good: Position ${pos} correctly detects variable 'x'`);
                    }
                }
                
                if (pos >= 5) { // positions after dt
                    if (result.actualVariableName === 'dt' || highlightedText === 'dt') {
                        console.log(`  ❌ PROBLEM: Position ${pos} incorrectly detects/highlights 'dt'!`);
                    }
                }
            } else {
                console.log(`Position ${pos} ('${char}'): no detection`);
            }
        }
    });
    
    test('test what the fallback word detection returns for dt positions', () => {
        const line = 'dx/dt=x+y';
        
        console.log('\n=== Testing fallback word detection ===');
        
        // This simulates the fallback logic in detectWordRangeCore
        const wordRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        let match;
        const wordMatches = [];
        while ((match = wordRegex.exec(line)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            const word = match[0];
            
            wordMatches.push({ word, start, end });
            console.log(`Word '${word}' at positions ${start}-${end}`);
        }
        
        // Check positions 3 and 4 (dt part)
        for (const pos of [3, 4]) {
            const matchingWord = wordMatches.find(m => pos >= m.start && pos < m.end);
            console.log(`Position ${pos}: falls in word '${matchingWord?.word}'`);
            
            if (matchingWord?.word === 'dt') {
                console.log(`  ❌ Fallback would select 'dt' at position ${pos} - this is the problem!`);
                
                // Check if our dt exclusion logic works
                const beforeDt = line.substring(0, matchingWord.start);
                console.log(`  Text before dt: '${beforeDt}'`);
                
                const isDxDtPattern = /d[a-zA-Z_][a-zA-Z0-9_]*\/$/.test(beforeDt);
                console.log(`  Is dx/dt pattern: ${isDxDtPattern}`);
                
                if (isDxDtPattern) {
                    console.log(`  ✅ Our exclusion logic should skip this dt`);
                } else {
                    console.log(`  ❌ Our exclusion logic failed to detect dx/dt pattern`);
                }
            }
        }
    });
});