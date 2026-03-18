@echo off
:: ═══════════════════════════════════════════════════════════════════════════
:: UnityGrid Agent Flow — One-Click Launcher (Windows)
:: ═══════════════════════════════════════════════════════════════════════════
:: Installs dependencies, builds, and starts the Next.js app on port 8502.
:: Optionally starts the OpenClaw Gateway on port 3001 if openclaw is found.
::
:: Prerequisites:
::   - Node.js v22+ (https://nodejs.org)
::   - pnpm (npm install -g pnpm) or npm/yarn
::   - openclaw (npm install -g openclaw) — optional, for Gateway features
::
:: Usage: Double-click or run from cmd: Launch-UnityGrid-OpenClaw.bat
:: ═══════════════════════════════════════════════════════════════════════════

set PORT=8502
set NEXT_TELEMETRY_DISABLED=1
set NODE_ENV=production

cd /d "%~dp0frontend"

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║     UnityGrid Agent Flow — Sovereign Intelligence        ║
echo ║     Starting on http://localhost:%PORT%/workspace        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Install dependencies
echo [1/3] Installing dependencies...
call pnpm install --frozen-lockfile 2>nul || call npm ci 2>nul || call yarn install --frozen-lockfile
if errorlevel 1 (
    echo ERROR: Dependency installation failed.
    pause
    exit /b 1
)

:: Build
echo [2/3] Building Next.js app...
call pnpm build 2>nul || call npm run build 2>nul || call yarn build
if errorlevel 1 (
    echo ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)

:: Open browser
echo [3/3] Opening browser...
start "" "http://localhost:%PORT%/workspace"

:: Start OpenClaw Gateway if available (background process)
where openclaw >nul 2>&1
if not errorlevel 1 (
    echo Starting OpenClaw Gateway on port 3001...
    cd /d "%~dp0"
    start /b "" cmd /c "openclaw gateway --config openclaw\configs\unitygrid.gateway.json5 > openclaw\gateway.log 2>&1"
    cd /d "%~dp0frontend"
    echo Gateway started. Log: openclaw\gateway.log
)

:: Start Next.js
echo Starting UnityGrid UI on port %PORT%...
call pnpm start 2>nul || call npm run start 2>nul || call yarn start

pause
