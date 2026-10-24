@echo off
cd /d "%~dp0"
echo Starting a temporary HTTPS link for Bonk Up on localhost:3001.
echo Keep the game server and this window open while testing on mobile.
echo.
node scripts/mobile-link.mjs
echo.
echo The mobile link has stopped.
pause
