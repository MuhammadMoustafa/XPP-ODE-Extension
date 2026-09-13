import * as assert from 'assert';
import { parseCommandLine, isWslCommand, displayEndpoint } from '../src/utils/commandLineCore';

suite('Command line helpers', () => {
    test('splits executables and arguments, keeping quoted paths together', () => {
        assert.deepStrictEqual(parseCommandLine('"C:\\Program Files (x86)\\Xming\\Xming.exe" :0 -multiwindow -clipboard'), {
            executable: 'C:\\Program Files (x86)\\Xming\\Xming.exe',
            args: [':0', '-multiwindow', '-clipboard'],
        });
        assert.deepStrictEqual(parseCommandLine('  xppaut  '), { executable: 'xppaut', args: [] });
        assert.strictEqual(parseCommandLine('   '), undefined);
    });

    test('maps DISPLAY values to the X server port', () => {
        assert.deepStrictEqual(displayEndpoint('127.0.0.1:0.0'), { host: '127.0.0.1', port: 6000 });
        assert.deepStrictEqual(displayEndpoint(':1'), { host: '127.0.0.1', port: 6001 });
        assert.deepStrictEqual(displayEndpoint('localhost:10.0'), { host: 'localhost', port: 6010 });
        assert.strictEqual(displayEndpoint('nonsense'), undefined);
    });

    test('recognises commands that run inside WSL', () => {
        assert.ok(isWslCommand('wsl xppaut'));
        assert.ok(isWslCommand('C:\\Windows\\System32\\wsl.exe -d Ubuntu xppaut'));
        assert.ok(!isWslCommand('xppaut'));
        assert.ok(!isWslCommand('C:\\xppall\\xppaut.exe -xorfix'));
    });
});
