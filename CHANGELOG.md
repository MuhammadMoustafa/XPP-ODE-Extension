# Change Log

All notable changes to this extension will be documented in this file.

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
- Limit renaming of function parameters to the function's scope
