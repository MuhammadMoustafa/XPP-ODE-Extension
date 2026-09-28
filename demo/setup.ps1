# One-time (and after every extension change): installs the recorder's npm packages, packages the
# extension from the repo and installs it into run/ext, a VS Code extensions folder of its own.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$run = Join-Path $root 'run'
$ext = Join-Path $run 'ext'
New-Item -ItemType Directory -Force $run | Out-Null

Push-Location $root; npm install --silent; Pop-Location

$vsix = Join-Path $run 'xpp.vsix'
Push-Location (Join-Path $root '..'); npx vsce package -o $vsix; Pop-Location
Remove-Item $ext -Recurse -Force -ErrorAction SilentlyContinue
& 'C:\Program Files\Microsoft VS Code\bin\code.cmd' --user-data-dir (Join-Path $run 'udd') --extensions-dir $ext --install-extension $vsix --force
