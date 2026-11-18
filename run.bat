@echo off
rem InkDragon WebGL test: local server + browser at game mode
cd /d "%~dp0web"
start "" http://127.0.0.1:8099/?game=1
python -m http.server 8099 --bind 127.0.0.1
