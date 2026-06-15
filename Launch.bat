@echo off
echo ============================================
echo   Snake — The Way of the Serpent
echo ============================================
echo.
echo Starting leaderboard server...
start "Snake Server" cmd /c "cd /d %~dp0 && node server.js"
echo.
echo Opening game in browser...
start "" "%~dp0index.html"
echo.
echo Server: http://localhost:3456
echo Game: file://%~dp0index.html
echo.
echo Close this window or press Ctrl+C in the server window to stop.
