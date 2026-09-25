# Ideas

Done: custom colours (0.4.0), undefined and unused names (0.4.0), operator precedence (0.4.1),
descriptions on hover (0.4.1, see below).

## Done: descriptions on hover (docstrings for XPP names)

Shipped in 0.4.1; the README section "Descriptions on hover" documents the final rules. Not done
from the design below: the value/definition in the hover, "shared by ..." wording, `"x[3..5]"` keys
in the JSON, and the open questions at the end.

Hovering a name shows what it is, like a Python docstring in VS Code:

```
gna — parameter, = 120   (lecar.ode:12)
Maximal sodium conductance (mS/cm^2)
```

Two sources, both optional:

1. **The model itself**: the comment on the declaration line, or the comment lines right above it.
   `par gna=120  # Maximal sodium conductance (mS/cm^2)`. Zero configuration, and the text travels
   with the `.ode` file like a docstring. Works across `#include`d files.
2. **`.xppcolors.json` / `xpp-ode.identifierColors`**: a `description` property in the style
   object, for folders of models that share names, or files the user cannot edit.
   `"gna": { "color": "#7ee787", "description": "Maximal sodium conductance (mS/cm^2)" }`.
   A string value stays a colour; an object may hold only `description`. Keeps one entry per
   name and reuses the key resolution; the file name is a misnomer but still fine.

Resolution, same rules as colours (exact > wildcard, last listed > group), but applied to
`description` on its own: a name's colour entry without a `description` does not hide a wildcard's
or group's `description`. Group descriptions are shown under the name's own (`@parameters`:
"Units: mS/cm^2 unless stated"). The model comment comes first, the JSON text after it.

The hover always shows the kind and the value/definition from the parser, even with no
description. Existing hovers (diagnostics, operator priority) stay; VS Code stacks them.

### Several names on one line

`par`, `number`, `init`, `aux`, `wiener`, ... accept several names, separated by commas or spaces.
Equations, fixed variables and functions are one per line.

1. One name on the line: the whole trailing comment is its description.
2. Several names: `name: text` pairs split the comment.
   `par gna=120, gk=36   # gna: max Na conductance; gk: max K conductance`
3. Comment lines right above the declaration, one `name: text` per line (easier for long lists).
4. Several names and a plain comment: shared by all of them; the hover says "shared by gna, gk".

### Arrays

The parser already records the array (`x`) and its members (`x1`..`x10`) as declarations, so a
key is checked with one lookup (a plain `x5` cannot coexist with the member `x5`: duplicate name).

| Key | Applies to |
|---|---|
| `x: text` | the array and every member without its own text |
| `x[3..5]: text` | members `x3`..`x5` (declaration range syntax) |
| `x[3,5]: text` | members `x3` and `x5`; lists and ranges mix: `x[1..3, 7, 9]` |
| `x5: text` | only `x5` |

Most specific wins: member > range/list > whole array.

### Conflicts

- **Layering** (different levels: `x` and `x7`; comment and JSON) is intended, so no warning.
  The hover shows every level, most specific first, each with its line (or file):
  ```
  x7 — state variable (array x[1..10])
  The pacemaker cell                         (line 4)
  Membrane voltage of cell j (mV)  — from x  (line 2)
  ```
- **Duplicates** (same level: `x7` both above and trailing; `x[1..3]` and `x[3,5]` both giving
  `x3`) are warnings on the losing text, "description of `x3` overridden by line 12", with a
  related-information link to the winner and a quick fix that removes the losing entry.
  The later one wins, as with colour wildcards. An array is one line, so per-member text goes
in the comment block above it:

```
# x: membrane voltage of cell j (mV)
# x[1..3]: excitatory cells
# x7: the pacemaker cell
x[1..10]'=-x[j]+i_syn[j]
```

A key that is not a declared name (`x11` when the array ends at 10) is a warning. In the JSON,
`"x7"`, `"x"` and `"x*"` already work; `"x[3..5]"` would be a new key form.

Open questions: `"` comment lines as well as `#`? Markdown in descriptions? Completion items
could show the same text.

## Other

- Handle active comments.
- `.ani` animation files: highlighting, and counting their references as uses of the `.ode` names.
