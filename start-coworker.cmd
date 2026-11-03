@echo off
cd /d "%~dp0coworker"
node server.mjs
if errorlevel 1 pause
