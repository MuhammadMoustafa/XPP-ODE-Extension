import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readIncludedFiles } from '../src/utils/includeFiles';
import { parseXpp } from '../src/utils/xppModel';

suite('readIncludedFiles', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpp-inc-'));
    const write = (name: string, text: string) => fs.writeFileSync(path.join(dir, name), text);
    const names = (root: string) => {
        const text = fs.readFileSync(path.join(dir, root), 'utf8');
        return readIncludedFiles(path.join(dir, root), parseXpp(text).includes).map(f => path.basename(f.path));
    };

    suiteTeardown(() => fs.rmSync(dir, { recursive: true, force: true }));

    test('follows the includes of included files, depth first', () => {
        write('main.ode', '#include a.inc\n#include c.inc\ndone\n');
        write('a.inc', '#include b.inc\npar p=1\n#done\n');
        write('b.inc', 'par q=2\n#done\n');
        write('c.inc', 'par r=3\n#done\n');
        assert.deepStrictEqual(names('main.ode'), ['a.inc', 'b.inc', 'c.inc']);
    });

    test('reads a file once, and ends a cycle at the including file', () => {
        write('loop.ode', '#include x.inc\n#include y.inc\ndone\n');
        write('x.inc', '#include y.inc\n#include loop.ode\n#done\n');
        write('y.inc', '#include x.inc\n#done\n');
        assert.deepStrictEqual(names('loop.ode'), ['x.inc', 'y.inc']);
    });

    test('skips a missing file', () => {
        write('gone.ode', '#include nope.inc\ndone\n');
        assert.deepStrictEqual(names('gone.ode'), []);
    });
});
