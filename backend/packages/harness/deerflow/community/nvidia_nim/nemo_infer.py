"""
UnityGrid Agent — NVIDIA NIM nemo_infer Tool
============================================
Routes inference requests through NVIDIA's protected NIM endpoint
(https://integrate.api.nvidia.com/v1) and mints a POP-LL-3.0 receipt
for every call, feeding the live /api/receipts SSE stream.

Authority: KHAN-Ω | Audit: POP-LL-3.0
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import uuid
from typing import Any, Optional

import httpx
from langchain_core.tools import tool

from deerflow.community.nvidia_nim.pop_receipt_bus import emit_receipt

logger = logging.getLogger(__name__)

# ── NIM endpoint constants ────────────────────────────────────────────────────
NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"
NIM_DEFAULT_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1"
NIM_TIMEOUT = 120  # seconds


def _nim_api_key() -> str:
    key = os.environ.get("NVIDIA_API_KEY", "")
    if not key:
        raise EnvironmentError(
            "NVIDIA_API_KEY environment variable is not set. "
            "Add it to your .env file to enable NIM inference."
        )
    return key


def _mint_pop_receipt(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: float,
    response_hash: str,
    mission_id: str,
    ok: bool,
) -> dict[str, Any]:
    """Mint a POP-LL-3.0 receipt for a NIM inference call."""
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime())
    payload = {
        "spec": "POP-LL-3.0",
        "receipt_id": f"NIM-{uuid.uuid4().hex[:12].upper()}",
        "mission_id": mission_id,
        "timestamp": timestamp,
        "model": model,
        "endpoint": NIM_BASE_URL,
        "metrics": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "latency_ms": round(latency_ms, 2),
        },
        "response_hash": response_hash,
        "ok": ok,
        "delta_ck": 1.0 if ok else 0.0,
    }
    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    payload["signature"] = hashlib.sha256(raw).hexdigest()
    return payload


@tool
def nemo_infer(
    prompt: str,
    model: str = NIM_DEFAULT_MODEL,
    system_prompt: str = "You are UnityGrid Agent, a sovereign intelligence assistant.",
    max_tokens: int = 2048,
    temperature: float = 0.6,
    mission_id: Optional[str] = None,
) -> str:
    """
    Route an inference request through NVIDIA NIM's protected endpoint.

    This tool calls the NVIDIA NIM API directly (bypassing LangChain's
    model factory) for cases where raw NIM access is needed — e.g.,
    embedding generation, structured output, or low-latency sub-tasks.
    Every call mints a POP-LL-3.0 receipt and emits it to the live
    /api/receipts SSE stream.

    Args:
        prompt: The user prompt to send to the NIM model.
        model: NIM model identifier (default: Nemotron-Ultra-253B).
        system_prompt: System message to prepend.
        max_tokens: Maximum tokens in the completion.
        temperature: Sampling temperature (0.0–1.0).
        mission_id: Optional RMMU mission ID for receipt tagging.

    Returns:
        The model's text response.
    """
    if mission_id is None:
        mission_id = f"NEMO-{uuid.uuid4().hex[:8].upper()}"

    headers = {
        "Authorization": f"Bearer {_nim_api_key()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": False,
    }

    start = time.monotonic()
    ok = False
    response_text = ""
    prompt_tokens = 0
    completion_tokens = 0

    try:
        with httpx.Client(timeout=NIM_TIMEOUT) as client:
            resp = client.post(
                f"{NIM_BASE_URL}/chat/completions",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            ok = True
    except httpx.HTTPStatusError as exc:
        logger.error("NIM HTTP error %s: %s", exc.response.status_code, exc.response.text)
        response_text = f"[NIM ERROR {exc.response.status_code}] {exc.response.text[:200]}"
    except Exception as exc:
        logger.error("NIM inference failed: %s", exc)
        response_text = f"[NIM ERROR] {exc}"
    finally:
        latency_ms = (time.monotonic() - start) * 1000

    # Mint and broadcast POP-LL-3.0 receipt
    response_hash = hashlib.sha256(response_text.encode()).hexdigest()
    receipt = _mint_pop_receipt(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
        response_hash=response_hash,
        mission_id=mission_id,
        ok=ok,
    )
    emit_receipt(receipt)
    logger.info(
        "NIM inference | model=%s | tokens=%d | latency=%.0fms | receipt=%s",
        model,
        prompt_tokens + completion_tokens,
        latency_ms,
        receipt["receipt_id"],
    )

    return response_text
