# UnityGrid Agent Flow — Security Audit Report
**Date**: 2026-03-18  
**Auditor**: Vishvakarma-Ω Integration Protocol  
**Scope**: Frontend source, env files, git history, provider adapters

---

## Secrets Scan Results

| Check | Status | Notes |
|-------|--------|-------|
| `nvapi-*` keys in source | PASS — None found | Placeholder `nvapi-your-key-here` in .env.local only |
| `sk-*` keys in source | PASS — None found | |
| `sk-ant-*` keys in source | PASS — None found | |
| `.env.local` tracked by git | PASS — Not tracked | Excluded by .gitignore |
| `.env` tracked by git | PASS — Not tracked | Only `.env.example` is tracked |
| Hardcoded API base URLs | PASS — All via env vars | `NEMO_API_BASE`, `NIM_BASE_URL` |

---

## Provider Architecture

| Provider | Status | Activation |
|----------|--------|------------|
| NVIDIA NIM (Nemotron-70B) | **ACTIVE — DEFAULT** | Always enabled |
| OpenRouter | Disabled | Set `PROVIDERS_ENABLED=NIM,OPENROUTER` + `OPENROUTER_API_KEY` |
| Anthropic | Disabled | Set `PROVIDERS_ENABLED=NIM,ANTHROPIC` + `ANTHROPIC_API_KEY` |

**Failover policy**: If NIM returns 5xx or times out AND OpenRouter is enabled, the router automatically fails over to OpenRouter and surfaces a console warning.

---

## Branding Sweep Results

| Check | Status |
|-------|--------|
| "DeerFlow" / "Deer Flow" strings | PASS — None in UI |
| "deerflow" strings | PASS — None in UI |
| "ByteDance" references | PASS — Replaced with BeneElohim/unitygrid-uiflow |
| Deer emoji (🦌) | PASS — Removed from About page |
| DEER acronym expansion | PASS — Removed from About page |
| Third-party model names (Doubao, DeepSeek, GPT-5, Gemini) | PASS — Mock API returns NIM models only |
| "Open in ChatGPT / Claude / T3 / Scira" buttons | PASS — Wrapped in ProviderSelectorGate (hidden when locked) |

---

## .gitignore Hardening

Added exclusions:
- `.env.local`, `.env.*.local`, `.env.production`, `.env.staging`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`
- `nvapi-*`, `sk-*` (pattern-based key file exclusion)
- `frontend/.next/`, `frontend/out/`, `frontend/node_modules/`

---

## Symbols Not Renamed

Per guardrail: *"Do not rename code symbols unless they are user-facing labels."*

The following internal symbols retain their original names as they are not user-facing:
- `nemoClient()` — internal function name (not exposed in UI)
- `openrouterClient()` — internal function name
- `anthropicClient()` — internal function name
- `ChatArgs`, `Provider` — TypeScript interfaces

---

## Recommendations

1. **Rotate API key before production**: Replace `nvapi-your-key-here` placeholder with a real key from [build.nvidia.com](https://build.nvidia.com) via secure vault injection.
2. **Enable GitHub secret scanning**: Activate GitHub's built-in secret scanning on the `BeneElohim/unitygrid-uiflow` repository.
3. **Set repo to private**: Confirm repository visibility is private on GitHub.
