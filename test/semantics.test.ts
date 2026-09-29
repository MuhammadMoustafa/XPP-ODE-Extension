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

suite('numeric "@" option values', () => {
    // XPP reads these with atof(), which stops at the first character that cannot be part of a
    // number and reports nothing. Values below were confirmed by running the file through
    // "xppautX -silent" and reading the resulting output.dat.
    const values = (text: string) => run(text).filter(r => r.type === 'option-value').map(r => r.message);

    test('flags a value that is not a plain number', () => {
        assert.strictEqual(values('@ total=2*3').length, 1);   // XPP: total is 2, not 6
        assert.strictEqual(values('@ total=2+3').length, 1);   // XPP: 2
        assert.strictEqual(values('@ total=4abc').length, 1);  // XPP: 4
        assert.strictEqual(values('@ total=(4)').length, 1);   // XPP: 0
        assert.strictEqual(values('@ dt=a').length, 1);        // XPP: 0
    });

    test('is an error: XPP runs, but nobody writes this on purpose', () => {
        assert.deepStrictEqual(run('@ total=2*3').map(r => r.severity), ['error']);
    });

    test('says which value XPP will actually use', () => {
        assert.ok(values('@ total=2*3')[0].includes('silently set to 2'), values('@ total=2*3')[0]);
        assert.ok(values('@ total=(4)')[0].includes('silently set to 0'), values('@ total=(4)')[0]);
    });

    test('accepts every plain number XPP accepts', () => {
        // All confirmed to work: t0=-5 starts the run at -5, total=.5 and 1e1 behave as written.
        assert.deepStrictEqual(values('@ t0=-5'), []);
        assert.deepStrictEqual(values('@ t0=-3E-5'), []);
        assert.deepStrictEqual(values('@ total=1e1'), []);
        assert.deepStrictEqual(values('@ total=.5'), []);
        assert.deepStrictEqual(values('@ dt=+0.5'), []);
        assert.deepStrictEqual(values('@ total=4,dt=0.5,t0=-1'), []);
    });

    test('leaves options that take a name, file or keyword alone', () => {
        assert.deepStrictEqual(values('@ meth=cvode'), []);
        assert.deepStrictEqual(values('@ xp=x,yp=y'), []);
        assert.deepStrictEqual(values('@ output=out.dat'), []);
        assert.deepStrictEqual(values('@ bigfont=lucidasans-24'), []);
    });

    test('does not double-report a value on a line XPP already ignores', () => {
        // These all leave total at its default of 20, confirmed by running them; the option being
        // dropped is the error worth showing, not the value it never got.
        assert.deepStrictEqual(run('@ total = 2*3').map(r => r.type), ['option']);
        assert.deepStrictEqual(run('@ total= 4').map(r => r.type), ['option']);
        assert.deepStrictEqual(run('@ total=').map(r => r.type), ['option']);
    });

    test('init values are read the same way', () => {
        // Confirmed in xppautX: init y=2*3 starts y at 2, init y=a, exp(0) and a+1 at 0.
        const inits = (text: string) => run(`${text}\nx'=-x\ny'=-y\ndone`).filter(r => r.type === 'init-value');
        assert.deepStrictEqual(inits('init y=2*3').map(r => r.severity), ['error']);
        assert.ok(inits('init y=2*3')[0].message.includes('silently starts at 2'), inits('init y=2*3')[0].message);
        assert.ok(inits('init y=a')[0].message.includes('silently starts at 0'), inits('init y=a')[0].message);
        assert.strictEqual(inits('i y=exp(0)').length, 1);
        assert.strictEqual(inits('init x=1, y=a+1').length, 1);
        assert.deepStrictEqual(inits('init x=1, y=a+1').map(r => [r.line, r.start, r.end]), [[0, 12, 15]]);
        assert.deepStrictEqual(inits('init x=-5 y=1e-3'), []);
        assert.deepStrictEqual(inits('init x=.5,y=+2'), []);
        assert.deepStrictEqual(inits('init x'), []);
    });

    test('options may be separated by spaces as well as commas', () => {
        // "@ bound=10000 meth=cvode dt=.05 total=100" sets all four, verified by running it.
        assert.deepStrictEqual(run('@ dt=.05 meth=cvode total=100'), []);
        assert.deepStrictEqual(run('@ xhi=1 t0=.01,dt=.01,total=.99'), []);
        assert.deepStrictEqual(run('@ parmin=-.2 parmax=.5'), []);
        // and every one of them is still checked
        assert.deepStrictEqual(run('@ dt=.05 nosuchopt=1').map(r => r.type), ['option']);
        assert.deepStrictEqual(run('@ dt=.05 total=2*3').map(r => r.type), ['option-value']);
    });
});

suite('"x(0)=" initial conditions', () => {
    // Confirmed in xppautX: with "par a=2", "y(0)=a" starts y at 0 and "y(0)=exp(0)" at 0, while
    // "y(0)=2*3" starts it at 2. The formula is only kept as the history for delay equations.
    const conditions = (text: string) => run(`par a=2\ny'=-y*a\n${text}\ndone`).filter(r => r.type === 'initcond-formula');

    test('warns when the value is not a plain number', () => {
        assert.deepStrictEqual(conditions('y(0)=a').map(r => [r.severity, r.line, r.start, r.end]), [['warning', 2, 5, 6]]);
        assert.strictEqual(conditions('y(0)=exp(0)').length, 1);
        assert.strictEqual(conditions('y(0)=2*3').length, 1);
    });

    test('says where the variable really starts', () => {
        assert.ok(conditions('y(0)=a')[0].message.includes('starts "y" at 0'), conditions('y(0)=a')[0].message);
        assert.ok(conditions('y(0)=2*3')[0].message.includes('starts "y" at 2'), conditions('y(0)=2*3')[0].message);
        assert.ok(conditions('y(0)=a')[0].message.includes('delay'), conditions('y(0)=a')[0].message);
    });

    test('accepts plain numbers', () => {
        assert.deepStrictEqual(conditions('y(0)=-5'), []);
        assert.deepStrictEqual(conditions('y(0)=1e-3'), []);
        assert.deepStrictEqual(conditions('y(0)= .5'), []);
    });

    // Confirmed in xppautX: "x[1..2](0)=a" starts both at 2, "x[1..2](0)=[j]*2" at 2 and 4, and
    // "x[1..2](0)=ran(1)" at random values: an array's condition is a real formula.
    test('leaves array initial conditions alone, which XPP evaluates', () => {
        const results = run("par a=2\nx[1..2]'=0\nx[1..2](0)=a*[j]\ndone").filter(r => r.type === 'initcond-formula');
        assert.deepStrictEqual(results, []);
    });

    test('is only information when the model has delays, where a formula is legitimate history', () => {
        const results = run("par a=2\ny'=-delay(y,1)\ny(0)=a*t\ndone").filter(r => r.type === 'initcond-formula');
        assert.deepStrictEqual(results.map(r => r.severity), ['information']);
    });
});

suite('tables, Markov chains and derived parameters (measured on xppautX 2026-09-29)', () => {
    const problems = (text: string) => run(text).filter(r => r.type === 'syntax');

    test('a two-dimensional table is an error: XPP stops loading', () => {
        const results = problems("table g @ foo.dat\ny'=0\ndone");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].severity, 'error');
        assert.ok(results[0].message.includes('TWO D NOT HERE YET'));
        assert.strictEqual(problems("table f % 3 0 1 t\ntable h data.tab\ny'=f(1)+h(1)\ndone").length, 0);
    });

    test('a Markov cell without its closing "}" is an error', () => {
        const results = problems("par a=1,b=1\nmarkov z 2\n{0} {a\n{b} {0}\ny'=z\ndone");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].line, 2);
        assert.strictEqual(results[0].start, 4);
        assert.strictEqual(problems("par a=1,b=1\nmarkov z 2\n{0} {a}\n{b} {0}\ny'=z\ndone").length, 0);
    });

    test('a second "markov" with the same name is an error', () => {
        const text = "par a=1,b=1\nmarkov z 2\n{0} {a}\n{b} {0}\nmarkov z 2\n{0} {b}\n{a} {0}\ny'=z\ndone";
        const results = ofType(text, 'markov-duplicate');
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].line, 4);
        assert.strictEqual(results[0].severity, 'error');
    });

    test('a derived parameter reading t, a variable or a random function is frozen: warning', () => {
        const text = "par a=2\ny'=1\naux w=y\n!d=y\n!e=a*t\n!r=ran(1)\n!f=w+1\n!ok=a*2\ny(0)=d+e+r+f+ok\ndone";
        const results = ofType(text, 'derived-frozen');
        assert.deepStrictEqual(results.map(r => r.line), [3, 4, 5, 6]);
        assert.ok(results.every(r => r.severity === 'warning'));
        assert.ok(results[0].message.includes('"y"'));
        assert.deepStrictEqual(ofType("par a=2\n!d=a*2+sin(a)\ny'=d\ndone", 'derived-frozen'), []);
    });

    test('its quick fix removes the "!", also when the variable sits on a continuation line', () => {
        const apply = (text: string) => {
            const [result] = ofType(text, 'derived-frozen');
            assert.ok(result.fix, 'a fix');
            const lines = text.split('\n');
            const { line, start, end, text: replacement } = result.fix!;
            lines[line] = lines[line].substring(0, start) + replacement + lines[line].substring(end);
            return { title: result.fix!.title, text: lines.join('\n') };
        };
        const fixed = apply("y'=1\n  ! d = y+1\ndone");
        assert.strictEqual(fixed.text, "y'=1\n  d = y+1\ndone");
        assert.strictEqual(fixed.title, 'Write "d=..." (worked out every step)');
        assert.deepStrictEqual(ofType(fixed.text, 'derived-frozen'), []);
        assert.strictEqual(apply("y'=1\n!d=2*\\\ny\ndone").text, "y'=1\nd=2*\\\ny\ndone");
    });
});
