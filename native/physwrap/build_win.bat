@echo off
rem
rem Build buccet-physwrap for Windows using MSVC (cl.exe).
rem Requires Visual Studio Build Tools or the Developer Command Prompt.
rem
rem For MinGW/MSYS2/Cygwin, use build.sh instead.
rem
rem Usage:
rem   build_win.bat [OUT_DIR]
rem
rem OUT_DIR defaults to build\ relative to this script's directory.

setlocal

set "SCRIPT_DIR=%~dp0"
set "OUT_DIR=%~1"
if "%OUT_DIR%"=="" set "OUT_DIR=%SCRIPT_DIR%build"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

set "OUT_BIN=%OUT_DIR%\buccet-physwrap.exe"
set "SRC=%SCRIPT_DIR%physwrap_win.c"

echo Building %OUT_BIN% from %SRC%

cl.exe /nologo /O2 /W3 /Fe:"%OUT_BIN%" "%SRC%" kernel32.lib

if %errorlevel% neq 0 (
    echo buccet-physwrap(windows): cl.exe build failed
    exit /b %errorlevel%
)

echo Build OK: %OUT_BIN%
endlocal
