@echo off
REM OJT System Setup Script for Windows

echo ======================================
echo OJT Management System Setup
echo ======================================

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed. Please install Python 3.10+
    exit /b 1
)

REM Navigate to backend
cd backend

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Check if .env exists
if not exist .env (
    echo Copying .env.example to .env...
    if exist .env.example (
        copy .env.example .env
    ) else (
        echo .env.example not found, please create .env manually
    )
    echo Please edit .env with your configuration (especially EMAIL settings)
)

REM Run migrations
echo Running database migrations...
python manage.py makemigrations
python manage.py migrate

REM Ask for superuser
set /p create_super="Create superuser? (y/n): "
if /i "%create_super%"=="y" (
    python manage.py createsuperuser
)

REM Return to root
cd ..

REM Frontend setup
echo ======================================
echo Setting up Frontend
echo ======================================

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js 18+
    exit /b 1
)

echo Installing frontend dependencies...
call npm install

REM Check if .env.local exists
if not exist .env.local (
    echo Creating .env.local...
    (
        echo VITE_DJANGO_API_URL=http://localhost:8000/api
        echo VITE_FACE_VERIFICATION_TOLERANCE=0.6
    ) > .env.local
)

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo To start development:
echo.
echo Backend:
echo   cd backend
echo   venv\Scripts\activate.bat
echo   python manage.py runserver
echo.
echo Frontend (in another terminal):
echo   npm run dev
echo.
echo Access the application at:
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:8000/api
echo   Admin Panel: http://localhost:8000/admin
echo.
echo ======================================

pause
