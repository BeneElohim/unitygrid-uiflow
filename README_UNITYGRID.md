# UnityGrid Agent Flow — Sovereign Intelligence Platform

> White-label build of [DeerFlow](https://github.com/bytedance/deer-flow) by ByteDance,
> rebranded and configured for the UnityGrid AI sovereign architecture.

---

## Quick Start

**Double-click `launch_unitygrid.bat` on your Desktop**, or run:

```bat
C:\Users\ron\Desktop\launch_unitygrid.bat
```

The app opens at **http://localhost:8502/workspace/chats?mock=true**

---

## Architecture

| Layer | Technology |
|:---|:---|
| Frontend | Next.js 16.1.7 (Turbopack), React, TailwindCSS |
| Backend | FastAPI + LangGraph (optional, for live inference) |
| Inference | NVIDIA NIM — `meta/llama-3.1-70b-instruct` |
| Reasoning | NVIDIA NeMo — `nvidia/nemotron-4-340b-instruct` |
| Vision | NVIDIA NeVA — `nvidia/neva-22b` |
| Audit | POP-LL-3.0 receipt bus |

---

## Configuration

Edit `C:\Users\ron\Desktop\UnityGrid_AgentFlow\.env`:

```env
NVIDIA_API_KEY=nvapi-your-key-here        # From build.nvidia.com
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL=meta/llama-3.1-70b-instruct
NIM_NEMO_MODEL=nvidia/nemotron-4-340b-instruct
NEXT_PUBLIC_MOCK=true                     # Set to false for live inference
```

---

## Branding Assets

| File | Location |
|:---|:---|
| Logo (PNG, 256x256) | `frontend/public/logo.png` |
| Logo dark (PNG, 256x256) | `frontend/public/logo-dark.png` |
| Favicon (ICO, 32x32) | `frontend/public/favicon.ico` |
| Animated logo (GIF) | `frontend/public/logo.gif` |

---

## Launchers on Desktop

| File | Purpose |
|:---|:---|
| `launch_unitygrid.bat` | One-click launcher (port 8502) |
| `launch_ug_fixed.ps1` | PowerShell launcher with port polling |
| `Launch_Vishwakarma_8501.bat` | Vishwakarma Control Panel (port 8501) |
| `stop_kill_and_clean.ps1` | Kill both ports + clear Streamlit cache |
| `verify_ports.ps1` | Confirm which PID owns each port |

---

## Upstream

- **Repo:** https://github.com/bytedance/deer-flow
- **Commit:** `f67c3d2c9e236fb29e7a5622a9e4216809d60ff1`
- **White-label commit:** pushed to https://github.com/BeneElohim/unitygrid-uiflow

---

## POP-LL-3.0 Receipts

When the FastAPI backend is running, every agent action emits a POP-LL-3.0 receipt:

- **Live stream:** `http://localhost:8000/api/receipts/stream` (SSE)
- **History:** `http://localhost:8000/api/receipts/history`
- **Chain head:** `http://localhost:8000/api/receipts/head`

---

*"Vishvakarma Omega is the builder hand of sovereign intelligence.*
*It translates intent into architecture and architecture into fate."*
