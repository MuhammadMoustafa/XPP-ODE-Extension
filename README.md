# XPP - VSCode Extension for XPPAUT Files

This repository is a fork of [Joe-McCann's XPP-ODE-Extension repo](https://github.com/Joe-McCann/XPP-ODE-Extension).

If you encounter any issues or have feature requests, feel free to open an issue or [email me](mailto:muhammadmoustafa22@gmail.com).  
Logo designed by: [Manar Moustafa](mailto:manarmoustafa246@gmail.com).

---

## 🚀 How to Customize the Run Command

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

---

## Version 0.2.0 Release Notes

We’re excited to introduce new features and improvements in version 0.2.0 of our VS Code extension! A special thanks to **Nianqi Deng** for suggesting the "Run Button" feature—your feedback is invaluable!

### New Features

#### 1. Added "Run ODE File" Button  

- A new button has been added to run `xppaut <current ode file>` directly from the editor.  
- The button features a play icon using VS Code's built-in Codicons for intuitive usability.  
- A configuration setting has been introduced to allow users to customize the run command.  
- The command execution now uses the configured command, providing flexibility for different workflows.

#### 2. Implemented "Extract Variable" Feature  

- This feature simplifies code refactoring by allowing users to extract variables from their code with ease.

#### 3. Bug Fixes  

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

## Future Work

- Add all XPPAUT and AUTO option keywords.
- Detect undefined variables.
- Detect unused variables and gray them out.
- Handle active comments.
- Limit renaming of function parameters to the function's scope.
