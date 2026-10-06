# Editors are prepared before capture. Visible edits use mouse placement, then typing.
Pause 2000
# Last line inside "variables" (2 = its opening line). New rules are always appended after it.
$script:lastLine = 2

function SaveDemoSettings {
    Key '^s' 600
    $saved = Get-Content -LiteralPath (Join-Path $work '.xppsettings.json') -Raw | ConvertFrom-Json -AsHashtable
    if ($saved.Count -ne 1 -or -not $saved.ContainsKey('variables') -or
        $saved.variables -isnot [System.Collections.IDictionary]) {
        throw 'Recording stopped: settings must contain one variables object, not flat rules'
    }
}

# Mouse to the end of $line, add the comma when a sibling is already there, Enter for a new line.
# autoIndent is "keep": the new line inherits the indent of $line.
function NewLineAfter([int]$line, [bool]$comma) {
    PlaceLineEnd $line -Settings
    if ($comma) { Burst ',' }
    Key '{ENTER}' 400
}

function AddColor([string]$name, [string]$color) {
    $first = $script:lastLine -eq 2
    NewLineAfter $script:lastLine (-not $first)
    if ($first) { Key '{TAB}' 200 }          # one level inside "variables"
    $script:lastLine++
    Burst ('"' + $name + '": "' + $color + '"')
    Key '{ESC}' 200                          # close the value suggestion before the next click
    SaveDemoSettings; Pause 2500
}

# Typed the way a person writes JSON: {} first, Enter splits the braces, a second Enter puts an
# empty line between them, Tab indents it, then one "key": value per line.
function AddObject([string]$name, [System.Collections.IDictionary]$properties) {
    $first = $script:lastLine -eq 2
    NewLineAfter $script:lastLine (-not $first)
    if ($first) { Key '{TAB}' 200 }
    $open = $script:lastLine + 1
    Burst ('"' + $name + '": {}'); Pause 700
    PlaceLineEnd $open -Settings
    Key '{LEFT}' 200                         # between { and }
    Key '{ENTER}' 600                        # { and } on their own lines, } keeps the indent
    PlaceLineEnd $open -Settings
    Key '{ENTER}' 600                        # the empty line between the braces
    Key '{TAB}' 400                          # one level inside the object

    $line = $open + 1
    $firstProperty = $true
    foreach ($property in $properties.GetEnumerator()) {
        if (-not $firstProperty) {
            PlaceLineEnd $line -Settings
            Burst ','; Key '{ENTER}' 400     # keeps the indent of the line above
            $line++
        }
        Burst ('"' + $property.Key + '": ' + (ConvertTo-Json -InputObject $property.Value -Compress))
        Key '{ESC}' 200                      # close the value suggestion before the next click
        Pause 600
        $firstProperty = $false
    }
    $script:lastLine = $line + 1             # the closing brace
    SaveDemoSettings; Pause 2500
}

# Model lines move as comments are inserted above them: ML maps a line of the starting model to now.
$script:insertedAbove = New-Object System.Collections.ArrayList
function ML([int]$original) { $original + @($script:insertedAbove | Where-Object { $_ -le $original }).Count }

# A comment on its own line above original line $p (after any comments already inserted there).
# Returns the new comment's line.
function InsertAbove([int]$p, [string]$text) {
    ClickEnd ((ML $p) - 1)
    Burst ("`n# " + $text)
    [void]$script:insertedAbove.Add($p)
    Key '^s' 600; Pause 900
    (ML $p) - 1
}

# Applies the quick fix of the error under the pointer: the comment moves to $count lines above its
# declaration. The pointer is already on the error, so a click puts the caret there.
function FixHashComment([int]$p, [int]$count) {
    Click; Key '^.' 1200; Key '{ENTER}' 1800
    1..$count | ForEach-Object { [void]$script:insertedAbove.Add($p) }
}

# A comment after the code of original line $p
function AppendInline([int]$p, [string]$text) {
    ClickEnd (ML $p)
    Burst ('   # ' + $text)
    Key '^s' 600; Pause 900
}

# Adds one more key to the object that was typed last
function AddProperty([string]$key, [string]$value) {
    PlaceLineEnd ($script:lastLine - 1) -Settings
    Burst ','; Key '{ENTER}' 400
    Burst ('"' + $key + '": ' + (ConvertTo-Json -InputObject $value -Compress))
    Key '{ESC}' 200
    $script:lastLine++
    SaveDemoSettings; Pause 1500
}

# Hover a name of the starting model's line $p at column $col
function HoverName([int]$p, [int]$col, [int]$ms = 3000) { HoverAt (ML $p) $col $ms }

# -Part 1|2|3 records one third (0 = all): colours, comments, arrays. Parts 2 and 3 start from the files
# the previous part leaves (scenarios/colors-descriptions.partN.*), so their line bookkeeping starts there too.
if ($Part -eq 3) {
    $script:lastLine = 13                                  # the settings file after part 1: "gsyn" ends on line 13
    foreach ($above in 3, 3, 5) { [void]$script:insertedAbove.Add($above) }   # gca and the shared gk/gl above line 3; iapp above 5
}

if ($Part -eq 0 -or $Part -eq 1) {
    # 1. Colours
    AddColor '@states' '#ff7b72'
    AddObject '@parameters' ([ordered]@{
        color = '#7ee787'
        fontWeight = 'bold'
    })
    AddColor 'g*' '#d2a8ff'

    # 2. A description in .xppsettings.json: nothing before, the text after
    AddObject 'gsyn' ([ordered]@{
        color = '#79c0ff'
        backgroundColor = '#193549'
    })
    HoverName 6 23 2500                # gsyn: no description yet
    AddProperty 'description' 'Coupling strength (mS/cm^2)'
    HoverName 6 23 4000                # gsyn: described by the settings file
}

if ($Part -eq 0 -or $Part -eq 2) {
    # 3. Comments in the model, each one hovered before and after
    HoverName 3 6 2500                 # gca: nothing yet
    InsertAbove 3 'gca: maximal Ca conductance (mS/cm^2)' | Out-Null
    HoverName 3 6 3500                 # gca: the comment above its line

    HoverName 5 6 2500                 # iapp: nothing yet
    # The tempting way: a comment after the code. XPPAUT reads its words as names, so it is an error.
    AppendInline 5 'applied current (uA/cm^2)'
    HoverName 5 17 7000                # the error, with the link to the XPPAUT issue
    FixHashComment 5 1                   # quick fix: the comment moves above, as "iapp: ..."
    HoverName 5 6 3500                 # iapp: described from the line above

    CloseHover                         # park the pointer in empty space so iapp's hover is gone
    HoverName 3 15 2000                # gk and gl share a line: both before ...
    HoverName 3 21 2500
    AppendInline 3 'gk: maximal K conductance; gl: leak conductance'
    HoverName 3 30 4000                # the same error
    FixHashComment 3 1                   # one shared line: "gk: ...; gl: ..."
    HoverName 3 15 3000                # ... and both after, each with its own text
    HoverName 3 21 3500
}

if ($Part -eq 0 -or $Part -eq 3) {
    # 4. An array of ten cells. {j} in a description is the member's number.
    AddColor 'vm' '#ffa657'
    HoverName 18 16 2500               # vm3: nothing yet
    InsertAbove 16 'vm: membrane voltage of cell {j} (mV)' | Out-Null
    HoverName 18 16 3500               # vm3: "cell 3"

    # a range of members
    InsertAbove 16 'vm[1..3]: excitatory cell {j}' | Out-Null
    HoverName 18 8 3000                # vm1: the first of the range, the range's text then the array's, both reading 1
    HoverName 18 16 4000               # vm3: the last of the range, both reading 3

    # a single member and a range in one key
    InsertAbove 16 'vm[5, 7..9]: inhibitory cell {j}' | Out-Null
    HoverName 18 24 3500               # vm5: the single member
    HoverName 18 32 3000               # vm7: the first of the range 7..9
    HoverName 18 40 3500               # vm9: the last of the range

    # the same keys in .xppsettings.json
    AddObject 'vm[9, 10]' ([ordered]@{
        color = '#f2cc60'
        description = 'Output cell {j}'
    })
    HoverName 18 40 4500               # vm9: the comment and the settings entry, each reading 9
    HoverName 18 44 4000               # vm10: the settings entry and the array's comment, reading 10

    # 5. Overlapping descriptions of array members just layer: vm3 gets one more, and no warning.
    InsertAbove 16 'vm[3, 4]: pacemaker cell {j}' | Out-Null
    HoverName 18 16 5000               # vm3: the array, the range 1..3 and the pair 3, 4, each reading 3

    # A variable described twice is a mistake: the earlier description is flagged, the quick fix removes it.
    $glLine = (ML 3) - 1               # the shared "gk: ...; gl: ..." line, the last comment above line 3
    InsertAbove 3 'gl: leak conductance, mS/cm^2' | Out-Null
    Pause 900
    HoverAt $glLine 36 3500            # the flagged "gl: ..." part of the shared line, also listed in Problems
    Click; Key '^.' 1200; Key '{ENTER}' 1800   # the fix removes that part only, the line stays
    HoverName 3 21 3500                # gl: one description, the later one
}

CloseHover
Pause 3500
