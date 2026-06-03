param(
  [Parameter(Mandatory=$true)]
  [string]$SourcePath,
  [string]$TargetPath = "$PSScriptRoot\..\public\chmsu.jpg"
)

if (-not (Test-Path $SourcePath)) {
  Write-Error "Source file not found: $SourcePath"
  exit 1
}

# Ensure target directory exists
$targetDir = Split-Path $TargetPath -Parent
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }

Copy-Item -Path $SourcePath -Destination $TargetPath -Force
Write-Output "Copied $SourcePath to $TargetPath"