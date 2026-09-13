import * as assert from 'assert';
import { parseXpp, scanReferences } from '../src/utils/xppModel';
import { checkSemantics } from '../src/utils/semanticCheckerCore';

function run(text: string, external: string[] = [], skipUndefined = false) {
    return checkSemantics(parseXpp(text), new Set(external), skipUndefined);
}
function ofType(text: string, type: string) {
    return run(text).filter(r => r.type === type);
}

suite('XPP model and semantic checks', () => {
    suite('line classification', () => {
        test('classifies the declaration forms XPP recognises', () => {
            const model = parseXpp([
                'par a=1', 'p b=2', 'params c=3', 'number k=4', 'init x=0', 'i y=0', 'aux z=x', 'au zz=x',
                'wiener w', 'global 1 x-1 {x=0}', 'bdry x-1', 'volt v=x', 'markov m 2', 'table f % 3 0 1 t',
                'set s1 {a=1}', 'solv q=0', 'special sp1=conv(even,3,1,f,x0)', 'export {a} {b}',
                "x'=-x", 'dy/dt=-y', 'z(t+1)=z', 'x(0)=1', 'g(u)=u*a', 'fixed=1', '!der=a*2', '0=q-x',
                '@ dt=0.1', '# comment', '" extracted comment', '{0} {a}', '%[1..3]', 'done', 'anything here',
            ].join('\n'));
            const kinds = model.lineInfos.map(i => i.kind);
            assert.deepStrictEqual(kinds, [
                'parameter', 'parameter', 'parameter', 'parameter', 'init', 'init', 'aux', 'aux',
                'wiener', 'global', 'bdry', 'volterra', 'markov', 'table',
                'set', 'solv', 'special', 'export',
                'state', 'state', 'state', 'initcond', 'function', 'fixed', 'derived', 'algebraic',
                'option', 'comment', 'comment', 'markov-row', 'array-block', 'done', 'comment',
            ]);
        });

        test('word followed by a name is a declaration, word followed by = is a variable', () => {
            const model = parseXpp('p a=1\np=2\ninit=3\ndone=4\ndt=5');
            assert.deepStrictEqual(model.lineInfos.map(i => i.kind), ['parameter', 'fixed', 'fixed', 'fixed', 'fixed']);
            assert.deepStrictEqual(model.declarations.map(d => `${d.kind}:${d.name}`), ['parameter:a', 'fixed:p', 'fixed:init', 'fixed:done', 'fixed:dt']);
        });

        test('done may carry a trailing comment or text', () => {
            const model = parseXpp("x'=-x\ndone # the end\ny'=-y\n\n# notes");
            assert.deepStrictEqual(model.lineInfos.map(i => i.kind), ['state', 'done', 'comment', 'blank', 'comment']);
            assert.deepStrictEqual(parseXpp("x'=-x\ndt=0.1\ndone").lineInfos.map(i => i.kind), ['state', 'fixed', 'done']);
        });

        test('unknown prefixes and tabs after keywords are flagged as ignored', () => {
            assert.strictEqual(parseXpp('a z=x').lineInfos[0].kind, 'ignored');
            assert.strictEqual(parseXpp('m z 2').lineInfos[0].kind, 'ignored');
            assert.strictEqual(parseXpp('init\tx=5').lineInfos[0].kind, 'ignored');
            assert.strictEqual(ofType('a z=x', 'ignored-line').length, 1);
        });

        test('joins continuation lines and keeps positions on the physical line', () => {
            const model = parseXpp("x'=-x+\\\n   k\npar k=1");
            assert.strictEqual(model.lineInfos[1].kind, 'continuation');
            const ref = model.references.find(r => r.name === 'k');
            assert.deepStrictEqual([ref?.line, ref?.start], [1, 3]);
            assert.deepStrictEqual(run("x'=-x+\\\n   k\npar k=1"), []);
        });
    });

    suite('parameters', () => {
        test('accepts comma or space separated pairs, spaces around =, and bare names', () => {
            const model = parseXpp('par a=1, b = 2  c=3\npar ind');
            assert.deepStrictEqual(model.declarations.map(d => d.name), ['a', 'b', 'c', 'ind']);
            assert.deepStrictEqual(model.declarations.map(d => d.start), [4, 9, 16, 4]);
        });
    });

    suite('undefined names', () => {
        test('reports names that are declared nowhere', () => {
            const results = ofType("x'=-x+eps\ndone", 'undefined');
            assert.deepStrictEqual(results.map(r => [r.message, r.line, r.start, r.severity]), [['"eps" is not defined', 0, 6, 'warning']]);
        });

        test('knows every declaration kind, builtins, function parameters and internal flags', () => {
            const text = [
                'par a=1', 'number n=2', 'wiener w', 'markov m 2', '{0} {a}', '{a} {0}', 'table tab % 3 0 1 t',
                'special s=conv(even,3,1,tab,u0)', 'f(q)=q*a', '!d=a*2', 'u[0..2]\'=-u[j]+f(u[j])+w+m+s(0)+d+n',
                'x\'=sin(t)+pi+heav(x)+sum(0,2)of(shift(u0,i\'))+ran(1)+1e-3',
                'global 1 x-1 {x=0;out_put=1;arret=1}', '@ xp=x', 'done',
            ].join('\n');
            assert.deepStrictEqual(ofType(text, 'undefined'), []);
        });

        test('resolves array references through their members and vice versa', () => {
            assert.deepStrictEqual(ofType("p1=1\np2=2\nv[1..2]'=-v[j]+p[j]\ndone", 'undefined'), []);
            assert.deepStrictEqual(ofType("v0=v1\nv[1..2]'=-v[j]+v[j-1]\ndone", 'unused'), []);
        });

        test('names from included files count as declared', () => {
            assert.deepStrictEqual(run("#include pars.inc\nx'=-x*a", ['a']).filter(r => r.type === 'undefined'), []);
            assert.deepStrictEqual(run("x'=-x*a", [], true).filter(r => r.type === 'undefined'), []);
        });

        test('warns when an initial condition targets something that is not a state variable', () => {
            const results = ofType("par a=1\ninit a=2\nx'=-x\nx(0)=1\ny(0)=2\ndone", 'init-target');
            assert.deepStrictEqual(results.map(r => [r.line, r.start]), [[1, 5], [4, 0]]);
        });
    });

    suite('unused declarations', () => {
        test('flags parameters, fixed variables and functions that are never referenced, faded', () => {
            const results = ofType("par a=1,b=2\nc=3\nf(q)=q\nx'=-x*a\ndone", 'unused');
            assert.deepStrictEqual(results.map(r => [r.message, r.unnecessary]), [
                ['Parameter "b" is never used', true],
                ['Fixed "c" is never used', true],
                ['Function "f" is never used', true],
            ]);
        });

        test('never flags state, aux or solv variables, and counts export lists as uses', () => {
            assert.deepStrictEqual(ofType("par a=1\nx'=-x\naux z=x\nexport {a} {z}\ndone", 'unused'), []);
        });
    });

    suite('options', () => {
        test('spaces around = are an error, unknown names a warning', () => {
            const results = run('@ total=10, dt = 0.1, foo=1\ndone').filter(r => r.type === 'option');
            assert.deepStrictEqual(results.map(r => [r.start, r.severity]), [[12, 'error'], [22, 'warning']]);
        });

        test('knows the AUTO options', () => {
            assert.deepStrictEqual(run('@ ntst=50,nmax=200,npr=10,ds=0.01,dsmin=0.001,dsmax=0.1,parmin=0,parmax=1,normmin=0,normmax=100,epsl=1e-4,epsu=1e-4,epss=1e-4,autoxmin=0,autoxmax=1,autoymin=0,autoymax=1,autovar=x\ndone'), []);
        });
    });

    suite('keyword-like names and solv spacing', () => {
        test('warns on fixed variables named like a keyword but not on parameters', () => {
            assert.strictEqual(ofType("p=1\nx'=-x+p\ndone", 'keyword-name').length, 1);
            assert.strictEqual(ofType("par p=1\nx'=-x+p\ndone", 'keyword-name').length, 0);
        });

        test('solv requires name=expression without spaces', () => {
            const results = run("x'=-y\n0=y+exp(y)-x\nsolv y = -.5\ndone").filter(r => r.type === 'syntax');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].severity, 'error');
        });
    });

    suite('scanReferences', () => {
        test('skips numbers, builtins, bracket indices and primed names', () => {
            const names = scanReferences("1e-3*a+.5*sin(b)+u[j+1]+sum(0,2)of(shift(u0,i'))+p{1-2}").map(r => r.name);
            assert.deepStrictEqual(names, ['a', 'b', 'u', 'u0', 'p1', 'p2']);
        });
    });
});
