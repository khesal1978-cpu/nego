@echo off
cd /d "%~dp0"
echo Starting Bonk Up. Open the "Game preview ready" URL printed below.
echo If port 3000 is occupied, the server will try the next free port.
echo Keep this window open while playing.
call npm.cmd run dev
echo.
echo The game server has stopped.
pause
