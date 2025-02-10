import * as vscode from 'vscode';

export const reservedWords = new Set([
    "parameter", "param", "par", "bdry", "bndry", "volt", "init", "aux", "global", "markov", "wiener", "table",
    "maxstor", "back", "small", "big", "smc", "umc", "xnc", "ync", "but", "ds", "dsmin", "dsmax",
    "include", "done", "sin", "cos", "tan", "atan", "atan2", "sinh", "cosh", "tanh", "exp", "delay", "ln", "log", "log10",
    "t", "pi", "if", "then", "else", "asin", "acos", "heav", "sign", "ceil", "flr", "ran", "abs", "del_shft", "max", "min",
    "normal", "besselj", "bessely", "erf", "erfc", "hom_bcs", "sum", "shift", "not", "@", "$", "e"
]);

export const supportedFiles = (document: vscode.TextDocument) => {
    return document.fileName.endsWith('.ode') || document.fileName.endsWith('.inc');
};
