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
rem
rem Outputs:
rem   buccet-physwrap.exe        — main physics wrapper (Job Object, DLL injection)
rem   buccet-ioboundary.dll      — Tier 2b I/O boundary hook DLL (IAT patching)
rem
rem Both binaries must be in the same directory at runtime. physwrap.exe
rem resolves the DLL path by taking its own directory + buccet-ioboundary.dll.

setlocal

set "SCRIPT_DIR=%~dp0"
set "OUT_DIR=%~1"
if "%OUT_DIR%"=="" set "OUT_DIR=%SCRIPT_DIR%build"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

set "EXE_BIN=%OUT_DIR%\buccet-physwrap.exe"
set "EXE_SRC=%SCRIPT_DIR%physwrap_win.c"

set "DLL_BIN=%OUT_DIR%\buccet-ioboundary.dll"
set "DLL_SRC=%SCRIPT_DIR%buccet_ioboundary_win.c"

rem ── Build buccet-physwrap.exe ──────────────────────────────────────────────

echo Building %EXE_BIN% from %EXE_SRC%

cl.exe /nologo /O2 /W3 /Fe:"%EXE_BIN%" "%EXE_SRC%" kernel32.lib

if %errorlevel% neq 0 (
    echo buccet-physwrap(windows): buccet-physwrap.exe build failed
    exit /b %errorlevel%
)

echo Build OK: %EXE_BIN%

rem ── Build buccet-ioboundary.dll ───────────────────────────────────────────
rem
rem /LD         — build as DLL
rem psapi.lib   — for EnumProcessModules (module enumeration in DllMain)

echo Building %DLL_BIN% from %DLL_SRC%

cl.exe /nologo /O2 /W3 /LD /Fe:"%DLL_BIN%" "%DLL_SRC%" kernel32.lib psapi.lib

if %errorlevel% neq 0 (
    echo buccet-physwrap(windows): buccet-ioboundary.dll build failed
    exit /b %errorlevel%
)

echo Build OK: %DLL_BIN%

echo.
echo Windows Tier 2b build complete.
echo   %EXE_BIN%
echo   %DLL_BIN%

endlocal
