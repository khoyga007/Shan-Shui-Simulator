@echo off
rem InkDragon WebGL test: local server + browser at game mode
cd /d "%~dp0web"
rem free the port if an older run.bat server is still up
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:8099" ^| findstr LISTENING') do taskkill /pid %%p /f >nul 2>&1
start "InkDragon server" /min python -m http.server 8099 --bind 127.0.0.1
rem wait until the server answers before opening the page (opening first gave a blank tab)
:wait
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8099/ | Out-Null); exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto wait
start "" "http://127.0.0.1:8099/?game=1&v=%RANDOM%"
