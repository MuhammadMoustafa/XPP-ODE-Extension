# XPP - VSCode Extension for XPPAUT Files

This repository is a fork of [Joe-McCann's XPP-ODE-Extension repo](https://github.com/Joe-McCann/XPP-ODE-Extension).

If you encounter any issues or have feature requests, feel free to open an issue or [email me](mailto:muhammadmoustafa22@gmail.com).  
Logo designed by: [Manar Moustafa](mailto:manarmoustafa246@gmail.com).

To learn how to customize the xppaut start command please refer to [How to Customize the Run Command](#how-to-customize-the-run-command) section.

---

## Thank you list

- **Nianqi Deng** for suggesting the "Run Button"

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

- **Errors**: missing `done`, unbalanced brackets, reserved words used as names, duplicate or conflicting names, `@` options that XPP would silently ignore, and `solv` lines with spaces around `=`.
- **Warnings**: text after `done` (XPP stops reading there, so the samples keep notes and C source below it; it is shown dimmed), undefined names, unused parameters/fixed variables/functions (shown faded), initial conditions for names that are not state variables, lines XPP does not recognise and silently skips, unknown `@` option names, and fixed variables named like a keyword (`p=1`).

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

## Custom colours for variables and parameters

You can give any variable, parameter or function its own colour, independent of the theme, so that (for example) the membrane voltage is always red and the coupling parameter always bold green.

**Per workspace or user: the `xpp-ode.identifierColors` setting.** Put it in `.vscode/settings.json` to apply it to every `.ode`/`.inc` file in the workspace:

```json
"xpp-ode.identifierColors": {
    "v": "#ff5555",
    "gsyn": { "color": "#55ff55", "fontWeight": "bold" },
    "iapp": { "color": "#8888ff", "fontStyle": "italic" }
}
```

**Per folder: a `.xppcolors.json` file.** Create a file with the same content (just the object) in a folder, and it applies to every `.ode`/`.inc` file in that folder and its subfolders:

```json
{
    "v": "#ff5555",
    "gsyn": { "color": "#55ff55", "fontWeight": "bold" }
}
```

Rules:

- Names are case-insensitive, like in XPP. `dv/dt`, `v'`, `v(0)` and every use of `v` in expressions are coloured; comments and text after `done` are not.
- A value is either a hex colour (`#rgb`, `#rrggbb` or `#rrggbbaa`) or an object with any of:
  - `color`, `backgroundColor`: hex colours;
  - `fontWeight`: `bold`; `fontStyle`: `italic`;
  - `textDecoration`: CSS such as `underline`, `line-through` or `underline wavy`;
  - `opacity`: `0` to `1`;
  - `borderColor`: hex colour (alone it gives a 1px solid box); `borderStyle`: `solid`, `dashed`, `dotted` or `double`; `borderWidth` and `borderRadius`: lengths such as `1px`;
  - `light` / `dark`: an object with the same properties, applied only in light or dark themes (every VS Code theme declares itself as light, dark or high-contrast), e.g. `{ "light": { "color": "#a00" }, "dark": { "color": "#f88" } }`.
- A key starting with `@` styles a whole category, resolved by the parser, so a parameter is coloured everywhere it is used, not only on its `par` line: `@states` (also `solv`), `@parameters` (`par`, `number`, `!name=`), `@fixed`, `@functions`, `@aux`, `@wiener`, `@markov`, `@tables` (also `special`), `@options` (names on `@` lines), `@builtins` (`sin`, `heav`, `t`, `pi`, ...) and `@keywords` (`par`, `init`, `done`, ...). A name with its own entry always wins over its group.

```json
{
    "@states": "#ff5555",
    "@parameters": { "color": "#55ff55", "fontWeight": "bold" },
    "@builtins": { "fontStyle": "italic" },
    "v": { "borderColor": "#ff5555", "borderRadius": "3px" }
}
```
- When both exist, a `.xppcolors.json` file overrides the setting, and a file in a subfolder overrides one in a parent folder, name by name.
- Invalid entries are skipped and reported once as a warning.
- A key may contain `*` as a wildcard: `"v_*"` styles `v_na`, `v_k`, ...; `"*_syn"` styles `g_syn` and `e_syn`. An exact name wins over a wildcard, a wildcard over a group, and among wildcards the last one listed wins.
- An array name covers its members: `"u"` styles `u[j]`, `u[0..9]` and `u0`...`u9`.
- Hex colours in `.xppcolors.json`, and inside the `xpp-ode.identifierColors` block of `settings.json`, show a colour swatch; click it to open VS Code's colour picker.
- While editing `.xppcolors.json`, completion (Ctrl+Space) suggests the `@groups`, every name declared in the folder's `.ode`/`.inc` files, and the style properties and their values; typos are underlined.

## Future Work

- Handle active comments.
- `.ani` animation files: highlighting, and counting their references as uses of the `.ode` names.

---

## How to Customize the Run Command

If you’d like to change the default `xppaut` command to a custom command or specify the full path to the `xppaut` executable, follow these steps:

1. **Open VS Code Settings**  
   - You can access the settings by clicking on the gear icon in the lower-left corner of the VS Code window or by pressing `Ctrl + ,` (Cmd + , on macOS).

2. **Search for "XPP-ODE"**  
   - In the settings search bar, type "XPP-ODE" to locate the extension-specific settings.

3. **Modify the "Run Command" Setting**  
   - Find the **"Run Command"** setting and update its value.  
   - By default, the value is set to `xppaut`. You can change it to:
     - A full path to the `xppaut` executable (e.g., `/usr/local/bin/xppaut`).
     - A completely different command if needed.

4. **Save Your Changes**  
   - Once you’ve updated the setting, the extension will use your custom command whenever you click the "Run ODE File" button.
