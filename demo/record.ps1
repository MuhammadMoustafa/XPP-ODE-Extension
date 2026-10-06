# Records one README demo: opens an isolated VS Code on a fresh copy of workspace/, plays
# scenarios/<Scenario>.ps1 with keystrokes and mouse moves while capture.ps1 grabs the window, then encodes
# ../images/<Scenario>-demo.gif (and .mp4 with -Mp4). Run setup.ps1 once before.
# -Rehearse plays the whole scenario without capturing or encoding and saves a screenshot at every
# pause into run/rehearsal/ (plus the final settings file), to review before a real recording.
# Do not touch the mouse or keyboard while it runs: if the demo window loses focus it aborts.
param([Parameter(Mandatory)][string]$Scenario, [switch]$DryRun, [switch]$Mp4,
      [switch]$FullScreen, [switch]$Rehearse, [int]$Part = 0, [int]$FontSize = 0, [switch]$KeyboardNavigation)
$ErrorActionPreference = 'Stop'
if ($Part -ne 0 -and ($Scenario -ne 'colors-descriptions' -or $Part -lt 1 -or $Part -gt 3)) { throw '-Part 1, 2 or 3 is for the colors-descriptions scenario' }
# The combined walkthrough uses full-screen framing and visible mouse placement.
$MouseNavigation = $Scenario -eq 'colors-descriptions'
if ($Scenario -eq 'colors-descriptions') {
    $FullScreen = $true
    if ($FontSize -eq 0) { $FontSize = 16 }   # leaves room for the open Problems panel without scrolling
}
if ($FontSize -ne 0 -and ($FontSize -lt 12 -or $FontSize -gt 36)) {
    throw 'FontSize must be between 12 and 36'
}
if ($FontSize -ne 0 -and $FontSize -ne 15 -and -not $KeyboardNavigation -and -not $MouseNavigation) {
    throw 'A changed font size requires -KeyboardNavigation (mouse coordinates assume size 15)'
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
}
"@
[U]::SetProcessDPIAware() | Out-Null

$root = $PSScriptRoot
$run = Join-Path $root 'run'
$udd = Join-Path $run 'udd'; $ext = Join-Path $run 'ext'; $work = Join-Path $run 'workspace'
$frames = Join-Path $run 'frames'; $stop = Join-Path $run 'stop.flag'
$scenarioFile = Join-Path $root "scenarios\$Scenario.ps1"
if (-not (Test-Path $scenarioFile)) { throw "no scenario $scenarioFile" }
if (-not (Test-Path $ext)) { throw 'run setup.ps1 first' }
$code = 'C:\Program Files\Microsoft VS Code\Code.exe'

function DemoProcs { Get-CimInstance Win32_Process -Filter "Name='Code.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } }
function KillDemo { DemoProcs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }

# Fresh profile state and a fresh copy of the models on every run
KillDemo
if (Test-Path -LiteralPath $stop) { Remove-Item -LiteralPath $stop -Force }
# Copy the contents explicitly. Copying the directory to an existing destination
# creates workspace/workspace when a previous cleanup failed (e.g. a locked file).
New-Item -ItemType Directory -Path $work -Force | Out-Null
$demoTemplatePath = Join-Path $root 'workspace'
foreach ($demoTemplateFile in Get-ChildItem -LiteralPath $demoTemplatePath -File -Force) {
    $demoDestinationPath = Join-Path $work $demoTemplateFile.Name
    Copy-Item -LiteralPath $demoTemplateFile.FullName -Destination $demoDestinationPath -Force
    if ((Get-FileHash -LiteralPath $demoTemplateFile.FullName).Hash -ne
        (Get-FileHash -LiteralPath $demoDestinationPath).Hash) {
        throw "Demo fixture copy differs: $demoDestinationPath"
    }
}
# A scenario may start from its own model (e.g. one with no comments yet)
$scenarioModel = Join-Path $root "scenarios\$Scenario.lecar.ode"
if (Test-Path -LiteralPath $scenarioModel) { Copy-Item -LiteralPath $scenarioModel -Destination (Join-Path $work 'lecar.ode') -Force }
# Parts 2 and 3 start from what the part before leaves: the model and the settings file
if ($Part -gt 1) {
    Copy-Item -LiteralPath (Join-Path $root "scenarios\$Scenario.part$Part.lecar.ode") -Destination (Join-Path $work 'lecar.ode') -Force
    Copy-Item -LiteralPath (Join-Path $root "scenarios\$Scenario.part$Part.xppsettings.json") -Destination (Join-Path $work '.xppsettings.json') -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $work 'lecar.ode')) -or
    (Get-Item -LiteralPath (Join-Path $work 'lecar.ode')).Length -eq 0) {
    throw 'Demo model missing or empty; VS Code will not be launched'
}
Get-ChildItem $udd -Force -ErrorAction SilentlyContinue | Where-Object Name -ne 'User' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $udd 'User') | Out-Null
# Saved layout state (side bar, panel, editor groups) from an earlier run would make the toggle keys below
# do the opposite of what they should, shifting every mouse coordinate
foreach ($stateDir in 'globalStorage', 'workspaceStorage', 'History') {
    Remove-Item -LiteralPath (Join-Path $udd "User\$stateDir") -Recurse -Force -ErrorAction SilentlyContinue
}
Copy-Item (Join-Path $root 'settings.json') (Join-Path $udd 'User\settings.json') -Force
if ($FontSize -ne 0) {
    $demoSettingsPath = Join-Path $udd 'User\settings.json'
    $demoSettings = Get-Content -LiteralPath $demoSettingsPath -Raw | ConvertFrom-Json -AsHashtable
    $demoSettings['editor.fontSize'] = $FontSize
    $demoSettings['editor.lineHeight'] = [int][Math]::Ceiling($FontSize * 1.4)
    if ($Scenario -eq 'colors-descriptions') {
        $demoSettings['window.zoomLevel'] = 1 # enlarges menus, tabs and the rest of the workbench
        $demoSettings['files.autoSave'] = 'afterDelay'
        $demoSettings['files.autoSaveDelay'] = 600
        $demoSettings['editor.autoIndent'] = 'keep'   # a new line inherits the indent; Tab adds one level
        $demoSettings['editor.formatOnType'] = $false
        $demoSettings['editor.formatOnSave'] = $false
    }
    $demoSettings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $demoSettingsPath -Encoding utf8
}

Start-Process $code -ArgumentList @('-n', '--user-data-dir', "`"$udd`"", '--extensions-dir', "`"$ext`"", '--force-device-scale-factor=1', "`"$work`"", "`"$(Join-Path $work 'lecar.ode')`"") | Out-Null
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 80 -and $hwnd -eq [IntPtr]::Zero; $i++) {
    Start-Sleep -Milliseconds 500
    $w = Get-Process Code -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*lecar.ode*workspace*' }
    if ($w) { $hwnd = $w[0].MainWindowHandle }
}
if ($hwnd -eq [IntPtr]::Zero) { KillDemo; throw 'demo window not found' }
[U]::ShowWindow($hwnd, 9) | Out-Null
[U]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 1440, 1040, 0x0040) | Out-Null
Start-Sleep -Milliseconds 800
[U]::SetForegroundWindow($hwnd) | Out-Null
if ($FullScreen) {
    [System.Windows.Forms.SendKeys]::SendWait('{F11}')
    Start-Sleep -Milliseconds 1200
}
$r = New-Object U+RECT
[U]::DwmGetWindowAttribute($hwnd, 9, [ref]$r, 16) | Out-Null
$X = $r.L; $Y = $r.T; $W = $r.R - $r.L; $H = $r.B - $r.T - 2   # the last two rows are outside the window
Write-Host "window $X,$Y ${W}x${H}"
Start-Sleep -Milliseconds 3000   # extension activation

# Every keystroke goes to the foreground window. If that is not the demo window any more (the user
# touched the machine), stop at once rather than type into their windows.
function Guard {
    if ([U]::GetForegroundWindow() -ne $hwnd) {
        New-Item $stop -ItemType File -Force | Out-Null
        KillDemo
        $title = New-Object System.Text.StringBuilder 256
        [U]::GetWindowText([U]::GetForegroundWindow(), $title, 256) | Out-Null
        throw "ABORTED: the demo window lost focus to '$title'; no more keys were sent"
    }
}
function Key([string]$k, [int]$ms = 250) { Guard; [System.Windows.Forms.SendKeys]::SendWait($k); Start-Sleep -Milliseconds $ms }
function TypeText([string]$s, [int]$ms = 45) {
    foreach ($c in $s.ToCharArray()) {
        $k = if ($c -eq "`n") { '{ENTER}' } elseif ('+^%~(){}[]'.Contains($c)) { "{$c}" } else { "$c" }
        Guard
        [System.Windows.Forms.SendKeys]::SendWait($k)
        Start-Sleep -Milliseconds $ms
    }
}
function Burst([string]$s) { TypeText $s 35 }
$script:shotNo = 0
function Shot([string]$label) {
    $dir = Join-Path $run 'rehearsal'; New-Item -ItemType Directory -Force $dir | Out-Null
    $b = New-Object System.Drawing.Bitmap $W, $H; $g = [System.Drawing.Graphics]::FromImage($b)
    $g.CopyFromScreen($X, $Y, 0, 0, $b.Size); $b.Save((Join-Path $dir ('{0:D2}-{1}.png' -f $script:shotNo++, $label))); $g.Dispose(); $b.Dispose()
}
function Pause([int]$ms = 1100) {
    Start-Sleep -Milliseconds $ms
    if ($Rehearse -and $ms -ge 500) { Shot "pause$ms" }
}
function GoToPosition([int]$line, [int]$col = 1) {
    Key '^g' 300; TypeText "${line}:${col}" 20; Key '{ENTER}' 300
}

# Text geometry of the left editor, relative to the window: side bar hidden, breadcrumbs off,
# font size 15, no wrapping, not scrolled. Scenarios keep the model short enough never to scroll.
$textLeft = 126; $firstRowY = 74; $rowHeight = 20; $charWidth = 8.09
if ($MouseNavigation) {
    # Full-screen, unscrolled editors; scaled from the existing 22 px dry-run framing.
    $demoZoomScale = [Math]::Pow(1.2, $demoSettings['window.zoomLevel'])
    $textLeft = (126 + ($FontSize - 15) * 2.7) * $demoZoomScale
    $firstRowY = (68 + $FontSize / 2) * $demoZoomScale
    $rowHeight = $demoSettings['editor.lineHeight'] * $demoZoomScale
    $charWidth = 0.5483 * $FontSize * $demoZoomScale   # measured on a dry-run screenshot
    $settingsTextLeft = (48 * $demoZoomScale + $W) / 2 + $textLeft - 48 * $demoZoomScale
}
function CharPoint([int]$line, [int]$col) {
    @{ X = $X + [int]($textLeft + ($col - 0.5) * $charWidth); Y = $Y + $firstRowY + ($line - 1) * $rowHeight }
}
# Glides the pointer there with an ease-in-out curve, so the recording shows it travel instead of jump
function MoveTo([int]$x, [int]$y) {
    $from = [System.Windows.Forms.Cursor]::Position
    $dist = [Math]::Sqrt([Math]::Pow($x - $from.X, 2) + [Math]::Pow($y - $from.Y, 2))
    $steps = [Math]::Min(70, [Math]::Max(15, [int]($dist / 10)))
    for ($i = 1; $i -le $steps; $i++) {
        $t = $i / $steps; $e = $t * $t * (3 - 2 * $t)
        [U]::SetCursorPos([int]($from.X + ($x - $from.X) * $e), [int]($from.Y + ($y - $from.Y) * $e)) | Out-Null
        Start-Sleep -Milliseconds 14
    }
    Start-Sleep -Milliseconds 200
}
function Click([int]$count = 1) {
    for ($i = 0; $i -lt $count; $i++) { [U]::mouse_event(0x2, 0, 0, 0, [IntPtr]::Zero); [U]::mouse_event(0x4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60 }
    Start-Sleep -Milliseconds 300
    Guard
}
function PlaceCaret([int]$line, [int]$col = 1, [switch]$Settings) {
    $origin = if ($Settings) { $settingsTextLeft } else { $textLeft }
    $caretX = $X + [int]($origin + ($col - 1) * $charWidth)
    $caretY = $Y + [int]($firstRowY + ($line - 1) * $rowHeight)
    if ($caretX -ge $X + $W - 20 -or $caretY -ge $Y + $H - 30) {
        throw 'Mouse target is outside the visible editor: check the full-screen dry run'
    }
    MoveTo $caretX $caretY; Click
}
function PlaceLineEnd([int]$line, [switch]$Settings) {
    # Clicking empty space past the text lets Monaco place the caret at the real EOL.
    # Do not estimate a string's end from font widths: a two-character error splits JSON.
    $endX = if ($Settings) { $X + [int]($W * 0.86) } else { $X + (48 * $demoZoomScale + $W) / 2 - 40 }
    $endY = $Y + [int]($firstRowY + ($line - 1) * $rowHeight)
    MoveTo ([int]$endX) $endY; Click
}
# Rests the pointer on line:col (1-based) until VS Code shows its hover
function HoverAt([int]$line, [int]$col, [int]$ms = 3000) {
    if ($MouseNavigation) {
        $p = CharPoint $line $col; MoveTo $p.X $p.Y; Pause $ms
    } elseif ($KeyboardNavigation) {
        CloseHover; Key '^1' 150; GoToPosition $line $col
        Key '^k' 100; Key '^i' $ms # VS Code Show Hover; follows the editor's actual layout
    } else {
        $p = CharPoint $line $col; MoveTo $p.X $p.Y; Start-Sleep -Milliseconds $ms
    }
}
# An open hover can cover the next click target: move off the text first so VS Code closes it
function CloseHover {
    if ($MouseNavigation) {
        # Slide sideways into the empty space right of the model text (no jump across the screen)
        $pos = [System.Windows.Forms.Cursor]::Position
        $emptyX = $X + [int]((48 * $demoZoomScale + $W) / 2) - 40
        if ($pos.X -lt $emptyX) { MoveTo $emptyX $pos.Y }
        Pause 400
    } elseif ($KeyboardNavigation) { Key '{ESC}' 200 } else {
        $p = CharPoint 32 60; MoveTo $p.X $p.Y; Start-Sleep -Milliseconds 400
    }
}
# Puts the text cursor at the end of a line by clicking right of its text
function ClickEnd([int]$line) {
    CloseHover
    if ($MouseNavigation) {
        PlaceLineEnd $line
    } elseif ($KeyboardNavigation) { Key '^1' 150; GoToPosition $line; Key '{END}' 150 } else {
        $p = CharPoint $line 70; MoveTo $p.X $p.Y; Click
    }
}
# Selects the word at line:col
function SelectWord([int]$line, [int]$col) {
    CloseHover
    if ($KeyboardNavigation) {
        Key '^1' 150; GoToPosition $line $col; Key '^{LEFT}' 100; Key '^+{RIGHT}' 150
    } else { $p = CharPoint $line $col; MoveTo $p.X $p.Y; Click 2 }
}

Key '^+p' 700; TypeText 'Toggle Do Not Disturb' 15; Start-Sleep -Milliseconds 400; Key '{ENTER}' 1200
Key '^b' 1000   # hide the side bar: more room for the model
if (-not $KeyboardNavigation -and -not $MouseNavigation) { Key '^+m' 800 }
Key '^1' 500

# Prepare the opening shot before the capture process starts (also used by DryRun).
if ($Scenario -eq 'colors-descriptions') {
    Key '^p' 500; TypeText '.xppsettings.json' 20; Pause 400; Key '{ENTER}' 800
    Key '^%{RIGHT}' 900
    Key '^+m' 900   # Problems panel stays open: the demo shows its warnings
    # Left group must show the model. Focus it and
    # check the window title, which names the active editor; stop before capture if it is wrong.
    function WindowTitle { $t = New-Object System.Text.StringBuilder 256; [U]::GetWindowText($hwnd, $t, 256) | Out-Null; $t.ToString() }
    Key '^1' 700   # focus the left group; normally enough
    for ($attempt = 0; $attempt -lt 2 -and -not (WindowTitle).StartsWith('lecar.ode'); $attempt++) {
        Key '^p' 500; TypeText 'lecar.ode' 20; Pause 600; Key '{ENTER}' 800   # fallback only
    }
    if (-not (WindowTitle).StartsWith('lecar.ode')) { KillDemo; throw "Model not shown in the left editor (window title: $(WindowTitle))" }
    Pause 1500
}

if ($DryRun) {
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $demoGraphics = [System.Drawing.Graphics]::FromImage($bmp)
    $demoGraphics.CopyFromScreen($X, $Y, 0, 0, $bmp.Size)
    $bmp.Save((Join-Path $run 'dryrun.png'))
    $demoGraphics.Dispose(); $bmp.Dispose()
    KillDemo
    exit 0
}

if ($Rehearse) {
    Remove-Item (Join-Path $run 'rehearsal') -Recurse -Force -ErrorAction SilentlyContinue
    try { . $scenarioFile } finally {
        New-Item -ItemType Directory -Force (Join-Path $run 'rehearsal') | Out-Null
        Copy-Item (Join-Path $work '.xppsettings.json') (Join-Path $run 'rehearsalinal.json') -ErrorAction SilentlyContinue
        KillDemo
    }
    exit 0
}
$cap = Start-Process pwsh -ArgumentList @('-NoProfile', '-File', "`"$(Join-Path $root 'capture.ps1')`"", '-X', $X, '-Y', $Y, '-W', $W, '-H', $H, '-Dir', "`"$frames`"", '-Stop', "`"$stop`"") -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 600
[U]::SetForegroundWindow($hwnd) | Out-Null

try {
    . $scenarioFile
} finally {
    # A failed JSON check must stop capture as well as the demo window.
    [IO.File]::WriteAllText($stop, '')
    if (-not $cap.WaitForExit(10000)) { Stop-Process -Id $cap.Id -Force -ErrorAction SilentlyContinue }
    KillDemo
}
$gifName = if ($Part -gt 0) { @('colors', 'comments', 'arrays')[$Part - 1] } else { $Scenario }
$gif = Join-Path $root "..\images\$gifName-demo.gif"
$frameCount = (Get-ChildItem $frames -Filter *.png).Count
Write-Host "Capture done: $frameCount frames. Encoding the GIF (about a minute or two, no output until it ends)..."
node (Join-Path $root 'encode.mjs') $frames $gif
if ($Mp4) {
    Write-Host 'Encoding the MP4 (about a minute)...'
    node (Join-Path $root 'to-mp4.mjs') $frames ([IO.Path]::ChangeExtension($gif, '.mp4'))
}
Write-Host 'Done.'
