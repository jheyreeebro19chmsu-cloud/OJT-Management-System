# OJT Management System - PowerShell White-Box Test Runner
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   CHMSU OJT MANAGEMENT SYSTEM - AUTOMATED WHITE-BOX TEST RUNNER" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Select test suite to run:"
Write-Host "    [1] Node.js Comprehensive Suite (119 Test Cases - Recommended)" -ForegroundColor Green
Write-Host "    [2] Python PyTest Suite (42 Test Cases with Qase TestOps)" -ForegroundColor Yellow
Write-Host "    [3] Run Both Suites Sequentially" -ForegroundColor Magenta
Write-Host "    [4] Exit"
Write-Host ""

$choice = Read-Host "Enter your choice [1-4] (default is 1)"
if (-not $choice) { $choice = "1" }

switch ($choice) {
    "1" {
        Write-Host "`n>>> Running Node.js White-Box Test Suite..." -ForegroundColor Cyan
        node scripts/white-box-test.mjs
    }
    "2" {
        Write-Host "`n>>> Running Python PyTest Suite..." -ForegroundColor Cyan
        python -m pytest tests/test_ojt_white_box.py -v
    }
    "3" {
        Write-Host "`n[1/2] Running Node.js Suite..." -ForegroundColor Green
        node scripts/white-box-test.mjs
        Write-Host "`n[2/2] Running Python PyTest Suite..." -ForegroundColor Yellow
        python -m pytest tests/test_ojt_white_box.py -v
    }
    Default {
        Write-Host "Exiting."
    }
}
