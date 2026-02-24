Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$targets = @(
    @{ Source = "drafts/extended_frontiers.md"; Destination = "docs/chapters/extended_frontiers.md" },
    @{ Source = "drafts/ch01_from_receptor_to_perception.md"; Destination = "docs/chapters/ch01_from_receptor_to_perception.md" },
    @{ Source = "drafts/ch02_how_the_thalamus_loses_the_room.md"; Destination = "docs/chapters/ch02_how_the_thalamus_loses_the_room.md" },
    @{ Source = "drafts/ch03_when_the_brains_metronome_breaks.md"; Destination = "docs/chapters/ch03_when_the_brains_metronome_breaks.md" },
    @{ Source = "drafts/ch04_what_gets_rewritten_after_the_trip.md"; Destination = "docs/chapters/ch04_what_gets_rewritten_after_the_trip.md" },
    @{ Source = "research/claim_checklist.md"; Destination = "docs/research/claim_checklist.md" },
    @{ Source = "research/source_map.md"; Destination = "docs/research/source_map.md" }
)

$requiredDirs = @(
    "docs",
    "docs/chapters",
    "docs/research"
)

foreach ($dir in $requiredDirs) {
    $fullDir = Join-Path $projectRoot $dir
    if (-not (Test-Path -LiteralPath $fullDir)) {
        New-Item -ItemType Directory -Path $fullDir | Out-Null
    }
}

$missing = @()

foreach ($target in $targets) {
    $sourcePath = Join-Path $projectRoot $target.Source
    $destinationPath = Join-Path $projectRoot $target.Destination

    if (-not (Test-Path -LiteralPath $sourcePath)) {
        $missing += $target.Source
        continue
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    Write-Host ("Synced {0} -> {1}" -f $target.Source, $target.Destination)
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing source files: {0}" -f ($missing -join ", "))
}

Write-Host "Docs sync complete."
