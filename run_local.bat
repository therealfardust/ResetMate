@echo off
cd /d "%~dp0web"
echo Reset Mate Lab: http://localhost:8123
python -m http.server 8123
