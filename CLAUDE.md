# XPP-ODE-Extension

VS Code extension for XPPAUT models (`.ode`, `.inc`), TypeScript. Published as
`MuhammadMoustafa.xpp`.

- Pure logic lives in `src/utils/*Core.ts` and is unit-tested (`test/*.test.ts`,
  mocha TDD UI); `src/diagnostics/*` and `src/providers/*` are thin vscode glue.
  Write the tests first.
- `src/utils/xppModel.ts` is the one parser (declarations, lines, expressions,
  includes, `\` continuations); checks read it, never re-parse lines.
- XPP behaviour is measured on xppautX (`C:\gitRepos\xppautX`, built in WSL;
  run a model with `xppautX model.ode -silent` and read `output.dat`), never
  guessed. Say in the commit or card what was measured.
- Versions: 0.4.x is plain XPPAUT support; everything xppautX-related (panel,
  `.odex`/`.recx`/`.snapx`, the xppautX name and logo) is 0.5.0, branch
  `xppautx`.
- User-facing text (README, CHANGELOG, diagnostic messages, hovers): plain,
  concrete, with the example and the value XPP gives.
- `demo/` records the README GIFs by driving the mouse and keyboard: only the
  maintainer starts a recording.

## Task agents

Work is run as a task board (docs/roadmap.md). An agent
(.claude/agents/task-easy, task, task-hard: the model and effort by
difficulty) implements one card in the worktree its brief names:

- Work only there, with every path in this file adapted to it; commit on
  its branch and stop. Never merge, push, touch the main branch, or write
  to GitHub.
- One operation, one module: before writing a helper, look for the module
  that owns that kind of operation and use or extend it there; never add a
  local copy. If the owning module is outside your card's files, say so in
  the report instead of copying it.
- Gates: the per-task tier below. Never run the heavy tier.
- Keep token use low: read the parts of files you need (grep, line
  ranges), pipe check output through tail/grep, never paste full logs.
- Leave no `until`/`while` sleep loops or background runs behind.
- Background tasks are registered: every background run (a command run in
  the background, a background agent, a server or program left running)
  gets a line in `C:\gitRepos\XPP-ODE-Extension\.claude\background-tasks.md`
  (the main checkout's, whatever worktree you are in; local, not committed)
  the moment it starts: its id, what it runs, where, who started it and who
  closes it. Whoever closes it stops it or confirms it ended, then deletes
  its line. Close your own before your final report and say the file
  holds none of your lines.
- Final report: at most 15 lines: what changed, gate results as counts,
  anything unfinished or doubtful.

The reviewer (the main session) reviews, refactors, merges, runs the
heavy tier, pushes when the maintainer says so, and then closes the
finished cards' issues with their commits. A new roadmap card gets its
GitHub issue at once.

Gates (run `npm install` once in a new worktree):
- Every task: `npx tsc -p ./` with no errors, `npm test` all passing
  (report the count), and for a new or changed check its diagnostics over
  `C:\gitRepos\xppautX\examples\ode\*.ode` (read-only) with no false
  positives.
- Every ~5 merged tasks, and before any push: `npx vsce package` (the
  `.vsix` stays small: no GIFs, MP4s, `demo/`, `.claude/`), install it in a
  clean profile and open a model (`code --user-data-dir <tmp>
  --extensions-dir <tmp> --install-extension xpp-*.vsix`), and the README
  links and images resolve.
