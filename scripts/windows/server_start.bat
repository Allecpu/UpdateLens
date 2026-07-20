@echo off
setlocal

cd /d "%~dp0\..\.."

echo [1/6] Stopping server on port 4000 (if running)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000"') do (
  taskkill /f /pid %%a >nul 2>nul
)

echo [2/6] Stopping frontend on port 5173 (if running)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do (
  taskkill /f /pid %%a >nul 2>nul
)




echo [5/6] Starting server...
start "UpdateLens API" cmd /k "npm run server:dev"

echo [6/6] Starting frontend...
start "UpdateLens Frontend" cmd /k "npm run dev"
echo Done.
goto :eof

:error
echo Update failed. Server not restarted.
exit /b 1
