@echo off
rem InkDragon WebGL test: local server + own Chrome window at game mode
cd /d "%~dp0web"
rem free the port if an older run.bat server is still up
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:8099" ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>&1
start "InkDragon server" /min python -m http.server 8099 --bind 127.0.0.1
rem wait until the server answers before opening the page (opening first gave a blank tab)
:wait
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8099/ | Out-Null); exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto wait
rem separate Chrome instance (own profile) so the flag applies even while normal Chrome is open:
rem --force_high_performance_gpu = the GTX, not the Intel iGPU Windows gives browsers by default
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --user-data-dir="%LOCALAPPDATA%\InkDragon\chrome" --force_high_performance_gpu --no-first-run --start-maximized --app="http://127.0.0.1:8099/?game=1&v=%RANDOM%"
) else (
  start "" "http://127.0.0.1:8099/?game=1&v=%RANDOM%"
)
