@echo off
setlocal enabledelayedexpansion
title OJT Management System - White-Box Testing Suite
cls

echo ======================================================================
echo    CHMSU OJT MANAGEMENT SYSTEM - AUTOMATED WHITE-BOX TEST RUNNER
echo ======================================================================
echo.
echo  Choose which white-box test suite to run in terminal:
echo.
echo    [1] Node.js Comprehensive Suite (119 Test Cases - Recommended)
echo    [2] Python PyTest Suite (42 Test Cases with Qase TestOps)
echo    [3] Run Both Suites Sequentially
echo    [4] Exit
echo.
echo ======================================================================
set /p choice="Enter your choice (1, 2, 3, or 4): "

if "%choice%"=="1" goto run_node
if "%choice%"=="2" goto run_python
if "%choice%"=="3" goto run_both
if "%choice%"=="4" goto end

echo Invalid selection. Running Node.js suite by default...
goto run_node

:run_node
echo.
echo ----------------------------------------------------------------------
echo Running Node.js White-Box Test Suite (scripts/white-box-test.mjs)...
echo ----------------------------------------------------------------------
node scripts/white-box-test.mjs
goto finish

:run_python
echo.
echo ----------------------------------------------------------------------
echo Running Python PyTest Suite (tests/test_ojt_white_box.py)...
echo ----------------------------------------------------------------------
python -m pytest tests/test_ojt_white_box.py -v
goto finish

:run_both
echo.
echo ======================================================================
echo [1/2] RUNNING NODE.JS WHITE-BOX TEST SUITE (119 CASES)...
echo ======================================================================
node scripts/white-box-test.mjs
echo.
echo ======================================================================
echo [2/2] RUNNING PYTHON PYTEST SUITE (42 CASES)...
echo ======================================================================
python -m pytest tests/test_ojt_white_box.py -v
goto finish

:finish
echo.
echo ======================================================================
echo Tests execution finished.
echo ======================================================================
pause

:end
