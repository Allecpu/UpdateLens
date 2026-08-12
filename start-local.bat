@echo off
setlocal

REM Avvia UpdateLens in locale (frontend Vite + backend Express in due finestre separate)
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRORE] npm non trovato nel PATH. Installa Node.js e riprova.
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Dipendenze non trovate. Eseguo npm install...
  call npm install
  if errorlevel 1 (
    echo [ERRORE] npm install fallito.
    exit /b 1
  )
)

start "UpdateLens Backend" cmd /k "cd /d "%~dp0" && npm run server:dev"
start "UpdateLens Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo [OK] Servizi avviati:
echo - Frontend: http://localhost:5173
echo - Backend:  avviato in finestra separata (npm run server:dev)
echo.
echo Chiudi le due finestre per fermare i servizi.

endlocal
