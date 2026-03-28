#!/bin/bash
# Rebuild node-pty after GSD update
# Usage: ./rebuild-pty.sh
set -e

PTY_DIR="/usr/local/lib/node_modules/gsd-pi/dist/web/standalone/node_modules/node-pty"
ARCH=$(uname -m)

if [ ! -d "$PTY_DIR" ]; then
  echo "[rebuild-pty] node-pty directory not found, skipping"
  exit 0
fi

# Check if node-pty already works
if node -e "require('$PTY_DIR');process.exit(0)" 2>/dev/null; then
  echo "[rebuild-pty] node-pty already works, skipping"
  exit 0
fi

echo "[rebuild-pty] Rebuilding node-pty for $ARCH..."

cd "$PTY_DIR"
npm install node-addon-api 2>/dev/null
npm rebuild
node -e "require('.');console.log('[rebuild-pty] node-pty compiled OK')"

# Copy to prebuilds
mkdir -p "prebuilds/linux-$ARCH"
cp build/Release/pty.node "prebuilds/linux-$ARCH/pty.node"

# Clean other platforms
for dir in prebuilds/darwin-* prebuilds/win32-*; do
  [ -d "$dir" ] && rm -rf "$dir"
done

echo "[rebuild-pty] Done"
