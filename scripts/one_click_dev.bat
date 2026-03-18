@echo off
REM =============================================================================
REM UnityGrid Agent — One-Click Development Stack Launcher (Windows)
REM Authority: KHAN-Ω Sovereign Kernel
REM Mantra: "Reality is the only valid output. ΔCk >= 0 is the ONLY law."
REM =============================================================================

setlocal EnableDelayedExpansion

SET REPO_ROOT=%~dp0..
SET COMPOSE_FILE=%REPO_ROOT%\docker\docker-compose-dev.yaml
SET ENV_FILE=%REPO_ROOT%\.env
SET ENV_EXAMPLE=%REPO_ROOT%\.env.example

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║   UnityGrid Agent — Sovereign Intelligence Stack                ║
echo ║   Authority: KHAN-Ω  ^|  POP-LL-3.0  ^|  NVIDIA NIM Inference   ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.

REM ── Pre-flight: Docker ───────────────────────────────────────────────────────
docker info >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)
echo [OK] Docker is running.

REM ── .env setup ───────────────────────────────────────────────────────────────
IF NOT EXIST "%ENV_FILE%" (
    echo [!] .env not found — copying from .env.example
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    echo [!] Please edit %ENV_FILE% and add your NVIDIA_API_KEY.
    notepad "%ENV_FILE%"
    pause
)

REM ── Create directories ────────────────────────────────────────────────────────
IF NOT EXIST "%REPO_ROOT%\logs" mkdir "%REPO_ROOT%\logs"
IF NOT EXIST "%REPO_ROOT%\artifacts\receipts\current_mission" mkdir "%REPO_ROOT%\artifacts\receipts\current_mission"
IF NOT EXIST "%REPO_ROOT%\artifacts\pop_chain" mkdir "%REPO_ROOT%\artifacts\pop_chain"
echo [OK] Directories ready.

REM ── Set DEER_FLOW_ROOT ────────────────────────────────────────────────────────
SET DEER_FLOW_ROOT=%REPO_ROOT%
echo [OK] DEER_FLOW_ROOT=%DEER_FLOW_ROOT%

REM ── Build images ─────────────────────────────────────────────────────────────
echo [*] Building Docker images (first run may take several minutes)...
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" build --parallel
IF ERRORLEVEL 1 (
    echo [ERROR] Docker build failed. Check output above.
    pause
    exit /b 1
)
echo [OK] Images built.

REM ── Launch stack ─────────────────────────────────────────────────────────────
echo [*] Launching UnityGrid Agent stack...
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" up -d
IF ERRORLEVEL 1 (
    echo [ERROR] Stack launch failed.
    pause
    exit /b 1
)
echo [OK] Stack launched.

REM ── Wait and print endpoints ──────────────────────────────────────────────────
echo.
echo Waiting 15 seconds for services to start...
timeout /t 15 /nobreak >nul

echo.
echo ══════════════════════════════════════════════════════════════════
echo   UnityGrid Agent is running!
echo.
echo   Frontend UI:           http://localhost:2026
echo   API Gateway:           http://localhost:2026/api
echo   API Docs (Swagger):    http://localhost:2026/api/docs
echo   LangGraph Studio:      http://localhost:2026/langgraph
echo.
echo   Live POP-LL-3.0 Receipts Stream (SSE):
echo     curl -N http://localhost:2026/api/receipts/stream
echo.
echo   Audit Log (last 100 receipts):
echo     curl http://localhost:2026/api/receipts/history
echo.
echo   Chain Head (latest POP hash):
echo     curl http://localhost:2026/api/receipts/head
echo.
echo   Stop the stack:
echo     docker compose -f docker\docker-compose-dev.yaml down
echo.
echo   Mantra: Reality is the only valid output. DeltaCk >= 0 is the ONLY law.
echo ══════════════════════════════════════════════════════════════════
echo.

REM Open browser
start http://localhost:2026

pause
