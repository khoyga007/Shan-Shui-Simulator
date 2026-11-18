#!/bin/sh
# The dragon has one source: the wallpaper's D:\Tools\DragonWallpaper\dragon.js. The test room runs a copy of it.
# Edit the wallpaper file, then run this. Never edit web/room/dragon.js by hand.
set -e
cd "$(dirname "$0")/.."
cp /d/Tools/DragonWallpaper/dragon.js web/room/dragon.js
echo "synced: $(wc -l < web/room/dragon.js) lines"
