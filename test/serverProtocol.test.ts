import * as assert from 'assert';
import { LineSplitter, commandLine, serverProcess } from '../src/utils/serverProtocolCore';

suite('xppcore-server protocol helpers', () => {
    test('appends the ode file to the server command', () => {
        assert.deepStrictEqual(serverProcess('xppcore-server', 'lecar.ode'), { executable: 'xppcore-server', args: ['lecar.ode'] });
        assert.deepStrictEqual(serverProcess('wsl -e "/home/me/xpp autX/xppcore-server"', 'a b.ode'), {
            executable: 'wsl',
            args: ['-e', '/home/me/xpp autX/xppcore-server', 'a b.ode'],
        });
        assert.strictEqual(serverProcess('  ', 'x.ode'), undefined);
    });

    test('splits server output into events across chunk boundaries', () => {
        const s = new LineSplitter();
        let r = s.push('{"ev":"hello","title":"XPP"}\n{"ev":"dr');
        assert.deepStrictEqual(r.events, [{ ev: 'hello', title: 'XPP' }]);
        assert.deepStrictEqual(r.bad, []);
        r = s.push('aw","win":1,"ops":[["clear"]]}\n\nSegmentation fault\n');
        assert.deepStrictEqual(r.events, [{ ev: 'draw', win: 1, ops: [['clear']] }]);
        assert.deepStrictEqual(r.bad, ['Segmentation fault']);
    });

    test('only well-formed commands are sent', () => {
        assert.strictEqual(commandLine({ cmd: 'key', key: 'i' }), '{"cmd":"key","key":"i"}\n');
        assert.strictEqual(commandLine({ key: 'i' }), undefined);
        assert.strictEqual(commandLine('key'), undefined);
    });
});
