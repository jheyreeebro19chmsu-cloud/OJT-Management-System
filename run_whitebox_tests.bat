@echo off
setlocal
echo =================================================================
echo    CHMSU OJT System - White-Box Beta Testing Suite (pytest)
echo =================================================================

set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE=%SCRIPT_DIR%backend\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=%SCRIPT_DIR%backend\venv\Scripts\python.exe"
)

if not exist "%PYTHON_EXE%" (
    echo [ERROR] Python environment not found at backend\.venv or backend\venv.
    pause
    exit /b 1
)

set "PYTHONPATH=%SCRIPT_DIR%backend"
set "DJANGO_SETTINGS_MODULE=ojt_backend.settings"

if "%1"=="" (
    echo Running all tests in backend/security/tests (114 tests)...
    "%PYTHON_EXE%" -m pytest backend\security\tests -v
) else (
    echo Running specified target: %*
    "%PYTHON_EXE%" -m pytest %* -v
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =================================================================
    echo  [PASSED] All Test Cases verified successfully!
    echo =================================================================
) else (
    echo.
    echo =================================================================
    echo  [FAILED] Some test cases encountered errors.
    echo =================================================================
)

pause

