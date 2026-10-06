# Colours and descriptions in one walkthrough

Record with the current extension and `.xppsettings.json`. Use the same Morris-Lecar
model throughout so the viewer sees each rule affect the names they already know.
Keep the model on the left and settings on the right.
The combined scenario defaults to full screen and a 16 px editor font. The side bar
is hidden and the Problems panel stays open, so warnings are visible. The pointer
glides to each target; Go to Line is never used. Indentation comes from `autoIndent: keep` and Tab, never typed spaces.
Every entry is nested under `variables`. Objects are typed the way a person writes
them: `{}`, Enter to split the braces, an empty line between them, its indent, then
one `"key": value` per line. A comma is added to the previous sibling only when the
next one starts; no trailing comma is left on the last property or rule.
Each completed stage is saved and the actual saved JSON is checked. Autosave is
enabled, as in the normal editing workflow. Briefly incomplete expressions while
typing may be saved; completed scenes must show valid JSON.

## Recording

The maintainer starts the recording, following the repository's `CLAUDE.md` rule.
The isolated demo profile keeps the version it was set up with; refresh it from the current
0.4.3 checkout before recording:

```powershell
pwsh demo/setup.ps1
pwsh demo/record.ps1 -Scenario colors-descriptions -Mp4
```

Outputs: `images/colors-descriptions-demo.gif` and
`images/colors-descriptions-demo.mp4`. Existing recordings are preserved.
The recorder moves the pointer and types into its isolated VS Code window; leave
the mouse and keyboard alone during capture. It aborts if the window loses focus.

## Three parts

`-Part 1|2|3` records one third (no `-Part`: all of it in one go, for a rehearsal). The first three GIFs were cut from one full recording's frames (`node demo/encode.mjs run/frames out.gif 1600 FROM TO`: parts at frames 0-373, 374-829 and 830-end), not recorded separately. Parts 2 and 3
start from the files the part before leaves, `scenarios/colors-descriptions.partN.lecar.ode` and
`.partN.xppsettings.json`, so each is a short GIF beside its README section:

| Part | Scenes | GIF |
|---|---|---|
| 1 | Open settings, States, Parameters, Wildcard, Settings description | `images/colors-demo.gif` |
| 2 | Comment above, Comment after (the pitfall), Shared line | `images/comments-demo.gif` |
| 3 | Array, Range, Single and range, Settings keys, Layering, the `gl` override | `images/arrays-demo.gif` |

If a scene changes the model, update the start files of the parts after it (and `insertedAbove`
at the top of the scenario) to match.

## On-screen explanations

These are proposed captions or voice-over lines, not captions automatically added
by the recorder. Add them after capture; keep code and hover text unobstructed.
The model starts with no comments (`scenarios/colors-descriptions.lecar.ode`); every
description is hovered before (nothing) and after it is written.

| Scene | Explanation | What to look for |
|---|---|---|
| Open settings | “One settings file for colours and descriptions, shared by models in this folder.” | `.xppsettings.json` has a `"variables"` object. |
| States | “A group rule colours every state variable.” | `"@states"` changes both voltage and recovery states. |
| Parameters | “Use a colour string, or an object for colour and style.” | Parameters become green and bold. |
| Wildcard | “`g*` matches names beginning with g. Wildcards override group rules.” | `gca`, `gk`, `gl` and `gsyn` become purple. |
| Settings description | “Add a `description` next to the colour.” | Hover `gsyn`: nothing, then the text, tagged `.xppsettings.json: gsyn`. Every hover reads the same way: name, kind and `file:line` of the declaration, then each description with its `file:line` in grey. |
| Comment above | “A `name: text` comment above the line describes the name.” | Hover `gca`: nothing, then the comment. |
| Comment after (the pitfall) | “The obvious way, a comment after `par iapp=90`, is an error: XPPAUT reads its words as names.” | Problems shows the error; hover it for the message and the link to the [XPPAUT issue](https://github.com/Ermentrout/xppaut/issues/11). The quick fix moves the comment above as `# iapp: ...`, then hover `iapp`. |
| Shared line | “Several names on one declaration: one `name: text` comment each (or `name: text; name: text` on one line).” | Hover `gk` and `gl` before (nothing); the same error; the quick fix writes one shared line `# gk: ...; gl: ...`; each then shows its own text. |
| Array | “`{j}` in a description is the member's number.” | Hover `vm3`: nothing, then “membrane voltage of cell 3”. |
| Range | “A range key describes only those members.” | `vm[1..3]`: hover `vm2` shows “excitatory cell 2”, then the array's text also reading 2. |
| Single and range | “A key can mix single members and ranges.” | `vm[5, 7..9]`: hover `vm5` and `vm8`, each reading its own number. |
| Settings keys | “The same keys work in `.xppsettings.json`, colours and descriptions.” | `"vm[9, 10]"` turns `vm9` and `vm10` yellow; hover `vm9` (comment and settings, both 9) and `vm10` (settings only, 10). |
| Layering and duplicates | “Overlapping descriptions of array members just layer. A variable described twice is flagged, and the quick fix removes the earlier one.” | `vm3` shows the array, the range and the pair, with no warning. A second `# gl:` line flags the `gl:` part of the shared line in Problems; the fix removes only that part and `gl` shows the later text. |

## Review before using the video

- Confirm the installed demo extension is 0.4.3 after setup.
- Rehearse the whole scenario without capturing: `pwsh demo/record.ps1 -Scenario colors-descriptions -Rehearse`.
  It saves a screenshot at every pause to `demo/run/rehearsal/` and the final settings file; review those before recording.
  Hovers: `gsyn`, `gca`, `iapp`, `gk`/`gl`, `vm1`, `vm4`, then `vm2` after the quick fix; each before and after its description.
- Confirm each colour change is visible and all settings snippets finish as valid JSON.
- Confirm mouse targets reach `gsyn`, `iapp`, `gk` and `vm4`, and their hovers are readable.
- Confirm the final view has no accidental JSON diagnostics or open completion menus.
- Crop empty space and enlarge code if needed for viewing on a phone.
- Use the full walkthrough for the README; make a shorter captioned cut for LinkedIn.

Rehearsed and recorded on 2026-10-06 with the 0.4.3 build; the rehearsal screenshots and the
recording's frames were reviewed (one-line quick fix, array hovers, layering, the `gl` override).
