# Records one README demo: opens an isolated VS Code on a fresh copy of workspace/, plays
# scenarios/<Scenario>.ps1 with keystrokes and mouse moves while capture.ps1 grabs the window, then encodes
# ../images/<Scenario>-demo.gif (and .mp4 with -Mp4). Run setup.ps1 once before.
# Do not touch the mouse or keyboard while it runs: if the demo window loses focus it aborts.
param([Parameter(Mandatory)][string]$Scenario, [switch]$DryRun, [switch]$Mp4)
$ErrorActionPreference = 'Stop'
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
Remove-Item $stop, $work -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $udd -Force -ErrorAction SilentlyContinue | Where-Object Name -ne 'User' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $root 'workspace') $work -Recurse
New-Item -ItemType Directory -Force (Join-Path $udd 'User') | Out-Null
Copy-Item (Join-Path $root 'settings.json') (Join-Path $udd 'User\settings.json') -Force

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
$r = New-Object U+RECT
[U]::DwmGetWindowAttribute($hwnd, 9, [ref]$r, 16) | Out-Null
$X = $r.L; $Y = $r.T; $W = $r.R - $r.L; $H = $r.B - $r.T - 2   # the last two rows are outside the window
Write-Host "window $X,$Y ${W}x${H}"
Start-Sleep -Milliseconds 3000   # extension activation

if ($DryRun) {
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($X, $Y, 0, 0, $bmp.Size)
    $bmp.Save((Join-Path $run 'dryrun.png'))
    KillDemo
    exit 0
}

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
function Pause([int]$ms = 1100) { Start-Sleep -Milliseconds $ms }

# Text geometry of the left editor, relative to the window: side bar hidden, breadcrumbs off,
# font size 15, no wrapping, not scrolled. Scenarios keep the model short enough never to scroll.
$textLeft = 126; $firstRowY = 74; $rowHeight = 20; $charWidth = 8.09
function CharPoint([int]$line, [int]$col) {
    @{ X = $X + [int]($textLeft + ($col - 0.5) * $charWidth); Y = $Y + $firstRowY + ($line - 1) * $rowHeight }
}
# Glides the pointer there, so the recording shows it travel instead of jump
function MoveTo([int]$x, [int]$y) {
    $from = [System.Windows.Forms.Cursor]::Position
    for ($i = 1; $i -le 12; $i++) {
        [U]::SetCursorPos($from.X + ($x - $from.X) * $i / 12, $from.Y + ($y - $from.Y) * $i / 12) | Out-Null
        Start-Sleep -Milliseconds 25
    }
}
function Click([int]$count = 1) {
    for ($i = 0; $i -lt $count; $i++) { [U]::mouse_event(0x2, 0, 0, 0, [IntPtr]::Zero); [U]::mouse_event(0x4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60 }
    Start-Sleep -Milliseconds 300
    Guard
}
# Rests the pointer on line:col (1-based) until VS Code shows its hover
function HoverAt([int]$line, [int]$col, [int]$ms = 3000) { $p = CharPoint $line $col; MoveTo $p.X $p.Y; Start-Sleep -Milliseconds $ms }
# An open hover can cover the next click target: move off the text first so VS Code closes it
function CloseHover { $p = CharPoint 32 60; MoveTo $p.X $p.Y; Start-Sleep -Milliseconds 400 }
# Puts the text cursor at the end of a line by clicking right of its text
function ClickEnd([int]$line) { CloseHover; $p = CharPoint $line 70; MoveTo $p.X $p.Y; Click }
# Selects the word at line:col
function SelectWord([int]$line, [int]$col) { CloseHover; $p = CharPoint $line $col; MoveTo $p.X $p.Y; Click 2 }

$cap = Start-Process pwsh -ArgumentList @('-NoProfile', '-File', "`"$(Join-Path $root 'capture.ps1')`"", '-X', $X, '-Y', $Y, '-W', $W, '-H', $H, '-Dir', "`"$frames`"", '-Stop', "`"$stop`"") -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 600
[U]::SetForegroundWindow($hwnd) | Out-Null
Key '^+p' 700; TypeText 'Toggle Do Not Disturb' 15; Start-Sleep -Milliseconds 400; Key '{ENTER}' 1200
Key '^b' 1000   # hide the side bar: more room for the model
Key '^+m' 800; Key '^1' 500   # Problems panel open below the model, focus back in the editor

. $scenarioFile

New-Item $stop -ItemType File | Out-Null
$cap.WaitForExit()
KillDemo
$gif = Join-Path $root "..\images\$Scenario-demo.gif"
node (Join-Path $root 'encode.mjs') $frames $gif
if ($Mp4) { node (Join-Path $root 'to-mp4.mjs') $frames ([IO.Path]::ChangeExtension($gif, '.mp4')) }
