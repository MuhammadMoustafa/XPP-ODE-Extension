# Demo recorder

Records the README GIFs by driving a real VS Code with keystrokes. Windows only (PowerShell 7,
`System.Windows.Forms.SendKeys`); VS Code installed in `C:\Program Files\Microsoft VS Code`.

```powershell
pwsh demo/setup.ps1                                  # once, and after every extension change
pwsh demo/record.ps1 -Scenario descriptions -Mp4     # -> images/descriptions-demo.gif (+ .mp4)
pwsh demo/record.ps1 -Scenario math                  # -> images/math-demo.gif
pwsh demo/record.ps1 -Scenario math -DryRun          # just open the window: run/dryrun.png
```

- `setup.ps1` packages the extension from the repo and installs it into `run/ext`; the recording
  uses its own profile (`run/udd`, settings from `settings.json`), so your VS Code is untouched.
- Each run starts from a fresh copy of `workspace/`. A scenario (`scenarios/*.ps1`) is a list of
  `Key`, `TypeText`/`Burst`, `Pause` and mouse calls (`HoverAt`, `ClickEnd`, `SelectWord`, taking
  line and column); line numbers refer to the model as edited so far. The mouse helpers assume the
  model never wraps or scrolls, so keep its lines short.
- Don't touch the mouse or keyboard while it records (it moves your pointer): when the demo window
  loses focus the recording stops at once, without sending keys anywhere else.
- `capture.ps1` saves a frame every 120 ms with the pointer drawn in, `encode.mjs` builds the GIF
  (unchanged pixels are transparent, so it stays small), `to-mp4.mjs` the MP4 (git-ignored; the
  README uses the GIFs).
- Everything generated lives in `run/` and `node_modules/`, both git-ignored; the whole folder
  is left out of the published extension.
