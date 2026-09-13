# Change Log

All notable changes to this extension will be documented in this file.

## Version 0.4.0

- Parentheses checker no longer stops working after the first comment in a file.
- Renaming a global now also updates its uses inside function bodies and on the right-hand side of `y(t)=` definitions.
- Renaming inside `dX/dt` with an upper-case variable, or a variable named `d`, targets the right characters.
- Uncommenting keeps the line indentation.
- New `.ode`/`.inc` files only get `done`/`#done` inserted when they are empty.
- Reserved words (`sin`, `t`, `pi`, ...) can no longer be renamed; new names are validated as identifiers.
- `#` inside `int{...}` is treated as XPP's convolution operator, not a comment.
- Code after `done` (or `#done` in `.inc` files) is reported as an error; comments are allowed there.
- Diagnostics are removed when a file is closed, and the `xpp-ode.debounceDelay` setting is now honoured.
- Reserved words, declaration keywords, and `@` option names updated from the XPPAUT documentation and verified against xppaut 8.0: only builtins, `t`, `pi` and `set` are reserved; `p=1`, `par=1` or `done=1` are legal variables, and `p a=1`, `params a=1`, `number a=1` declare parameters.
- Syntax highlighting: function calls no longer swallow the rest of the line; `sqrt`, `mod`, `besseli`, `arg1`..`arg9` and the `special` functions are highlighted as builtins.
- "Extract to Variable" matches whole tokens only and skips comments.
- New shared parser for `.ode` files (`xppModel.ts`) following xppaut 8.0's line rules, and new warnings built on it: undefined names, unused parameters/fixed variables/functions (faded), initial conditions for non-state variables, lines XPP silently ignores, unknown `@` options, and fixed variables named like a keyword. `@` options with spaces around `=` and `solv` with spaces are errors, since XPP ignores or rejects them. Names from `#include`d files are taken into account.
- All XPP and AUTO `@` option names are recognised and highlighted.
- Dev dependencies updated (TypeScript 5, `@types/node` 20, `@types/vscode` matching the engine).

## Version 0.3.0

- All derivative formats are now renamed and highlighted correctly. (Please report any malfunction cases.)
- Limit renaming of function parameters to the function's scope.

## Version 0.2.1

- Improved comment functionality to avoid affecting other file extensions.
- Extension now activates on VS Code startup, ensuring it works with newly created `.ode` and `.inc` files.
- "Run ODE File" button now appears only in the editor bar.

## Version 0.2.0

- Added "Run ODE File" Button.
- Implemented "Extract Variable" Feature.
- Bug fixes.

## Version 0.1.0

- Enable renaming of variables and functions using the VS Code renaming shortcut (except for `d<var>/dt` format, which is not yet implemented).
- Show an error when a reserved word is used as a variable name.
- Highlight all occurrences of a variable when hovering over it.
- Improve syntax highlighting:
  - Recognize numbers with scientific notation (`e`) as numbers.
  - Highlight common XPPAUT and AUTO option keywords.
  - Enhance highlighting for functions and parameters.
- Check for unbalanced parentheses.
- Fix issues with commenting and uncommenting `#done` and `#include`.
- Automatically add `done` and `#done` at the end of new `.ode` or `.inc` files.

## Version 0.0.1

- Support for `.inc` files
- Highlight missing reserved words like `done` and `include`
- Fix multi-line commenting

## Future Work

- Add all XPPAUT and AUTO option keywords
- Ensure `Run ODE File` button works on all operating systems
- Detect undefined variables
- Detect unused variables and gray them out
- Handle active comments
