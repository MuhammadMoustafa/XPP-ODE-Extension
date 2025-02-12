# XPP - VSCode extension for XPPAUT files

## This repo is a fork for Joe-McCann XPP-ODE-Extension repo [Repo Link](https://github.com/Joe-McCann/XPP-ODE-Extension)

If you face any problems or have any additional features you want to add, you may open an issue or [email me](mailto:muhammadmoustafa22@gmail.com)  
Logo disgned by: [Manar Mosutafa](mailto:manarmoustafa246@gmail.com)

## New Features Added

## Version 0.0.1

- Support for inc files
- Highlight missing reserved words like "done, include"
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

## As well as the old features added by Joe-McCann

- Recognizes reserved mathematical functions in ODE files
- Highlights function derivatives at the start of lines
- Highlights comments to improve readability
- Works with any theme that uses normal scope systems (pretty much all of them)


## Future Work

- Add all XPPAUT and AUTO option keywords
- Detect undefined variables
- Detect unused variables and gray them out
- Handle active comments
- Limit renaming of function parameters to the function's scope