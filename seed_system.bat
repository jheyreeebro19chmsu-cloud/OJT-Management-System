@echo off
setlocal enabledelayedexpansion
title CHMSU OJT Management System - Database Seeder
cls

echo ======================================================================
echo    CHMSU OJT MANAGEMENT SYSTEM - AUTOMATED SEED DATA RUNNER
echo ======================================================================
echo.
echo  Choose what you want to seed:
echo.
echo    [1] Full System Seeding (Django Backend + Supabase Cloud) - Recommended
echo    [2] Django Backend Only (Users, Students, Instructors, HTE, DTR, Tasks)
echo    [3] Supabase Cloud Only (Employees, Time Records, Settings, Evaluations)
echo    [4] Exit
echo.
echo ======================================================================
set /p choice="Enter your choice (1, 2, 3, or 4): "

if "%choice%"=="1" goto run_both
if "%choice%"=="2" goto run_django
if "%choice%"=="3" goto run_supabase
if "%choice%"=="4" goto end

echo Invalid selection. Running Full System Seeding by default...
goto run_both

:run_django
echo.
echo ----------------------------------------------------------------------
echo [1/1] Running Django Backend Database Seeder...
echo ----------------------------------------------------------------------
backend\.venv\Scripts\python.exe backend\manage.py seed_data
goto finish

:run_supabase
echo.
echo ----------------------------------------------------------------------
echo [1/1] Running Supabase Cloud Database Seeder...
echo ----------------------------------------------------------------------
node scripts\seed-supabase.cjs
goto finish

:run_both
echo.
echo ======================================================================
echo [1/2] RUNNING DJANGO BACKEND SEEDER (Users, Roles, Applications, DTR)...
echo ======================================================================
backend\.venv\Scripts\python.exe backend\manage.py seed_data
echo.
echo ======================================================================
echo [2/2] RUNNING SUPABASE CLOUD SEEDER (Employees, Records, Settings)...
echo ======================================================================
node scripts\seed-supabase.cjs
goto finish

:finish
echo.
echo ======================================================================
echo Database seeding completed successfully!
echo ======================================================================
echo.
echo Default Logins Available:
echo   - Admin:      admin@chmsuojtmis.site      / Admin@12345
echo   - Instructor: instructor.it@chmsu.edu.ph  / Instructor@12345
echo   - HTE Coord:  hte.techcorp@chmsuojtmis.site / Hte@12345
echo   - Trainee:    student.cruz@chmsu.edu.ph   / Student@12345
echo ======================================================================
pause

:end
