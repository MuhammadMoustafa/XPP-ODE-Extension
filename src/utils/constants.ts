import * as vscode from 'vscode';

/**
 * Word lists taken from the XPPAUT help pages (help/xppodes.html, help/xppopt.html,
 * help/xppauto.html) and the example .ode files shipped with XPP.
 */

/**
 * Words that start a declaration line ("par a=1", "init x=0", "done", ...).
 *
 * XPP only looks at the first letters of the word (see `declarationPrefixPattern`), so
 * "p a=1", "params a=1" and "parameter a=1" are all parameter declarations. These words are
 * NOT reserved: "par=1", "done=1" or "p=1" define ordinary fixed variables.
 */
export const declarationKeywords = [
    'parameter', 'parameters', 'param', 'params', 'par', 'number',
    'init', 'aux', 'global', 'markov', 'wiener', 'table',
    'bdry', 'bndry', 'volt', 'volterra',
    'special', 'set', 'only', 'export', 'import', 'solv', 'solve', 'options',
    'done', 'include',
];

/**
 * Prefixes XPP recognises at the start of a line when followed by whitespace and a name
 * (verified against xppaut 8.0): single letters for par, init, wiener, number, global, bdry,
 * volterra and options; two letters for aux, markov, table, set, solv, special, export, import, only.
 */
export const declarationPrefixPattern = '(?:p|i|w|n|g|b|v|o|au|ma|ta|se|so|sp|ex|im|on)[a-z]*';

/** Built-in functions and operators listed under "Reserved words" in xppodes.html. */
export const builtinFunctions = [
    'sin', 'cos', 'tan', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
    'exp', 'delay', 'ln', 'log', 'log10', 'sqrt', 'mod',
    'asin', 'acos', 'heav', 'sign', 'flr', 'ran', 'abs', 'del_shft',
    'max', 'min', 'normal', 'besselj', 'bessely', 'besseli', 'erf', 'erfc', 'hom_bcs',
    'shift', 'sum', 'of', 'int', 'not', 'set',
    'if', 'then', 'else',
    'arg1', 'arg2', 'arg3', 'arg4', 'arg5', 'arg6', 'arg7', 'arg8', 'arg9',
];

/** Functions usable on the right-hand side of a "special" declaration. */
export const specialFunctions = [
    'conv', 'fconv', 'sparse', 'fsparse', 'mmult', 'fmmult', 'findext',
];

/** Built-in constants. */
export const builtinConstants = ['t', 'pi'];

/**
 * Names accepted on "@" option lines: XPP options from xppopt.html / the manual, the AUTO options
 * (NTST, NMAX, NPR, EPSU, EPSS, EPSL, DSMIN, DSMAX, DS, PARMIN, PARMAX, NORMMIN, NORMMAX,
 * AUTOXMIN, AUTOXMAX, AUTOYMIN, AUTOYMAX, AUTOVAR), plus the spellings used by the bundled examples.
 */
export const optionNames = [
    'atol', 'atoler', 'autoeval', 'autovar', 'autoxmax', 'autoxmin', 'autoymax', 'autoymin', 'axes', 'back', 'backcolor',
    'backimage', 'bandlo', 'bandup', 'bell', 'big', 'bigfont', 'bound', 'bounds', 'but', 'colorhi', 'colorize', 'colorlo',
    'colormap', 'colorvia', 'delay', 'dfdraw', 'dfgrid', 'dll_fun', 'dll_lib', 'ds', 'dsmax', 'dsmin', 'dt', 'dtmax',
    'dtmin', 'dwcolor', 'epsl', 'epss', 'epsu', 'fold', 'forecolor', 'grads', 'height', 'histbins', 'histbins2', 'histcol',
    'histcol2', 'histhi', 'histhi2', 'histlo', 'histlo2', 'jac_eps', 'logfile', 'lt', 'maxstor', 'meth', 'method', 'multiwin',
    'mwcolor', 'ncdraw', 'ncol', 'newt_iter', 'newt_tol', 'njmp', 'nmax', 'nmesh', 'normmax', 'normmin', 'nout', 'nplot',
    'npr', 'nstab', 'ntst', 'output', 'parmax', 'parmin', 'phi', 'plotfmt', 'poimap', 'poipln', 'poisgn', 'poistop', 'poivar',
    'postprocess', 'ps_color', 'ps_font', 'ps_fsize', 'ps_lw', 'quiet', 'range', 'rangehigh', 'rangelow', 'rangeoldic',
    'rangeover', 'rangereset', 'rangestep', 'rangesteps', 'runnow', 's1', 's2', 's3', 'sec', 'seed', 'shi1', 'shi2', 'shi3',
    'simplot', 'slo1', 'slo2', 'slo3', 'small', 'smallfont', 'smc', 'spc', 'speccol', 'speccol2', 'specwidth', 'specwin',
    'stoch', 't0', 'theta', 'tol', 'toler', 'tor_per', 'total', 'trans', 'transient', 'tutorial', 'uec', 'umc', 'upc',
    'vmaxpts', 'width', 'xhi', 'xlo', 'xmax', 'xmin', 'xnc', 'xp', 'xp2', 'xp3', 'xp4', 'xp5', 'xp6', 'xp7', 'xp8', 'xplot',
    'yhi', 'ylo', 'ymax', 'ymin', 'ync', 'yp', 'yp2', 'yp3', 'yp4', 'yp5', 'yp6', 'yp7', 'yp8', 'yplot', 'zmax', 'zmin', 'zp',
    'zp2', 'zp3', 'zp4', 'zp5', 'zp6', 'zp7', 'zp8', 'zplot',
];

/**
 * Options whose value XPP reads with `atof()` (derived from the `msc("NAME", ...)` dispatch in
 * xppautX core/load_eqn.c). `atof` stops at the first character that cannot be part of a number
 * and never reports an error, so anything but a plain number is silently truncated:
 * "@ total=2*3" gives 2, "@ total=4abc" gives 4 and "@ total=(4)" gives 0.
 *
 * Options not listed here take a name, a file name or a keyword ("meth=cvode", "xp=x",
 * "output=out.dat") and are left alone.
 */
export const numericOptionNames = [
    'atol', 'autoeval', 'autoxmax', 'autoxmin', 'autoymax', 'autoymin', 'bandlo', 'bandup', 'bell', 'bound', 'colormap',
    'delay', 'dfdraw', 'dfgrid', 'ds', 'dsmax', 'dsmin', 'dt', 'dtmax', 'dtmin', 'epsl', 'epss', 'epsu', 'grads',
    'height', 'jac_eps', 'lt', 'maxstor', 'ncdraw', 'newt_iter', 'newt_tol', 'njmp', 'nmax', 'nmesh', 'normmax',
    'normmin', 'nout', 'nplot', 'npr', 'ntst', 'parmax', 'parmin', 'phi', 'poipln', 'poisgn', 'poistop', 'ps_color',
    'ps_fsize', 'ps_lw', 'range', 'rangehigh', 'rangelow', 'rangestep', 'runnow', 'seed', 'smc', 'stoch', 't0',
    'theta', 'tol', 'tor_per', 'total', 'trans', 'umc', 'vmaxpts', 'width', 'xhi', 'xlo', 'xmax', 'xmin', 'xnc', 'yhi',
    'ylo', 'ymax', 'ymin', 'ync', 'zmax', 'zmin',
];

/**
 * Names XPP rejects with "duplicate name" when used for variables, parameters, or functions
 * (verified against xppaut 8.0). Declaration keywords, option names, the "special" functions
 * and "int" are accepted by XPP as ordinary names, so they are not listed here.
 */
export const reservedWords = new Set<string>([
    ...builtinFunctions.filter(name => name !== 'int'),
    ...builtinConstants,
]);

export const XPP_LANGUAGE_ID = 'xpp';

export const isXppDocument = (document: vscode.TextDocument) =>
    document.languageId === XPP_LANGUAGE_ID;

export const isOdeOrIncPath = (fsPath: string) =>
    fsPath.endsWith('.ode') || fsPath.endsWith('.inc');
