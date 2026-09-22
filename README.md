# XPP - VSCode Extension for XPPAUT Files

This repository is a fork of [Joe-McCann's XPP-ODE-Extension repo](https://github.com/Joe-McCann/XPP-ODE-Extension).

If you encounter any issues or have feature requests, feel free to open an issue or [email me](mailto:muhammadmoustafa22@gmail.com).  
Logo designed by: [Manar Moustafa](mailto:manarmoustafa246@gmail.com).

What you get for `.ode` and `.inc` files:

- Syntax highlighting, bracket matching, and commenting with `Ctrl+/`.
- [Diagnostics](#diagnostics): missing `done`, unbalanced brackets, reserved or duplicate names, undefined and unused names, options XPP would silently ignore.
- Rename (`F2`) and highlight-all-occurrences for variables, parameters and functions, across `#include`d files; "Extract to Variable" from the context menu.
- [Custom colours](#custom-colours-for-variables-and-parameters) per variable, parameter or category, shared by every model in a folder.
- A ["Run ODE File" button](#how-to-customize-the-run-command) that starts xppaut on the current file, with the setup notes for Linux, macOS and Windows.

---

## Thank you list

- **Nianqi Deng** for suggesting the ["Run ODE File" button](#how-to-customize-the-run-command)
- **Leqi (Sammy) Wang** for suggesting [custom colours for variables and parameters](#custom-colours-for-variables-and-parameters)

---

## Version 0.4.0

- Bug fixes: parentheses checking after comments, renaming globals used inside function bodies, indentation after uncommenting, and seeding of newly created files.
- `#` inside `int{...}` is treated as the convolution operator; text after `done` is dimmed and reported once as a warning.
- Reserved words, declaration keywords, and `@` options updated from the XPPAUT documentation.
- Syntax highlighting fixes for function calls and builtins.
- New warnings: undefined names, unused names (faded), ignored lines, unknown or badly spaced `@` options. See [Diagnostics](#diagnostics).
- Custom colours per variable/parameter through the `xpp-ode.identifierColors` setting or a `.xppcolors.json` file. See [Custom colours](#custom-colours-for-variables-and-parameters).

## Version 0.3.0

- All derivative formats are now renamed and highlighted correctly. (Please report any malfunction cases.)
- Limit renaming of function parameters to the function's scope.

## Version 0.2.1

- Bug fixes: Improved comment functionality to avoid affecting other file extensions.
- Extension now activates on VS Code startup, ensuring it works with newly created `.ode` and `.inc` files.
- "Run ODE File" button now appears only in the editor bar.

## Version 0.2.0

### 1. Added "Run ODE File" Button  

- A new button has been added to run `xppaut <current ode file>` directly from the editor.  
- The button features a play icon using VS Code's built-in Codicons for intuitive usability.  
- A configuration setting has been introduced to allow users to customize the run command.  
- The command execution now uses the configured command, providing flexibility for different workflows.

### 2. Implemented "Extract Variable" Feature  

- This feature simplifies code refactoring by allowing users to extract variables from their code with ease.

### 3. Bug Fixes  

- Removed `e` from the constant and reserved word list.

---

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

---

## Version 0.0.1

- Support for `.inc` files.
- Highlight missing reserved words like `done`, `include`.
- Fix multi-line commenting.

---

## Features Added by Joe-McCann

- Recognizes reserved mathematical functions in ODE files.
- Highlights function derivatives at the start of lines.
- Highlights comments to improve readability.
- Works with any theme that uses normal scope systems (pretty much all of them).

---

## Diagnostics

The extension checks each `.ode`/`.inc` file as you type and reports:

- **Errors**: missing `done`, unbalanced brackets, reserved words used as names, duplicate or conflicting names, `@` options that XPP would silently ignore, `solv` lines with spaces around `=`, and a [sign where XPP allows none](#operator-precedence) (`2*-3`, `x^-2`), which stops the file loading; an `@` option XPP drops because it is not exactly `name=value`; and a [numeric `@` option whose value is not a plain number](#-option-values) (`@ total=2*3` is 2, not 6). XPP runs in those last two cases, but there is no legitimate reason to write either.
- **Warnings**: text after `done` (XPP stops reading there, so the samples keep notes and C source below it; it is shown dimmed), undefined names, unused parameters/fixed variables/functions (shown faded), initial conditions for names that are not state variables, lines XPP does not recognise and silently skips, unknown `@` option names, fixed variables named like a keyword (`p=1`), and a [comparison next to arithmetic](#operator-precedence) (`2*3<4` is `2*(3<4)`, `-1<0` is `-(1<0)`, `a<b<c` is `(a<b)<c`), which silently changes the result or the branch an `if` takes.
- **Information**: the two [`^` precedence surprises](#operator-precedence) — `2^3^2` is `(2^3)^2`, and `-2^2` is `-(2^2)`. Legal, and often intended, so they are not warnings.

Names defined in `#include`d files count as defined. Inside an `.inc` file the undefined-name check is off, because the including `.ode` file may define them.

<details>
<summary><strong>The XPP syntax rules behind these checks</strong></summary>

All of these were verified by running files through `xppaut` 8.0.

**How XPP decides what a line is**

| Line looks like | XPP reads it as |
|---|---|
| `word name ...` (a word, a **space**, then a name) | a declaration chosen by the first letters of `word` |
| `word=...` or `word = ...` | a fixed variable called `word`, whatever `word` is |
| `x'=`, `dx/dt=`, `x(t+1)=`, `x(t)=` | a state variable |
| `x(0)=` | an initial condition |
| `f(a,b)=` | a function |
| `!a=` | a derived parameter |
| `0=` | an algebraic condition |
| `@ ...` | options |
| `#...` or `"...` | a comment |
| a first word starting with `d` that is not followed by `=`, `'`, `(`, `[` or `/dt` (`done`, `d`, `done # notes`, even `done x=1`) | end of file, everything after it is ignored |
| anything else | **silently ignored** |

**Keyword prefixes.** Only the first letters of the keyword matter: `p`, `par`, `param`, `params` and `parameter` all declare parameters. Single letters work for `p`(ar), `i`(nit), `w`(iener), `n`(umber), `g`(lobal), `b`(dry), `v`(olt), `o`(ptions) and `d`(one); two letters are needed for `au`(x), `ma`(rkov), `ta`(ble), `se`(t), `so`(lv), `sp`(ecial), `ex`(port), `im`(port) and `on`(ly). The separator after the keyword must be a space; a tab makes XPP read `init<tab>x=5` as a fixed variable named `initx`.

**Keywords are not reserved names.** `p=1`, `par=1`, `done=1` and `dt=1` are all legal fixed variables, because the `=` directly after the word wins. The extension only warns about them because they are easy to misread. The names XPP really rejects are the builtin functions (`sin`, `heav`, `delay`, ...), `if`/`then`/`else`, `arg1`..`arg9`, `t`, `pi` and `set`.

**Where spaces around `=` matter.**

| Form | Spaces around `=` |
|---|---|
| `@ dt=0.1,total=100` | **not allowed**: `@ dt = 0.1` is silently ignored and the default is used |
| `solv y=-.5` | **not allowed**: XPP fails to load the file |
| `par a = 1`, `init x = 0`, `aux z = x`, `x' = -x`, `f(x) = 2*x`, `x(0) = 1`, `!a = b*2`, `0 = y-x`, `global 1 x-1 {x = 0}` | allowed |

**Lists.** `par` and `init` items may be separated by commas or by spaces (`par a=1  b=2`), and a parameter may be listed without a value (`par ind`, which gives it 0).

**Comments and `#`.** `#` starts a comment except inside braces, where it is the Volterra convolution operator: `y(t)=int{exp(-t)#x}`.

</details>

## Operator precedence

XPP's expression parser groups things differently from standard mathematical notation, and refuses
some expressions outright. None of this is a bug: it is long-standing XPPAUT behaviour that
existing models rely on, and neither the extension nor
[xppautX](https://github.com/MuhammadMoustafa/xppautX) changes it. The extension only makes it
visible.

Everything below was confirmed by compiling the expression with `add_expr()` and running it
through `evaluate()` in xppautX, and the "will not load" cases by running the file through
`xppautX -silent`.

**It all follows from one table.**

| priority | operators |
|---|---|
| 7 | `^`, `**`, and every comparison: `<` `>` `<=` `>=` `==` `!=` |
| 6 | `*`, `/`, `&`, and unary minus (a separate operator, `~`) |
| 4 | binary `+`, `-`, `\|` |

So comparisons bind tighter than **all** arithmetic, which is the opposite of nearly every other
language, and unary minus binds more weakly than both `^` and the comparisons.

| you write | XPP reads it as | value | reported as |
|---|---|---|---|
| `2^3^2` | `(2^3)^2` | **64** (standard notation means 512) | information |
| `-2^2` | `-(2^2)` | **-4** (not 4) | information |
| `2*3<4` | `2*(3<4)` | **2** (not 0) | warning |
| `1+2<3+4` | `1+(2<3)+4` | **6** (not 1) | warning |
| `-1<0` | `-(1<0)` | **-0, i.e. false** (not true) | warning |
| `a<b<c` | `(a<b)<c` | **`3<2<1` is true** | warning |
| `2*-3` | — | **the file does not load** | error |

### 1. `^` groups to the left

`2^3^2^2` is `((2^3)^2)^2` = 4096. `**` is the same operator, so `2**3**2` is 64 too.

```
x'=-a*x^2^3        # XPP: (x^2)^3, i.e. x^6
x'=-a*(x^2)^3      # the same thing, written so it cannot be misread
x'=-a*x^(2^3)      # what standard notation would have meant: x^8
```

### 2. Unary minus binds more weakly than `^`

This is usually what you wanted anyway, which is why it is only an information message:

```
aux e=-x^2         # -(x^2): negative for every x  -- and normally what you meant
aux e=(-x)^2       # x^2: positive for every x
```

It applies to scientific notation as well: `-3E-5^2` is `-(3E-5^2)` = -9e-10. Note that the minus
inside `1e-3` belongs to the number, not to an operator, so `1e-3^2` is `(1e-3)^2` = 1e-6.

### 3. Comparisons bind tighter than arithmetic

This is the one that quietly ruins results, so it is a warning. XPP evaluates the comparison first
and then does the arithmetic on its `0` or `1`:

```
2*3<4              # XPP: 2*(3<4) = 2      -- not (2*3)<4 = 0
3-1<2              # XPP: 3-(1<2) = 2      -- not (3-1)<2 = 0
1+2<3+4            # XPP: 1+(2<3)+4 = 6    -- not (1+2)<(3+4) = 1
1/2<1              # XPP: 1/(2<1) -- a division by zero
(2*3)<4            # bracket what you want compared
```

A leading sign is the same rule, and it flips `if` branches silently:

```
f(t)=if(-t<0)then(a)else(b)     # XPP: if(-(t<0)) -- always -0, i.e. always the else branch
f(t)=if((-t)<0)then(a)else(b)   # what you meant
```

`-1<0` is `-(1<0)` = -0, which is **false** even though -1 really is less than 0; and `-1>=0` is
`-(1>=0)` = -1, which is **true** (any non-zero value is). Operators weaker than a comparison need
no brackets: `1<2&3<4` is `(1<2)&(3<4)`, and `2^2<3` is `(2^2)<3`, both as expected.

### 4. A sign is only allowed at the start, after `(` or after `,`

Anywhere else XPP rejects the expression and the file does not load at all (`ERROR compiling X'`),
so the extension reports it as an error:

```
x'=2*-3            # rejected -- write 2*(-3)
x'=x^-2            # rejected -- write x^(-2)
x'=a+-b            # rejected -- write a+(-b)
f(t)=if(t<-1.3)... # rejected -- write if(t<(-1.3))
x'=+2*a            # rejected -- XPP has no unary "+" at all, not even as "(+2)"
x'=-3E-5*a         # fine: the sign starts the expression
par a=-3E-5        # fine: a declaration value is a plain number, not an expression
```

### 5. `a<b<c` does not mean what it says

Comparisons group to the left, so `a<b<c` is `(a<b)<c` — the second comparison tests the first
one's `0` or `1` against `c`:

```
0<x<1              # XPP: (0<x)<1 -- true only when x is NOT above 0
(0<x)&(x<1)        # what you meant
```

`3<2<1` is `(3<2)<1` = `0<1` = **1, true**, although neither half holds.

## `@` option values

An `@` line is not made of expressions. XPP splits it on commas **and spaces** — `@ dt=.05
meth=cvode total=100` sets all three — and every piece must be exactly `name=value`. Numeric
values are read with `atof()`, which stops at the first character that cannot be part of a number
and never reports an error:

| you write | XPP uses | |
|---|---|---|
| `@ total=2*3` | `2` | not 6 — `@` values are not expressions |
| `@ total=4abc` | `4` | |
| `@ total=(4)` | `0` | `atof` finds no number to start with |
| `@ total=` | *default* | the option is dropped entirely |
| `@ total= 4` | *default* | the value was split off, so the piece is not `name=value` |
| `@ total = 4` | *default* | reads as the three unrelated words `total`, `=`, `4` |
| `@ t0=-5` | `-5` | negative values are fine |
| `@ total=1e1` | `10` | as is scientific notation |

Work the value out yourself, or put it in a `par` and use that in your equations. Options that
take a name, a file or a keyword (`meth=cvode`, `xp=x`, `output=out.dat`) are left alone.

### Settings

The error is always reported, like the other things XPP rejects. The advisory findings have one
setting each, because they do not deserve the same volume:

```jsonc
// .vscode/settings.json -- "warning", "information", "hint" or "off"
"xpp-ode.precedence.power": "information",   // 2^3^2 and -2^2
"xpp-ode.precedence.comparison": "warning"   // 2*3<4, 1+2<3+4, -1<0, a<b<c
```

Hovering over `^`, `**` or any comparison shows the same summary.

## Custom colours for variables and parameters

Give any name in your models its own look, independent of the theme: the membrane voltage always red, every parameter bold green, builtins italic, one variable in a box. The colours follow the parser, so a parameter is coloured everywhere it is used, not only on its `par` line.

### Where to put the configuration

| Place | Applies to | How |
|---|---|---|
| `.xppcolors.json` in a folder | every `.ode`/`.inc` file in that folder and its subfolders | create the file; a file in a subfolder overrides one in a parent folder, key by key |
| `xpp-ode.identifierColors` in `.vscode/settings.json` | the whole workspace | Settings > search "XPP-ODE" > edit in settings.json |
| `xpp-ode.identifierColors` in user settings | every workspace | same |

Both places take the same object. Files override the setting, key by key. Changes apply immediately.

### A complete example

A `.xppcolors.json` in a folder, applied to every `.ode`/`.inc` file in that folder and its subfolders:

```json
{
    "@states":     "#ff7b72",
    "@parameters": { "color": "#7ee787", "fontWeight": "bold" },
    "@fixed":      { "color": "#d2a8ff" },
    "@builtins":   { "fontStyle": "italic" },
    "@options":    { "opacity": 0.6 },

    "v":    { "color": "#ffffff", "borderColor": "#ff7b72", "borderRadius": "3px" },
    "g_*":  { "textDecoration": "underline" },
    "iapp": { "light": { "color": "#a00000" }, "dark": { "color": "#ff8888" } }
}
```

Reading it: state variables are salmon and parameters bold green everywhere they appear. `v` is white in a salmon box, because an exact name wins over its group. Every name starting with `g_` (`g_na`, `g_k`, `g_l`) is underlined in the theme's colour, because a wildcard wins over its group and replaces it entirely. `iapp` is dark red on light themes and pale red on dark ones. Option names on `@` lines are faded.

### Keys

| Key | Meaning | Example |
|---|---|---|
| a name | that identifier, case-insensitive; an array name also covers its members | `"v"`, `"gsyn"`, `"u"` (covers `u[j]`, `u[0..9]`, `u0`...`u9`) |
| a name with `*` | every identifier matching the pattern (`*` = any letters, digits or `_`) | `"v_*"`, `"*_syn"`, `"u*x"` |
| `@group` | a whole category, resolved by the parser | `"@states"`, `"@parameters"` |

Available groups:

| Group | Contains |
|---|---|
| `@states` | state variables: `x'=`, `dx/dt=`, `x(t+1)=`, `x(t)=`, `solv` |
| `@parameters` | `par` and `number` parameters, `!name=` derived parameters |
| `@fixed` | fixed variables `name=expression` |
| `@functions` | user functions `f(x)=` |
| `@aux` | `aux` quantities |
| `@wiener` | `wiener` variables |
| `@markov` | `markov` variables |
| `@tables` | `table` and `special` names |
| `@options` | option names on `@` lines (`dt`, `total`, `xp`, ...) |
| `@builtins` | builtin functions and constants (`sin`, `heav`, `t`, `pi`, ...) |
| `@keywords` | declaration keywords (`par`, `init`, `aux`, `done`, ...) |

Precedence, most specific first: exact name > wildcard (the last listed wins) > group. Comments and text after `done` are never coloured.

### Values

A value is either a hex colour string or a style object.

```json
"v": "#ff7b72"
"v": { "color": "#ff7b72", "fontWeight": "bold" }
```

| Property | Allowed values | Notes |
|---|---|---|
| `color` | `#rgb`, `#rrggbb`, `#rrggbbaa` | text colour |
| `backgroundColor` | hex colour | use `aa` for a translucent highlight, e.g. `#ffff0040` |
| `fontWeight` | `bold`, `normal` | |
| `fontStyle` | `italic`, `normal` | |
| `textDecoration` | `underline`, `line-through`, `overline`, `underline wavy`, `underline dotted`, `underline dashed` | |
| `opacity` | `0` to `1` | `0.5` fades the name |
| `borderColor` | hex colour | alone it draws a 1px solid box |
| `borderStyle` | `solid`, `dashed`, `dotted`, `double` | |
| `borderWidth` | length: `1px`, `0.1em` | |
| `borderRadius` | length: `3px` | rounded box corners |
| `light` | object with the properties above | applied only in light themes |
| `dark` | object with the properties above | applied only in dark themes |

Every VS Code theme declares itself as light, dark or high-contrast; `light`/`dark` entries are layered on top of the base properties for that kind of theme.

### Editing help

- Hex colours show a swatch in `.xppcolors.json` and inside the `xpp-ode.identifierColors` block of `settings.json`; click it for the colour picker.
- In `.xppcolors.json`, completion (`Ctrl+Space`, or typing `"` or `@`) offers the groups, every name declared in the folder's `.ode`/`.inc` files with its kind, and the style properties with their allowed values. Misspelled properties and invalid values are underlined.
- Entries the extension cannot use (unknown group, bad colour, ...) are skipped and reported once as a warning; the rest still apply.

## Future Work

- Handle active comments.
- `.ani` animation files: highlighting, and counting their references as uses of the `.ode` names.

---

## How to Customize the Run Command

The "Run ODE File" button (editor title bar of any `.ode` file) saves the file, opens an integrated terminal **in the file's folder**, and runs:

```
<xpp-ode.runCommand> "<file name>.ode"
```

It runs in the file's folder because xppaut looks for `#include`d files, `table` files and `dll_lib` libraries relative to the directory it is started from, and writes its output files there too.

The default command is `xppaut`, which works when xppaut is on your `PATH`. To change it: Settings (`Ctrl + ,` / `Cmd + ,`) > search "XPP-ODE" > **Run Command**. Typical values:

| Setup | Run Command |
|---|---|
| Linux, xppaut installed from the package manager or `make install` | `xppaut` |
| macOS with XQuartz, xppaut not on the PATH | `/usr/local/bin/xppaut` (or wherever you installed it) |
| Windows, xppaut installed inside WSL (with WSLg or an X server) | `wsl xppaut` |
| Windows, the Cygwin build from `xppwin.zip` | `C:\xppall\xppaut.exe` (see below) |
| Extra options for every run | `xppaut -xorfix`, `xppaut -silent`, ... |

Since only the file name is passed, `wsl xppaut` works without translating Windows paths: WSL starts in the same folder.

The setting can be set per workspace (`.vscode/settings.json`), so a project can carry its own command.

### Windows with the Cygwin build

The Windows `xppaut.exe` is an X11 program. It needs two things, or it exits with "Failed to open X-Display":

1. **An X server running**, such as [Xming](https://sourceforge.net/projects/xming/) or [VcXsrv](https://sourceforge.net/projects/vcxsrv/). It sits in the tray once started.
2. **The `DISPLAY` variable** telling xppaut where that server is. Starting the server does not set it; the `xpp.bat` shipped with xppaut sets `DISPLAY=127.0.0.1:0.0` for this reason.

The extension handles both:

| Setting | Default | Effect |
|---|---|---|
| `xpp-ode.runCommand` | `xppaut` | set to `C:\xppall\xppaut.exe` (or wherever you unzipped `xppall`; it does not have to be `C:\`) |
| `xpp-ode.display` | `127.0.0.1:0.0` | given to xppaut as `DISPLAY` when the variable is not already set; change it only if your server uses another display number |
| `xpp-ode.xServer` | empty | full command line of the X server to start automatically when it is not running, e.g. `"C:\Program Files (x86)\Xming\Xming.exe" :0 -multiwindow -clipboard`; leave empty to start it yourself |

Before each run the extension checks whether a server is listening on the display. If none is and `xpp-ode.xServer` is set, it starts the server and waits for it; otherwise it shows a warning naming the address and the fix, and still runs xppaut so you see its own message too.

Do not chain the server into the run command (`xming && xppaut`): `&&` waits for the first program to exit, and an X server never exits.

A complete Windows `.vscode/settings.json`:

```json
{
    "xpp-ode.runCommand": "C:\\xppall\\xppaut.exe",
    "xpp-ode.xServer": "\"C:\\Program Files (x86)\\Xming\\Xming.exe\" :0 -multiwindow -clipboard"
}
```
