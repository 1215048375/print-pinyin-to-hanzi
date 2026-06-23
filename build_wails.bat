@echo off
setlocal
cd /d "%~dp0"

set "GOCACHE=%CD%\.gocache"
if not exist "%GOCACHE%" mkdir "%GOCACHE%"

wails build -platform windows/amd64 -s -m -trimpath
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Built: %CD%\build\bin\pinyin-tianzige.exe
pause
