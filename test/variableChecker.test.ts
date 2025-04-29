import assert from 'assert';
import { checkVariablesAndParameters } from '../src/utils/variableCheckerCore';

const tests = [
    { desc: 'duplicate parameter names', text: 'par a=1, b=2\npar a=3', expect: "Duplicate parameter name: 'a'" },
    { desc: 'duplicate variable names', text: 'x=1\nx=2', expect: "Duplicate variable name: 'x'" },
    { desc: 'parameter/variable name conflict', text: 'par y=1\ny=2', expect: "Variable name 'y' conflicts with parameter name: 'y'" },
    { desc: 'reserved word as variable', text: 'if=1', expect: 'Reserved word used as variable name: if' },
    { desc: 'case insensitive for parameters and variables', text: 'par A=1\na=2', expect: "Variable name 'a' conflicts with parameter name: 'a'" },
    { desc: 'duplicate parameter in same line', text: 'par b=1, b=2', expect: "Duplicate parameter name: 'b'" },
    { desc: 'duplicate variable in derivative and assignment', text: 'dx/dt=1\nx=2', expect: "Duplicate variable name: 'x'" },
    { desc: 'function name conflicts with parameter', text: 'par f=1\nf(x)=x+1', expect: "Function name 'f' conflicts with parameter name: 'f'" },
    { desc: 'function name conflicts with variable', text: 'v=2\nv(x)=x+1', expect: "Function name 'v' conflicts with variable name: 'v'" },
    { desc: 'function name is reserved word', text: 'if(x)=x+1', expect: 'Reserved word used as function name: if' },
    { desc: 'duplicate function names', text: 'f(x)=x+1\nf(y)=y+2', expect: "Duplicate function name: 'f'" },
    { desc: 'parameter name conflicts with function', text: 'f(x)=x+1\npar f=2', expect: "Parameter name 'f' conflicts with function name: 'f'" },
    { desc: 'variable name conflicts with function', text: 'g(x)=x+1\ng=5', expect: "Variable name 'g' conflicts with function name: 'g'" },
    { desc: 'derivative variable name conflicts with function', text: 'h(x)=x+1\ndh/dt=2', expect: "Variable name 'h' conflicts with function name: 'h'" }
];

suite('VariableChecker', () => {
    tests.forEach(({ desc, text, expect }) => {
        test(desc, () => {
            const diagnostics = checkVariablesAndParameters(text);
            assert.ok(diagnostics.some(d => d.message.includes(expect)), `Expected diagnostic message to include: ${expect}`);
        });
    });
});
