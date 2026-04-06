@echo off
cd /d "%~dp0"
echo.
echo =====================================================
echo   LOCAL TERMINAL - Financial Data Terminal
echo =====================================================
echo.
echo Installing Python dependencies...
pip install -r backend\requirements.txt -q
echo.
echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop.
echo.
start "" "http://localhost:8000"
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
