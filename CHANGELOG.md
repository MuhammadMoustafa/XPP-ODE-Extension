# Change Log

All notable changes to this extension will be documented in this file.

## Version 0.4.1

- New checks for how XPP's parser groups `^`, comparisons and unary minus, all confirmed by running the expressions through `add_expr()`/`evaluate()` in xppautX and the failing files through `xppautX -silent`. They follow from one table: priority 7 is `^`, `**` and every comparison; priority 6 is `*`, `/`, `&` and unary minus; priority 4 is binary `+`, `-` and `|`.
  - **Error**: a sign where XPP allows none. A sign is only legal at the start of an expression, after `(` or after `,`, so `2*-3`, `x^-2`, `a+-b`, `if(t<-1.3)` and a unary `+` anywhere are rejected and the file does not load (`ERROR compiling X'`). The message gives the bracketing that works, and notes that `(+2)` is not a fix for a `+`. A quick fix applies it: `2*-3` becomes `2*(-3)`, `2*+3` becomes `2*3`.
  - **Warning**: a comparison standing next to arithmetic. Comparisons bind tighter than every arithmetic operator, so XPP evaluates the comparison first and applies the arithmetic to its 0 or 1: `2*3<4` is `2*(3<4)` = 2 and not 0, `3-1<2` is `3-(1<2)` = 2 and not 0, `1+2<3+4` is `1+(2<3)+4` = 6 and not 1, and `1/2<1` is `1/(2<1)`, a division by zero. A leading sign is the same rule: `-1<0` is `-(1<0)` = -0, i.e. **false**, and `-1>=0` is `-(1>=0)` = -1, i.e. **true**, so an `if` silently takes the wrong branch.
  - **Information**: `^` groups to the left (`2^3^2` is `(2^3)^2` = 64, not 512) and unary minus binds more weakly than `^` (`-2^2` is `-(2^2)` = -4, not 4). Both are legal and usually intended — `exp(-x^2)` means what it looks like — so they are not warnings.
  - Tunable through `xpp-ode.precedence.power` and `xpp-ode.precedence.comparison` (`warning`, `information`, `hint` or `off`). The error is always reported, like the other things XPP rejects.
  - **Warning**: `a<b<c`. Comparisons group to the left, so XPP reads `(a<b)<c` and the second one tests the first one's 0 or 1 against `c`. `3<2<1` is 1, i.e. **true**, although neither half holds. The message suggests the `&` form.
- `@` option lines are now parsed the way XPP parses them, and their values are checked:
  - Options are separated by commas **and spaces**, so `@ bound=10000 meth=cvode dt=.05 total=100` sets all four. The extension previously split on commas only and silently saw just the first option on such a line, missing the unknown-name check on the rest.
  - **Error**: a numeric option whose value is not a plain number. XPP still runs, but as with `@ dt = 0.1` beside it there is no legitimate reason to write it. XPP reads these with `atof()`, which stops at the first character that cannot be part of a number and reports nothing, so `@ total=2*3` is 2 and not 6, `@ total=4abc` is 4 and `@ total=(4)` is 0. `@` values are not expressions. Which options are numeric is taken from the `msc(...)` dispatch in xppautX `core/load_eqn.c`; options that take a name, file or keyword (`meth=cvode`, `xp=x`) are left alone.
  - The "option is ignored" error now also covers `@ total=` and `@ total= 4`, which XPP drops just as it drops `@ total = 4`: every piece of an `@` line must be exactly `name=value`. All three were confirmed to leave the option at its default.
- More checks for what XPP reads differently from how it looks, each measured on xppautX:
  - **Error**: operators XPP does not have. `!=` is in its operator table but its reader stops at the `!` (`illegal expression: 1!`), and `&&`, `||` and a leading `!` are not operators at all; the file does not load. Quick fixes write `not(a==b)`, `&`, `|` and `not(a)` (`!name=` derived parameters are left alone).
  - **Warning**: `&` or `|` next to arithmetic. `&` has the priority of `*` and `|` that of `+`, so `1+1&1` is `1+(1&1)` = 2 and `a|b-c` is `(a|b)-c`. Set by the new `xpp-ode.precedence.logical` (default `warning`).
  - **Error**: an `if` that is not `if(c)then(a)else(b)`. XPP removes spaces before reading, so `if(c)then 10 else 20` fails as `illegal expression: 10EL`; the message gives the real cause. A missing `else` is an error too.
  - **Information**: an operator right after the `else` part applies to the whole `if`: `if(1>0)then(10)else(20)+5` is 15.
  - **Error**: an `init` value that is not a plain number. It is read with `atof()`, like an `@` value: `init y=2*3` starts `y` at 2 and `init y=a` at 0.
  - **Warning**: a formula in `y(0)=`. `y` starts at the number `atof()` finds (`y(0)=a` at 0); the formula is only kept as `y`'s history for delay equations, so in a model using `delay` this is information. Array conditions (`x[1..5](0)=a*[j]`) are evaluated by XPP and not reported.
  - **Warning**: a division by a literal `0`. XPP replaces a zero divisor with about 2.2e-15, so `1/0` is 4.5e14 and `0/0` is 0, silently.
  - Semantic diagnostics now name their source, `xpp`, like the others.
- 38 option names XPP accepts but the extension did not know (`s1`, `slo1`, `shi1`, `histlo`, `speccol`, `ncol`, `quiet`, ...) no longer produce a spurious "Unknown option" warning.
- Hovering over `^`, `**` or a comparison operator explains its priority, with worked examples.
- The parsed model now exposes the expression on each line, with comments removed and `\` continuations joined, so these checks cannot fire inside a comment or after `done`.
- README: the custom-colour precedence (exact name > wildcard > group, one entry per name, closer files override) is spelled out with examples.
- Descriptions on hover, like docstrings. A `#` comment after the code of a declaration line describes its name, or is shared by all its names; `name: text` parts separated by `;` describe each name, and `# name: text` lines directly above the declaration do the same for long lists. Keys can pick array members: `x7:`, `x[3..5]:`, `x[1..3, 7]:`. Hovering a name in code shows its kind and every description that applies, most specific first (own, then selection, then the array's or the shared one), including those in `#include`d files.
  - **Warning**: two descriptions at the same level for one name. The later one wins; the other links to it and has a quick fix that removes it.
  - **Warning**: a key for an array member that does not exist (`x11:` for `x[1..10]`).
  - `.xppsettings.json` and `xpp-ode.variables` entries take a `description`, shown after the comments; an entry may hold only a description. Every level contributes: the name's own entry, its array's, each matching wildcard and its group. Completion of names in `.xppsettings.json` shows their comment description.
- The per-folder `.xppcolors.json` is replaced by `.xppsettings.json`, which holds the same entries under a `"variables"` key so the file can carry other settings later; the `xpp-ode.identifierColors` setting is renamed `xpp-ode.variables`, with the same value. Other top-level keys in `.xppsettings.json` are reported (with a hint when they look like an entry that belongs under `"variables"`). The old file and setting are still read, before the new ones so these win key by key, and each use gives one deprecation warning; they will be removed in a later release. Schema validation, completion (`"variables"`, then groups and declared names) and colour swatches cover both files and both settings.

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
