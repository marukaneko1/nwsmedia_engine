#!/usr/bin/env bash
# Kill processes on common dev ports so this app can use 3000
for port in 3000 3001 3002 5000 8080; do
  pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "Killing process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null
  fi
done
# Also kill any stray next dev
pkill -f "next dev" 2>/dev/null || true
sleep 2
echo "Ports cleared. Starting dashboard..."
cd "$(dirname "$0")/.." && npm run dev
