# Roadmap

One row per card. Status: `blocked` (a blocker is not done), `ready`,
`in-progress`, `done`. A card records the maintainer's decisions with their
dates; its issue has the same text and every later decision as a comment.

| ID | Issue | Card | Blocked by | Status |
|----|-------|------|------------|--------|
| T1 | #1 | Checks for the .ode quirks xppautX measured (xppautX docs/odex-quirks.md): error for `!=`, `&&`, `\|\|`, a leading `!`; warning for `&`/`\|` beside arithmetic (`a\|b-c` is `(a\|b)-c`); error for an `if` not written `if(c)then(a)else(b)`; information for an operator after the else part; error for `init y=2*3` (atof: 2) and `init y=a` (0); warning for `y(0)=formula` (starts at 0, the formula is only delay history); warning for a literal `/0` (4.5e14). A hint for a function argument hiding a global was dropped (maintainer, 2026-09-28: plain scoping, noise). Measured on xppautX 2026-09-27. Running in the main checkout (started before the board). Done when tests pass and xppautX's examples give no false positives; README and CHANGELOG then updated by the coordinator. Review 2026-09-27: array `x[..](0)=` conditions are evaluated by XPP, so excluded | none | done |
| T2 | - | README restructured for the Marketplace: pitch, feature list, overview GIF, "What's new", one section per feature with its GIF first, reference in `<details>`, settings table, credits last; version history left to CHANGELOG.md (maintainer, 2026-09-27) | none | done |
| T3 | #2 | Release 0.4.1: commit the pending work, heavy gates, push (the GIFs load from GitHub), `vsce publish`. 0.4.1 is plain XPPAUT support, nothing xppautX (maintainer, 2026-09-27). Published 2026-09-28 | T1 | done |
| T4 | #3 | Rebase branch `xppautx` (0.5.0 work) onto master; conflicts expected in CHANGELOG, README, package.json, extension.ts | T3 | ready |
| T5 | #4 | 0.5.0 shown as xppautX: `displayName` xppautX, xppautX's logo as the icon, new description, logo credit updated; the ID `MuhammadMoustafa.xpp` and `xpp-ode.*` IDs kept (maintainer, 2026-09-27) | T4, final xppautX logo | blocked |
| T6 | #1 | `.odex` and `.incx` as a language with the same features as `.ode` (grammar: xppautX docs/odex.md; block comments `/* */` nesting, `#` line comments; .odex reserved words per #1's comments) | T4, odex.md approved | blocked |
| T7 | #1 | `.recx` recordings: highlight the header, the file sections, the JSON steps and the `#` notes; editable | T4 | blocked |
| T8 | #1 | `.snapx` sessions (a zip): open read-only, list the contents, show the text parts | T4 | blocked |
| T9 | #1 | Call `xppautX --check model.ode` (JSON diagnostics) and drop the extension's own copy of the rules | xppautX#123 | blocked |
| T10 | #1 | Checks for the .ode quirks xppautX's W79 found (issue #1, 2026-09-29): error for `table g @ file` (not implemented, load stops), a Markov cell without `}` (read past the line), a duplicate `markov` name (load stops); warning for `!d=` reading t, a variable or `ran`/`normal` (frozen at the run's start). Old-style models' aux count between loads is not a file check (xppautX keeps it). Measured on xppautX 2026-09-29. Ships in 0.4.2 (maintainer, 2026-09-29) | none | done |
| T11 | #5 | Release 0.4.2: T10's checks; commit, heavy gates, push, `vsce publish` (maintainer, 2026-09-29) | T10 | in-progress |
