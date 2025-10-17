@echo off
REM Quick Start Script for Search Benchmark (Windows)
REM Sets up and runs the benchmark with guided prompts

echo.
echo 🚀 this.is Search Benchmark - Quick Start
echo ==========================================
echo.

REM Check if .env exists
if not exist .env (
    echo 📝 Setting up configuration...
    copy .env.example .env >nul
    echo ✓ Created .env file
    echo.
    echo ⚠️  Please edit .env and set your BASE_URL
    echo.
    set /p base_url="Enter your search API base URL (e.g., https://api.example.com): "
    
    if defined base_url (
        powershell -Command "(Get-Content .env) -replace 'BASE_URL=.*', 'BASE_URL=%base_url%' | Set-Content .env"
        echo ✓ Updated BASE_URL in .env
    ) else (
        echo ❌ BASE_URL is required. Please edit .env manually.
        exit /b 1
    )
) else (
    echo ✓ .env file found
)

echo.

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo ✓ Dependencies installed
) else (
    echo ✓ Dependencies already installed
)

echo.

REM Ask for custom parameters
echo ⚙️  Benchmark Configuration
echo.
set /p users="Number of concurrent users (default: 300): "
if "%users%"=="" set users=300

set /p duration="Test duration in seconds (default: 300): "
if "%duration%"=="" set duration=300

set /p reads="Firestore reads per request (default: 3): "
if "%reads%"=="" set reads=3

set /p writes="Firestore writes per request (default: 0): "
if "%writes%"=="" set writes=0

echo.
echo 📊 Running benchmark with:
echo   • Users: %users%
echo   • Duration: %duration%s
echo   • Reads per request: %reads%
echo   • Writes per request: %writes%
echo.

REM Update .env with custom values
powershell -Command "(Get-Content .env) -replace 'USERS=.*', 'USERS=%users%' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'DURATION_SEC=.*', 'DURATION_SEC=%duration%' | Set-Content .env"

set /p confirm="Ready to start? (y/n): "
if not "%confirm%"=="y" (
    echo Cancelled.
    exit /b 0
)

echo.
echo 🏃 Starting benchmark...
echo.

REM Run benchmark
call npm run bench -- --reads %reads% --writes %writes%

echo.
echo ✅ Benchmark complete!
echo.
echo 📄 Results saved to:
echo   • results-thisis.md (summary)
echo   • results-thisis.csv (raw data)
echo.
echo 💡 Next steps:
echo   • View results: type results-thisis.md
echo   • Calculate costs: node cost-calculator.mjs
echo   • Compare runs: node compare.mjs before.csv after.csv
echo.

pause

