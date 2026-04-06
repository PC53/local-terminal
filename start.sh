#!/bin/bash
set -e
cd "$(dirname "$0")"

echo ""
echo "====================================================="
echo "  LOCAL TERMINAL - Financial Data Terminal"
echo "====================================================="
echo ""
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt -q

echo "Starting server at http://localhost:8000"
echo "Press Ctrl+C to stop."
echo ""

# Open browser after brief delay
(sleep 2 && (open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null || true)) &

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
