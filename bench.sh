#!/usr/bin/env bash
# Headless GTX bench of game mode at 1920x1080. Needs a server on :8098 serving web/.
# usage: bash bench.sh [extra query, e.g. "&foo=1"]
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
D="${TMP:-/tmp}/inkdragon-bench-$RANDOM"
timeout 90 "$C" --headless=new --enable-gpu --use-angle=d3d11 --force_high_performance_gpu \
  --window-size=1920,1080 --user-data-dir="$D" \
  --dump-dom "http://127.0.0.1:8098/?game=1&bench=1$1" 2>/dev/null | grep -o '<pre id="bench">[^<]*' | sed 's/<pre id="bench">//'
rm -rf "$D"
