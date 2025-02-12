# Change Log

All notable changes to this extension will be documented in this file.

## Version 0.0.1

- Support for `.inc` files
- Highlight missing reserved words like `done` and `include`
- Fix multi-line commenting

## Version 0.1.0

- Fix commenting and uncommenting of `#done` and `#include`
- Check for unbalanced parentheses
- Recognize numbers with scientific notation (e) as numbers in the syntax highlighter
- Automatically add `done` and `#done` at the end of new `.ode` or `.inc` files
- Highlight all occurrences of a variable when hovering over it
- Rename variables and functions using the VS Code renaming shortcut (not yet implemented for `d<var>/dt` format)
- Highlight most common XPPAUT and AUTO option keywords
- Improve highlighting for functions and parameters

## Future Work

- Add all XPPAUT and AUTO option keywords
- Detect undefined variables
- Detect unused variables and gray them out
- Handle active comments
- Limit renaming of function parameters to the function's scope
