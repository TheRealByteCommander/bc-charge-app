@echo off
REM Nutzt Node 22 aus Cursor, falls im PATH nur Node 16 liegt (Vite bricht sonst ab)
set "CURSOR_NODE=D:\cursor\resources\app\resources\helpers"
if exist "%CURSOR_NODE%\node.exe" (
  set "PATH=%CURSOR_NODE%;%PATH%"
) else (
  echo WARNUNG: Cursor-Node nicht gefunden unter %CURSOR_NODE%
  echo Bitte Node 18+ von https://nodejs.org/ installieren.
)
cd /d "%~dp0"
echo.
echo Node:
node -v
echo.
call npm run dev:all
if errorlevel 1 pause
