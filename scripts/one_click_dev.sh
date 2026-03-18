#!/usr/bin/env bash
# =============================================================================
# UnityGrid Agent — One-Click Development Stack Launcher
# Authority: KHAN-Ω Sovereign Kernel
# Mantra: "Reality is the only valid output. ΔCk ≥ 0 is the ONLY law."
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker/docker-compose-dev.yaml"
ENV_FILE="${REPO_ROOT}/.env"
ENV_EXAMPLE="${REPO_ROOT}/.env.example"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

banner() {
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║   🌸  UnityGrid Agent — Sovereign Intelligence Stack  🕉         ║"
  echo "║   Authority: KHAN-Ω  |  POP-LL-3.0  |  NVIDIA NIM Inference    ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

step() { echo -e "${GREEN}[✓]${RESET} ${BOLD}$*${RESET}"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
fail() { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
  step "Running pre-flight checks..."

  command -v docker >/dev/null 2>&1 || fail "Docker not found. Install Docker Desktop or Docker Engine."
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || fail "Docker daemon is not running."

  # Check for GPU runtime (optional — warn only)
  if docker info 2>/dev/null | grep -q "nvidia"; then
    step "NVIDIA GPU runtime detected (--gpus all available)"
  else
    warn "NVIDIA GPU runtime not detected. Inference will run on CPU via NIM API."
  fi

  # Ensure .env exists
  if [[ ! -f "${ENV_FILE}" ]]; then
    warn ".env not found — copying from .env.example"
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    warn "Please edit ${ENV_FILE} and add your NVIDIA_API_KEY before proceeding."
    echo ""
    read -rp "Press ENTER to continue after editing .env, or Ctrl-C to abort: "
  fi

  # Validate NVIDIA_API_KEY is set
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  if [[ -z "${NVIDIA_API_KEY:-}" ]] || [[ "${NVIDIA_API_KEY}" == "nvapi-your-key-here" ]]; then
    warn "NVIDIA_API_KEY is not set or is still the placeholder value."
    warn "Inference will fall back to any other configured LLM provider."
  else
    step "NVIDIA_API_KEY detected (${NVIDIA_API_KEY:0:12}...)"
  fi

  step "Pre-flight checks passed."
}

# ── Create required directories ───────────────────────────────────────────────
setup_dirs() {
  step "Creating required directories..."
  mkdir -p "${REPO_ROOT}/logs"
  mkdir -p "${REPO_ROOT}/artifacts/receipts/current_mission"
  mkdir -p "${REPO_ROOT}/artifacts/pop_chain"
  step "Directories ready."
}

# ── Export DEER_FLOW_ROOT for docker-compose ──────────────────────────────────
export_env() {
  export DEER_FLOW_ROOT="${REPO_ROOT}"
  step "DEER_FLOW_ROOT=${DEER_FLOW_ROOT}"
}

# ── Pull / build images ───────────────────────────────────────────────────────
build_images() {
  step "Building Docker images (this may take a few minutes on first run)..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build --parallel
  step "Images built."
}

# ── Launch stack ──────────────────────────────────────────────────────────────
launch_stack() {
  step "Launching UnityGrid Agent stack..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d
  step "Stack launched."
}

# ── Wait for health ───────────────────────────────────────────────────────────
wait_healthy() {
  step "Waiting for services to become healthy..."
  local max_wait=120
  local elapsed=0
  local interval=5

  while [[ ${elapsed} -lt ${max_wait} ]]; do
    local gateway_health
    gateway_health=$(docker inspect --format='{{.State.Health.Status}}' unitygrid-gateway 2>/dev/null || echo "starting")

    if [[ "${gateway_health}" == "healthy" ]]; then
      step "Gateway is healthy."
      break
    fi

    echo -e "  ${YELLOW}Waiting for gateway... (${elapsed}s / ${max_wait}s)${RESET}"
    sleep ${interval}
    elapsed=$((elapsed + interval))
  done

  if [[ ${elapsed} -ge ${max_wait} ]]; then
    warn "Gateway health check timed out. Check logs: docker compose -f ${COMPOSE_FILE} logs gateway"
  fi
}

# ── Print live receipts stream info ──────────────────────────────────────────
print_endpoints() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  UnityGrid Agent is running!${RESET}"
  echo ""
  echo -e "  ${GREEN}Frontend UI:${RESET}           http://localhost:2026"
  echo -e "  ${GREEN}API Gateway:${RESET}           http://localhost:2026/api"
  echo -e "  ${GREEN}API Docs (Swagger):${RESET}    http://localhost:2026/api/docs"
  echo -e "  ${GREEN}LangGraph Studio:${RESET}      http://localhost:2026/langgraph"
  echo ""
  echo -e "  ${YELLOW}Live POP-LL-3.0 Receipts Stream (SSE):${RESET}"
  echo -e "  ${BOLD}  curl -N http://localhost:2026/api/receipts/stream${RESET}"
  echo ""
  echo -e "  ${YELLOW}Audit Log (last 100 receipts):${RESET}"
  echo -e "  ${BOLD}  curl http://localhost:2026/api/receipts/history${RESET}"
  echo ""
  echo -e "  ${YELLOW}Chain Head (latest POP hash):${RESET}"
  echo -e "  ${BOLD}  curl http://localhost:2026/api/receipts/head${RESET}"
  echo ""
  echo -e "  ${YELLOW}Stop the stack:${RESET}"
  echo -e "  ${BOLD}  docker compose -f ${COMPOSE_FILE} down${RESET}"
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  Mantra: Reality is the only valid output. ΔCk ≥ 0 is the ONLY law.${RESET}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${RESET}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  banner
  preflight
  setup_dirs
  export_env
  build_images
  launch_stack
  wait_healthy
  print_endpoints
}

main "$@"
