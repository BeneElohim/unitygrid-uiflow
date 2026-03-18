#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# UnityGrid Agent Flow — One-Click Launcher (macOS / Linux)
# ═══════════════════════════════════════════════════════════════════════════
# Installs dependencies, builds, and starts the Next.js app on port 8502.
# Optionally starts the OpenClaw Gateway on port 3001 if openclaw is found.
#
# Prerequisites:
#   - Node.js v22+ (https://nodejs.org)
#   - pnpm (npm install -g pnpm) or npm/yarn
#   - openclaw (npm install -g openclaw) — optional, for Gateway features
#
# Usage:
#   chmod +x launch-unitygrid-openclaw.sh
#   ./launch-unitygrid-openclaw.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

export PORT=8502
export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     UnityGrid Agent Flow — Sovereign Intelligence        ║"
echo "║     Starting on http://localhost:$PORT/workspace         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Install dependencies ────────────────────────────────────────────────────
echo "[1/3] Installing dependencies..."
cd "$FRONTEND_DIR"
if command -v pnpm &>/dev/null; then
    pnpm install --frozen-lockfile
elif command -v npm &>/dev/null; then
    npm ci
elif command -v yarn &>/dev/null; then
    yarn install --frozen-lockfile
else
    echo "ERROR: No package manager found (pnpm, npm, or yarn required)."
    exit 1
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo "[2/3] Building Next.js app..."
if command -v pnpm &>/dev/null; then
    pnpm build
elif command -v npm &>/dev/null; then
    npm run build
else
    yarn build
fi

# ── Open browser ─────────────────────────────────────────────────────────────
echo "[3/3] Opening browser..."
if command -v open &>/dev/null; then
    open "http://localhost:$PORT/workspace" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT/workspace" 2>/dev/null || true
fi

# ── Start OpenClaw Gateway (background) ──────────────────────────────────────
if command -v openclaw &>/dev/null; then
    echo "Starting OpenClaw Gateway on port 3001..."
    mkdir -p "$SCRIPT_DIR/openclaw"
    openclaw gateway \
        --config "$SCRIPT_DIR/openclaw/configs/unitygrid.gateway.json5" \
        > "$SCRIPT_DIR/openclaw/gateway.log" 2>&1 &
    GATEWAY_PID=$!
    echo "Gateway PID: $GATEWAY_PID (log: openclaw/gateway.log)"
else
    echo "openclaw not found — Gateway features will show offline state."
    echo "Install: npm install -g openclaw (requires Node.js v22+)"
fi

# ── Start Next.js ─────────────────────────────────────────────────────────────
echo "Starting UnityGrid UI on port $PORT..."
if command -v pnpm &>/dev/null; then
    pnpm start
elif command -v npm &>/dev/null; then
    npm run start
else
    yarn start
fi
