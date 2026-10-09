@echo off
REM
REM VICTOR - start the local development stack.
REM
REM Thin wrapper around scripts\dev.py for cmd.exe and PowerShell, so the stack
REM starts from the repository root regardless of the current directory.
REM All arguments are forwarded:
REM
REM     dev.cmd
REM     dev.cmd --backend-only
REM     dev.cmd --backend-port 8001 --open
REM
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    python scripts\dev.py %*
    exit /b %errorlevel%
)

where py >nul 2>nul
if %errorlevel%==0 (
    py scripts\dev.py %*
    exit /b %errorlevel%
)

echo Python 3.11+ was not found on PATH.
echo Install it from https://www.python.org/downloads/
exit /b 1
