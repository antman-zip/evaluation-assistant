@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo         Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not available in PATH.
  pause
  exit /b 1
)

if not exist "node_modules\\next\\dist\\bin\\next" (
  echo [INFO] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting Next.js dev server...
echo [INFO] Open: http://localhost:3000
start "" "http://localhost:3000"
call npm run dev

set EXIT_CODE=%errorlevel%
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Dev server exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
