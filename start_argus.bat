@echo off
title ARGUS Deception Platform Launcher
echo ======================================================================
echo   Starting ARGUS Platform Services (Backend, Decoy, MySQL, Dashboard)
echo ======================================================================

if exist .venv\Scripts\python.exe (
    set PYTHON_CMD=.venv\Scripts\python.exe
) else (
    set PYTHON_CMD=python
)

%PYTHON_CMD% scripts\run_all.py
pause
