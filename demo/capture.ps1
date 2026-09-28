# Saves the screen region X,Y,W,H every $Interval ms as frame_NNNNN.png, with the mouse pointer drawn
# in (a plain screen copy leaves it out), until the file $Stop appears; frame times go to times.txt.
param([int]$X, [int]$Y, [int]$W, [int]$H, [string]$Dir, [string]$Stop, [int]$Interval = 120)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class C {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO { public int cbSize, flags; public IntPtr hCursor; public POINT pt; }
  [StructLayout(LayoutKind.Sequential)] public struct ICONINFO { public bool fIcon; public int xHotspot, yHotspot; public IntPtr hbmMask, hbmColor; }
  [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO ci);
  [DllImport("user32.dll")] public static extern bool GetIconInfo(IntPtr h, out ICONINFO ii);
  [DllImport("user32.dll")] public static extern bool DrawIcon(IntPtr hdc, int x, int y, IntPtr h);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr h);
}
"@
[C]::SetProcessDPIAware() | Out-Null
New-Item -ItemType Directory -Force $Dir | Out-Null
Get-ChildItem $Dir | Remove-Item -Force

function DrawPointer([System.Drawing.Graphics]$g) {
    $ci = New-Object C+CURSORINFO
    $ci.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($ci)
    if (-not [C]::GetCursorInfo([ref]$ci) -or $ci.flags -ne 1) { return }   # 1 = showing
    $ii = New-Object C+ICONINFO
    if (-not [C]::GetIconInfo($ci.hCursor, [ref]$ii)) { return }
    $hdc = $g.GetHdc()
    [C]::DrawIcon($hdc, $ci.pt.X - $X - $ii.xHotspot, $ci.pt.Y - $Y - $ii.yHotspot, $ci.hCursor) | Out-Null
    $g.ReleaseHdc($hdc)
    [C]::DeleteObject($ii.hbmMask) | Out-Null
    if ($ii.hbmColor -ne [IntPtr]::Zero) { [C]::DeleteObject($ii.hbmColor) | Out-Null }
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$times = New-Object System.Collections.Generic.List[string]
$n = 0
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
while (-not (Test-Path $Stop)) {
    $t = $sw.ElapsedMilliseconds
    $g.CopyFromScreen($X, $Y, 0, 0, $bmp.Size)
    DrawPointer $g
    $bmp.Save((Join-Path $Dir ("frame_{0:D5}.png" -f $n)), [System.Drawing.Imaging.ImageFormat]::Png)
    $times.Add($t)
    $n++
    $rest = $Interval - ($sw.ElapsedMilliseconds - $t)
    if ($rest -gt 0) { Start-Sleep -Milliseconds $rest }
}
$times | Set-Content (Join-Path $Dir 'times.txt')
