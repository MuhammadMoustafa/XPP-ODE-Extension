import assert from 'assert';
import { checkVariablesAndParameters } from '../src/utils/variableCheckerCore';

const tests = [
    { desc: 'duplicate parameter names', text: 'par a=1, b=2\npar a=3', expect: "Duplicate parameter name: 'a'" },
    { desc: 'duplicate variable names', text: 'x=1\nx=2', expect: "Duplicate variable name: 'x'" },
    { desc: 'parameter/variable name conflict', text: 'par y=1\ny=2', expect: "Variable name 'y' conflicts with parameter name: 'y'" },
    { desc: 'reserved word as variable', text: 'if=1', expect: 'Reserved word used as variable name: if' },
    { desc: 'case insensitive for parameters and variables', text: 'par A=1\na=2', expect: "Variable name 'a' conflicts with parameter name: 'a'" },
    { desc: 'duplicate parameter in same line', text: 'par b=1, b=2', expect: "Duplicate parameter name: 'b'" },
    { desc: 'duplicate variable in derivative and assignment', text: 'dx/dt=1\nx=2', expect: "Duplicate variable name: 'x'" }
];

suite('VariableChecker', () => {
    tests.forEach(({ desc, text, expect }) => {
        test(desc, () => {
            const diagnostics = checkVariablesAndParameters(text);
            assert.ok(diagnostics.some(d => d.message.includes(expect)), `Expected diagnostic message to include: ${expect}`);
        });
    });
});
