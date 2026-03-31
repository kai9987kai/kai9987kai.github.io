param(
  [string]$Name = "SupermixQwenDesktop",
  [string]$DisplayName = "Supermix Qwen Desktop",
  [string]$Version = "",
  [switch]$SkipExeBuild,
  [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

if (-not $Version) {
  $Version = Get-Date -Format "yyyy.MM.dd"
}

if (-not $SkipExeBuild) {
  $BuildExeArgs = @(
    "-ExecutionPolicy", "Bypass",
    "-File", "source\build_qwen_chat_desktop_exe.ps1",
    "-Name", $Name
  )
  if ($SkipDependencyInstall) {
    $BuildExeArgs += "-SkipDependencyInstall"
  }
  & powershell @BuildExeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Desktop EXE build failed."
  }
}

$DistDir = Join-Path $RepoRoot "dist\$Name"
if (-not (Test-Path $DistDir)) {
  throw "Missing packaged desktop app directory: $DistDir"
}

$OutputDir = Join-Path $RepoRoot "dist\installer"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$Iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
$IsccPath = if ($Iscc) {
  $Iscc.Source
} else {
  @(
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe")
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $IsccPath) {
  throw 'Inno Setup Compiler (iscc.exe) not found. Install it with: winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements'
}

$SetupBaseName = "$Name-Setup-$Version"
$CompilerArgs = @(
  "/DMyAppName=$DisplayName",
  "/DMyAppExeName=$Name.exe",
  "/DMyAppVersion=$Version",
  "/DMySourceDir=$DistDir",
  "/DMyOutputDir=$OutputDir",
  "/DMySetupBaseName=$SetupBaseName",
  "installer\SupermixQwenDesktop.iss"
)

& $IsccPath @CompilerArgs
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup compilation failed."
}

$InstallerPath = Join-Path $OutputDir "$SetupBaseName.exe"
Write-Host "Installer complete: $InstallerPath"
