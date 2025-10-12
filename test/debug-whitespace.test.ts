import * as assert from 'assert';
import { detectWordRangeCore } from '../src/utils/renameCore';

suite('Debug Whitespace Issue', () => {
    test('debug whitespace detection in x = y + z', () => {
        const line = 'x = y + z';
        console.log(`\nDebugging line: "${line}"`);
        console.log('Positions: x(0) (1)=(2) (3)y(4) (5)+(6) (7)z(8)');
        
        // Test each position
        for (let pos = 0; pos <= 8; pos++) {
            const char = line[pos];
            const result = detectWordRangeCore(line, pos, 0);
            
            console.log(`Position ${pos} ('${char}'): ${result ? 
                `detects range ${result.range.start.character}-${result.range.end.character}` : 
                'no detection'}`);
                
            if (pos === 4) {
                console.log(`  Problem position: ${pos} should not detect anything (space before +)`);
                if (result) {
                    console.log(`  But it detects: range ${result.range.start.character}-${result.range.end.character}`);
                    console.log(`  Text in range: "${line.substring(result.range.start.character, result.range.end.character)}"`);
                }
            }
        }
    });
});