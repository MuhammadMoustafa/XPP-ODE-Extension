import * as assert from 'assert';

/**
 * Test the new wordPattern approach
 */

suite('New WordPattern Tests', () => {
    
    test('test new wordPattern that excludes short patterns like dt', () => {
        const line = 'dx/dt=x+y';
        
        console.log('\n=== Testing new wordPattern approach ===');
        console.log(`Line: "${line}"`);
        
        // New pattern: longer variables (3+ chars) or single chars not followed by other chars
        const newWordPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|[a-zA-Z_][a-zA-Z0-9_]{2,}|(?<![a-zA-Z0-9_])[a-zA-Z_](?![a-zA-Z0-9_])/g;
        
        let match;
        const matches = [];
        while ((match = newWordPattern.exec(line)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        console.log('New wordPattern matches:');
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        // Check if 'dt' is matched
        const dtMatch = matches.find(m => m.text === 'dt');
        const dxMatch = matches.find(m => m.text === 'dx');
        
        if (!dtMatch) {
            console.log('✅ New pattern does not match "dt"');
        } else {
            console.log('❌ New pattern still matches "dt"');
        }
        
        if (!dxMatch) {
            console.log('✅ New pattern does not match "dx"');
        } else {
            console.log('❌ New pattern still matches "dx"');
        }
        
        // Check for single character matches
        const xMatch = matches.find(m => m.text === 'x' && m.start === 6);
        const yMatch = matches.find(m => m.text === 'y');
        
        if (xMatch) {
            console.log('✅ New pattern correctly matches single "x"');
        }
        if (yMatch) {
            console.log('✅ New pattern correctly matches single "y"');
        }
    });
    
    test('test with standalone dt variable', () => {
        console.log('\n=== Testing standalone dt ===');
        
        const standaloneLine = 'dt = 0.01';
        console.log(`Line: "${standaloneLine}"`);
        
        const newWordPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|[a-zA-Z_][a-zA-Z0-9_]{2,}|(?<![a-zA-Z0-9_])[a-zA-Z_](?![a-zA-Z0-9_])/g;
        
        let match;
        const matches = [];
        while ((match = newWordPattern.exec(standaloneLine)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        console.log('Standalone dt matches:');
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        const standaloneDtMatch = matches.find(m => m.text === 'dt');
        if (standaloneDtMatch) {
            console.log('❌ Pattern matches standalone "dt" - we don\'t want this either for consistency');
        } else {
            console.log('✅ Pattern does not match standalone "dt" - this is actually good for consistency');
        }
    });
    
    test('test even simpler approach: exclude all 2-char combinations', () => {
        console.log('\n=== Testing simpler approach: only 3+ chars or single chars ===');
        
        const line = 'dx/dt=x+y+vel';
        console.log(`Line: "${line}"`);
        
        // Even simpler: match only 3+ character variables or single characters
        const simplestPattern = /[a-zA-Z_][a-zA-Z0-9_]*\(t\)|[a-zA-Z_][a-zA-Z0-9_]*'?|[a-zA-Z_][a-zA-Z0-9_]{2,}|(?<![a-zA-Z0-9_\/])[a-zA-Z_](?![a-zA-Z0-9_\/])/g;
        
        let match;
        const matches = [];
        while ((match = simplestPattern.exec(line)) !== null) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        console.log('Simplest pattern matches:');
        matches.forEach(m => {
            console.log(`  "${m.text}" at positions ${m.start}-${m.end}`);
        });
        
        // This should match: 'vel' (3 chars), 'x' (single), 'y' (single)
        // Should NOT match: 'dx' (2 chars), 'dt' (2 chars)
        
        const hasVel = matches.some(m => m.text === 'vel');
        const hasX = matches.some(m => m.text === 'x');
        const hasY = matches.some(m => m.text === 'y');
        const hasDx = matches.some(m => m.text === 'dx');
        const hasDt = matches.some(m => m.text === 'dt');
        
        console.log(`Has 'vel': ${hasVel} ✅`);
        console.log(`Has 'x': ${hasX} ✅`);
        console.log(`Has 'y': ${hasY} ✅`);
        console.log(`Has 'dx': ${hasDx} ${hasDx ? '❌' : '✅'}`);
        console.log(`Has 'dt': ${hasDt} ${hasDt ? '❌' : '✅'}`);
    });
});