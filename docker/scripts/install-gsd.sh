#!/bin/bash
set -e

ARCH=$(uname -m)
PTY_DIR="/usr/local/lib/node_modules/gsd-pi/dist/web/standalone/node_modules/node-pty"

echo "[install-gsd] Platform: $(uname -s) $ARCH"

# 1. Install GSD
npm install -g gsd-pi
npm cache clean --force

# 2. Handle node-pty based on architecture
if [ -d "$PTY_DIR" ]; then
  # Test if node-pty already works (x64 has prebuild)
  if node -e "require('$PTY_DIR');process.exit(0)" 2>/dev/null; then
    echo "[install-gsd] node-pty prebuild OK — skipping compile"
  else
    echo "[install-gsd] node-pty needs compiling for $ARCH"
    apt-get update && apt-get install -y --no-install-recommends python3 make g++

    cd "$PTY_DIR"
    npm install node-addon-api
    npm rebuild
    node -e "require('.');console.log('[install-gsd] node-pty compiled OK')"

    # Copy to prebuilds so GSD's loader finds it
    mkdir -p "prebuilds/linux-$ARCH"
    cp build/Release/pty.node "prebuilds/linux-$ARCH/pty.node"

    # Keep build tools for future GSD updates (node-pty needs recompile)
    rm -rf /var/lib/apt/lists/*
  fi

  # Remove other-platform prebuilds
  cd "$PTY_DIR"
  for dir in prebuilds/darwin-* prebuilds/win32-*; do
    [ -d "$dir" ] && rm -rf "$dir"
  done
fi

# 3. Cleanup GSD install — remove unnecessary files
GSD_ROOT="/usr/local/lib/node_modules/gsd-pi"

# Source maps (~20MB)
find "$GSD_ROOT" -name '*.map' -delete 2>/dev/null || true

# Keep all text files — GSD reads .md and LICENSE at runtime

# Test directories
find "$GSD_ROOT" -type d \( -name '__tests__' -o -name 'test' -o -name 'tests' \) -exec rm -rf {} + 2>/dev/null || true

# Playwright (not needed in web mode)
rm -rf "$GSD_ROOT/node_modules/playwright-core"

echo "[install-gsd] Done — $(du -sh "$GSD_ROOT" | cut -f1) total"
