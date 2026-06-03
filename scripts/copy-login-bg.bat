@echo off
REM Usage: copy-login-bg.bat "C:\path\to\image.jpg"
IF "%1"=="" (
  echo Usage: %0 ^"C:\path\to\image.jpg^"
  exit /b 1
)
set SOURCE=%~1
set TARGET=%~dp0..\public\chmsu.jpg
if not exist "%SOURCE%" (
  echo Source file not found: %SOURCE%
  exit /b 1
)
if not exist "%~dp0..\public" (
  mkdir "%~dp0..\public"
)
copy /Y "%SOURCE%" "%TARGET%"
if %ERRORLEVEL% EQU 0 (
  echo Copied %SOURCE% to %TARGET%
) else (
  echo Failed to copy file
  exit /b 1
)
