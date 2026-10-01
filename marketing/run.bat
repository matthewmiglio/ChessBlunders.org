@echo off
rem Daily "come back" email send. Scheduled as ChessBlundersComeback; removes itself once nobody is left.
cd /d "%~dp0"
if not exist logs mkdir logs
python send.py >> logs\send.log 2>&1
if %ERRORLEVEL%==3 schtasks /delete /tn ChessBlundersComeback /f >> logs\send.log 2>&1
