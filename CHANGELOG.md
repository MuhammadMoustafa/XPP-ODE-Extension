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
- Everything after `done` (or `#done` in `.inc` files) is dimmed like a comment, since XPP stops reading there; the first non-comment line gets one warning. As in XPP, any line whose first word starts with `d` counts as `done` (`d`, `done # comment`, `delta 5`), unless the word is followed by `=`, `'`, `(`, `[` or `/dt`.
- Diagnostics are removed when a file is closed, and the `xpp-ode.debounceDelay` setting is now honoured.
- Reserved words, declaration keywords, and `@` option names updated from the XPPAUT documentation and verified against xppaut 8.0: only builtins, `t`, `pi` and `set` are reserved; `p=1`, `par=1` or `done=1` are legal variables, and `p a=1`, `params a=1`, `number a=1` declare parameters.
- Syntax highlighting: function calls no longer swallow the rest of the line; `sqrt`, `mod`, `besseli`, `arg1`..`arg9` and the `special` functions are highlighted as builtins.
- "Extract to Variable" matches whole tokens only and skips comments.
- New shared parser for `.ode` files (`xppModel.ts`) following xppaut 8.0's line rules, and new warnings built on it: undefined names, unused parameters/fixed variables/functions (faded), initial conditions for non-state variables, lines XPP silently ignores, unknown `@` options, and fixed variables named like a keyword. `@` options with spaces around `=` and `solv` with spaces are errors, since XPP ignores or rejects them. Names from `#include`d files are taken into account.
- All XPP and AUTO `@` option names are recognised and highlighted.
- "Run ODE File" now saves the file and runs xppaut in the file's folder, so `#include`d files, `table` files and `dll_lib` libraries are found; only the file name is passed, which also makes `wsl xppaut` work on Windows. The duplicate status-bar play button is gone; the button lives in the editor title bar. On Windows the terminal gets `DISPLAY` set (`xpp-ode.display`, default `127.0.0.1:0.0`) so the Cygwin build finds the X server, and `xpp-ode.xServer` can name an X server (Xming, VcXsrv) to start automatically when nothing listens on the display; when no server can be reached a warning explains what to do.
- Dev dependencies updated (TypeScript 5, `@types/node` 20, `@types/vscode` matching the engine).
- Custom colours for identifiers, configured in a `.xppcolors.json` file (per folder, including subfolders) or the `xpp-ode.identifierColors` setting (per workspace or user). Keys are names (`"v"`, arrays cover their members), `*` wildcards (`"g_*"`) or groups resolved by the parser (`@states`, `@parameters`, `@fixed`, `@functions`, `@aux`, `@wiener`, `@markov`, `@tables`, `@options`, `@builtins`, `@keywords`). Values are a hex colour or a style object with `color`, `backgroundColor`, `fontWeight`, `fontStyle`, `textDecoration`, `opacity`, `borderColor`/`borderStyle`/`borderWidth`/`borderRadius`, and `light`/`dark` overrides. Colour swatches and the colour picker work on the hex strings; `.xppcolors.json` gets schema validation and completion of groups, declared names and properties. See the README section "Custom colours for variables and parameters".

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

- Handle active comments
- `.ani` animation files
