@echo off
setlocal
cd /d "%~dp0"
echo ------------------------------------------
echo Domain Guardian: Local-only test server
echo ------------------------------------------
echo This server binds to 127.0.0.1:8765 only.
echo Close this window to stop.
echo.
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 "%~dp0test_server.py"
) else (
    python "%~dp0test_server.py"
)
if errorlevel 1 (
    echo.
    echo Python 3 is required, or TCP port 8765 is busy.
    pause
)
