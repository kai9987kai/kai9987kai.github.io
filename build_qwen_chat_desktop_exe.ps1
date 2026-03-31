param(
  [string]$Name = "SupermixQwenDesktop",
  [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

if (-not $SkipDependencyInstall) {
  python -m pip install pywebview pillow pyinstaller | Out-Host
}

python "source\generate_desktop_branding.py" | Out-Host

$AdapterDir = python -c "from pathlib import Path; import sys; sys.path.insert(0, 'source'); import qwen_chat_desktop_app as app; print(app.find_latest_adapter_dir(Path('.').resolve()))"
if (-not $AdapterDir) {
  throw 'Failed to resolve latest adapter directory.'
}
$ArtifactDir = Split-Path -Parent $AdapterDir
$BundleDir = Join-Path $RepoRoot "build\desktop_bundle_stage"

$IconPath = Join-Path $RepoRoot "assets\supermix_qwen_icon.ico"
if (-not (Test-Path $IconPath)) {
  throw "Expected icon asset at $IconPath"
}

if (Test-Path $BundleDir) {
  Remove-Item -Recurse -Force $BundleDir
}
New-Item -ItemType Directory -Path $BundleDir -Force | Out-Null
Copy-Item -Recurse -Force $AdapterDir (Join-Path $BundleDir "adapter")
foreach ($FileName in @("benchmark_results.json", "benchmark_comparison.png", "latest_adapter_checkpoint.txt")) {
  $SourcePath = Join-Path $ArtifactDir $FileName
  if (Test-Path $SourcePath) {
    Copy-Item -Force $SourcePath (Join-Path $BundleDir $FileName)
  }
}
$BundleManifest = @{
  artifact_name = Split-Path $ArtifactDir -Leaf
  adapter_relative_path = "adapter"
  created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
}
$BundleManifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $BundleDir "release_manifest.json")

try {
  $PyInstallerArgs = @(
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onedir",
    "--windowed",
    "--name", $Name,
    "--icon", $IconPath,
    "--collect-all", "webview",
    "--collect-all", "bottle",
    "--collect-all", "pythonnet",
    "--collect-all", "clr_loader",
    "--add-data", "source\\qwen_chat_web_app.py;source",
    "--add-data", "assets;assets",
    "--add-data", "$BundleDir;bundled_latest_artifact",
    "source\\qwen_chat_desktop_app.py"
  )

  Write-Host "Building $Name with adapter: $AdapterDir"
  Write-Host "Bundled artifact metadata from: $ArtifactDir"
  python @PyInstallerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed."
  }

  $ExePath = Join-Path $RepoRoot "dist\$Name\$Name.exe"
  Write-Host "Build complete: $ExePath"
}
finally {
  if (Test-Path $BundleDir) {
    Remove-Item -Recurse -Force $BundleDir
  }
}
