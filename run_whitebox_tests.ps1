# ==============================================================================
# OJT Management System - White-Box Testing Runner (Beta Testing)
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\run_whitebox_tests.ps1
#   powershell -ExecutionPolicy Bypass -File .\run_whitebox_tests.ps1 -Suite db
#   powershell -ExecutionPolicy Bypass -File .\run_whitebox_tests.ps1 -Suite all
# ==============================================================================

param (
    [string]$Suite = "all",
    [switch]$Verbose = $true
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve Python from backend virtual environment
$PythonExe = Join-Path $ScriptDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = Join-Path $ScriptDir "backend\venv\Scripts\python.exe"
}
if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Virtual environment Python not found. Please verify backend\.venv exists." -ForegroundColor Red
    exit 1
}

$BackendDir = Join-Path $ScriptDir "backend"
$env:PYTHONPATH = $BackendDir
$env:DJANGO_SETTINGS_MODULE = "ojt_backend.settings"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   CHMSU OJT System - White-Box Beta Testing Suite (pytest)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Python:  $PythonExe" -ForegroundColor Gray
Write-Host "Backend: $BackendDir" -ForegroundColor Gray
Write-Host "Suite:   $Suite" -ForegroundColor Gray
Write-Host ""

$TestTargets = @()

switch ($Suite.ToLower()) {
    "db" {
        $TestTargets += "backend\security\tests\test_database_connection_whitebox.py"
    }
    "admin" {
        $TestTargets += "backend\security\tests\test_admin_auth_whitebox.py"
    }
    "trainee" {
        $TestTargets += "backend\security\tests\test_trainee_auth_whitebox.py"
    }
    "errors" {
        $TestTargets += "backend\security\tests\test_auth_error_handling_whitebox.py"
    }
    "whitebox" {
        $TestTargets += "backend\security\tests\test_database_connection_whitebox.py"
        $TestTargets += "backend\security\tests\test_admin_auth_whitebox.py"
        $TestTargets += "backend\security\tests\test_trainee_auth_whitebox.py"
        $TestTargets += "backend\security\tests\test_auth_error_handling_whitebox.py"
    }
    default {
        $TestTargets += "backend\security\tests"
    }
}

$pytestArgs = @("-m", "pytest") + $TestTargets + @("-v", "--ds=ojt_backend.settings", "-W", "ignore::DeprecationWarning", "-W", "ignore::UserWarning")

& $PythonExe $pytestArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " [PASSED] All White-Box Test Cases verified successfully!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Red
    Write-Host " [FAILED] Some test cases encountered errors. See log above." -ForegroundColor Red
    Write-Host "=================================================================" -ForegroundColor Red
    exit $LASTEXITCODE
}
