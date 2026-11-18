@echo off
rem InkDragon test room (white room, head = cursor, dev tools): local server + own Chrome window on the GTX
cd /d "%~dp0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:8099" ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>&1
start "InkDragon server" /min python tools\devserver.py 8099
:wait
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8099/room/ | Out-Null); exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto wait
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --user-data-dir="%LOCALAPPDATA%\InkDragon\chrome" --force_high_performance_gpu --no-first-run --start-maximized --app="http://127.0.0.1:8099/room/?v=%RANDOM%"
) else (
  start "" "http://127.0.0.1:8099/room/?v=%RANDOM%"
)
