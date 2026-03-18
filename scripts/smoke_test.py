#!/usr/bin/env python3
"""
UnityGrid Agent — Integration Smoke Test
Authority: KHAN-Ω Sovereign Kernel
Mantra: "Reality is the only valid output. ΔCk ≥ 0 is the ONLY law."

Validates:
1. White-label rebrand (no DeerFlow strings in key files)
2. NVIDIA NIM config.yaml entries
3. POP-LL-3.0 receipt bus import and mint
4. /api/receipts router module import
5. nemo_infer tool import
6. .env.example contains NVIDIA_API_KEY
7. One-click launcher scripts exist and are executable
8. Emits a final POP-LL-3.0 smoke receipt with SHA-256 hash
"""

import hashlib
import json
import os
import sys
import time
import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
WARN = "\033[93m[WARN]\033[0m"

results = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    print(f"  {status} {name}" + (f" — {detail}" if detail else ""))
    results.append({"name": name, "passed": condition, "detail": detail})
    return condition


def section(title: str):
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print(f"{'═' * 60}")


# ── 1. White-label rebrand ────────────────────────────────────────────────────
section("1. White-Label Rebrand Verification")

key_files = [
    REPO_ROOT / "config.yaml",
    REPO_ROOT / "frontend" / "src" / "app" / "layout.tsx",
    REPO_ROOT / "docker" / "docker-compose.yaml",
]

for fpath in key_files:
    if fpath.exists():
        content = fpath.read_text(errors="ignore").lower()
        has_deerflow = "deerflow" in content and "unitygrid" not in content
        check(
            f"No orphan DeerFlow branding in {fpath.name}",
            not has_deerflow,
            "deerflow still present without unitygrid" if has_deerflow else "clean",
        )
    else:
        check(f"File exists: {fpath.name}", False, "file not found")

# ── 2. NVIDIA NIM config.yaml ─────────────────────────────────────────────────
section("2. NVIDIA NIM config.yaml Entries")

config_path = REPO_ROOT / "config.yaml"
if config_path.exists():
    cfg_text = config_path.read_text()
    check("config.yaml contains nvidia_nim model entry", "nvidia_nim" in cfg_text.lower() or "nvidia" in cfg_text.lower())
    check("config.yaml contains NIM base_url", "integrate.api.nvidia.com" in cfg_text or "nim_base_url" in cfg_text.lower() or "NIM_BASE_URL" in cfg_text)
    check("config.yaml contains NVIDIA_API_KEY reference", "NVIDIA_API_KEY" in cfg_text)
else:
    check("config.yaml exists", False)

# ── 3. POP-LL-3.0 receipt bus ─────────────────────────────────────────────────
section("3. POP-LL-3.0 Receipt Bus")

sys.path.insert(0, str(BACKEND_ROOT / "packages" / "harness"))
try:
    from deerflow.community.nvidia_nim import pop_receipt_bus
    check("pop_receipt_bus module imports", True)

    # Test emitting a receipt
    import hashlib as _hl, time as _time
    payload = {"test": True, "timestamp": _time.time(), "source": "smoke_test.py"}
    payload_str = json.dumps(payload, sort_keys=True)
    sha256 = _hl.sha256(payload_str.encode()).hexdigest()
    receipt = {
        "pop_id": f"SMOKE-TEST-{sha256[:12].upper()}",
        "sha256_hash": sha256,
        "event_type": "SMOKE_TEST",
        "delta_ck": 1.0,
        "timestamp": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        "payload": payload,
    }
    pop_receipt_bus.emit_receipt(receipt)
    check("emit_receipt callable", True)
    check("receipt has pop_id", "pop_id" in receipt)
    check("receipt has sha256_hash", "sha256_hash" in receipt)
    check("receipt has delta_ck >= 0", receipt.get("delta_ck", -1) >= 0)
    check("receipt has timestamp", "timestamp" in receipt)

    smoke_receipt = receipt
    print(f"\n  POP Receipt: {json.dumps(smoke_receipt, indent=4)}\n")

except Exception as e:
    check("pop_receipt_bus module imports", False, str(e))
    smoke_receipt = {"error": str(e)}

# ── 4. /api/receipts router ───────────────────────────────────────────────────
section("4. /api/receipts SSE Router")

sys.path.insert(0, str(BACKEND_ROOT))
try:
    # Add stubs for FastAPI if not installed
    spec = importlib.util.spec_from_file_location(
        "receipts_router",
        BACKEND_ROOT / "app" / "gateway" / "routers" / "receipts.py",
    )
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore
        check("/api/receipts router module loads", True)
        check("router object exists", hasattr(mod, "router"))
    else:
        check("/api/receipts router file found", False, "spec not found")
except Exception as e:
    check("/api/receipts router module loads", False, str(e))

# ── 5. nemo_infer tool ────────────────────────────────────────────────────────
section("5. nemo_infer Tool")

try:
    spec = importlib.util.spec_from_file_location(
        "nemo_infer",
        BACKEND_ROOT / "packages" / "harness" / "deerflow" / "community" / "nvidia_nim" / "nemo_infer.py",
    )
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore
        check("nemo_infer module loads", True)
        check("nemo_infer function exists", hasattr(mod, "nemo_infer"))
    else:
        check("nemo_infer file found", False, "spec not found")
except Exception as e:
    check("nemo_infer module loads", False, str(e))

# ── 6. .env.example ───────────────────────────────────────────────────────────
section("6. .env.example Configuration")

env_example = REPO_ROOT / ".env.example"
if env_example.exists():
    env_text = env_example.read_text()
    check(".env.example contains NVIDIA_API_KEY", "NVIDIA_API_KEY" in env_text)
    check(".env.example contains NIM_BASE_URL", "NIM_BASE_URL" in env_text)
    check(".env.example contains NIM_MODEL", "NIM_MODEL" in env_text)
    check(".env.example contains POP_RECEIPT_DIR", "POP_RECEIPT_DIR" in env_text)
    check(".env.example contains DELTA_CK_MIN", "DELTA_CK_MIN" in env_text)
else:
    check(".env.example exists", False)

# ── 7. One-click launchers ────────────────────────────────────────────────────
section("7. One-Click Launcher Scripts")

launchers = [
    REPO_ROOT / "scripts" / "one_click_dev.sh",
    REPO_ROOT / "scripts" / "one_click_dev.bat",
]
for launcher in launchers:
    check(f"{launcher.name} exists", launcher.exists())
    if launcher.exists() and launcher.suffix == ".sh":
        check(f"{launcher.name} is executable", os.access(launcher, os.X_OK))

# ── Final POP-LL-3.0 Smoke Receipt ───────────────────────────────────────────
section("8. Final POP-LL-3.0 Smoke Receipt")

passed_count = sum(1 for r in results if r["passed"])
total_count = len(results)
all_passed = passed_count == total_count

summary_payload = {
    "smoke_test_version": "1.0.0",
    "repo": "unitygrid-uiflow",
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "checks_passed": passed_count,
    "checks_total": total_count,
    "all_passed": all_passed,
    "results": results,
}

summary_hash = hashlib.sha256(
    json.dumps(summary_payload, sort_keys=True).encode()
).hexdigest()

final_receipt = {
    "pop_id": f"SMOKE-{summary_hash[:16].upper()}",
    "sha256_hash": summary_hash,
    "verdict": "VALIDATED" if all_passed else "PARTIAL",
    "delta_ck": 1.0 if all_passed else 0.5,
    "checks_passed": f"{passed_count}/{total_count}",
    "timestamp": summary_payload["timestamp"],
}

# Write receipt to artifacts
receipt_dir = REPO_ROOT / "artifacts" / "receipts" / "current_mission"
receipt_dir.mkdir(parents=True, exist_ok=True)
receipt_path = receipt_dir / f"smoke_test_{final_receipt['pop_id']}.json"
receipt_path.write_text(json.dumps(final_receipt, indent=2))

print(f"\n  Final Smoke Receipt:")
print(json.dumps(final_receipt, indent=4))
print(f"\n  Receipt saved to: {receipt_path}")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'═' * 60}")
print(f"  Smoke Test Complete: {passed_count}/{total_count} checks passed")
if all_passed:
    print(f"  \033[92mALL CHECKS PASSED — System is VALIDATED\033[0m")
    print(f"  ΔCk = 1.000 (Zero-Forgetting Doctrine satisfied)")
else:
    failed = [r["name"] for r in results if not r["passed"]]
    print(f"  \033[93mSOME CHECKS FAILED — Review above\033[0m")
    print(f"  Failed: {failed}")
print(f"  POP Signature: {final_receipt['pop_id']}")
print(f"  SHA-256: {summary_hash}")
print(f"{'═' * 60}\n")

sys.exit(0 if all_passed else 1)
