# ==============================================================================
# CHMSU OJT Management System - Automated Database Seeder
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\seed_system.ps1
#   powershell -ExecutionPolicy Bypass -File .\seed_system.ps1 -Target django
#   powershell -ExecutionPolicy Bypass -File .\seed_system.ps1 -Target supabase
# ==============================================================================

param (
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve Python from backend virtual environment
$PythonExe = Join-Path $ScriptDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = Join-Path $ScriptDir "backend\venv\Scripts\python.exe"
}
if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Virtual environment Python not found at backend\.venv or backend\venv." -ForegroundColor Red
    exit 1
}

$ManagePy = Join-Path $ScriptDir "backend\manage.py"
$SupabaseSeeder = Join-Path $ScriptDir "scripts\seed-supabase.cjs"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   CHMSU OJT System - Database Population & Seeding Tool         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Target: $Target" -ForegroundColor Gray
Write-Host ""

if ($Target -eq "all" -or $Target -eq "django") {
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "[1/2] Seeding Django Backend (Users, Students, HTE, DTR, Tasks)..." -ForegroundColor Yellow
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    & $PythonExe $ManagePy seed_data
}

if ($Target -eq "all" -or $Target -eq "supabase") {
    Write-Host ""
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "[2/2] Seeding Supabase Cloud (Employees, Records, Settings)..." -ForegroundColor Yellow
    Write-Host "-----------------------------------------------------------------" -ForegroundColor Yellow
    node $SupabaseSeeder
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] System database seeding completed!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Default Logins:" -ForegroundColor White
Write-Host "  Admin:      admin@chmsuojtmis.site      / Admin@12345" -ForegroundColor Cyan
Write-Host "  Instructor: instructor.it@chmsu.edu.ph  / Instructor@12345" -ForegroundColor Cyan
Write-Host "  HTE Coord:  hte.techcorp@chmsuojtmis.site / Hte@12345" -ForegroundColor Cyan
Write-Host "  Trainee:    student.cruz@chmsu.edu.ph   / Student@12345" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Green
