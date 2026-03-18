"""
UnityGrid Agent — /api/receipts SSE Stream
==========================================
Server-Sent Events endpoint that broadcasts every POP-LL-3.0 receipt
in real time. Clients connect once and receive a continuous stream of
JSON-encoded receipt objects as `data:` SSE frames.

Endpoints:
  GET /api/receipts/stream   — live SSE stream (text/event-stream)
  GET /api/receipts/recent   — last N receipts as JSON array
  GET /api/receipts/stats    — aggregate stats (count, ok rate, avg latency)

Authority: KHAN-Ω | Spec: POP-LL-3.0
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from deerflow.community.nvidia_nim.pop_receipt_bus import (
    get_recent_receipts,
    subscribe,
    unsubscribe,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/receipts", tags=["receipts"])

# ── SSE stream ────────────────────────────────────────────────────────────────

async def _sse_generator(q: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Yield SSE frames from the subscriber queue until client disconnects."""
    # Send a heartbeat comment immediately so the browser knows the stream is alive
    yield ": UnityGrid POP-LL-3.0 Receipt Stream\n\n"
    try:
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=15.0)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                # Send a keep-alive comment every 15 s
                yield ": heartbeat\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unsubscribe(q)


@router.get(
    "/stream",
    summary="Live POP-LL-3.0 Receipt Stream",
    description=(
        "Server-Sent Events stream. Every NIM inference call, agent action, "
        "and tool execution emits a POP-LL-3.0 receipt here in real time. "
        "Connect with EventSource('/api/receipts/stream') in the browser."
    ),
    response_class=StreamingResponse,
)
async def receipts_stream() -> StreamingResponse:
    q = subscribe()
    return StreamingResponse(
        _sse_generator(q),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Recent receipts ───────────────────────────────────────────────────────────

class ReceiptListResponse(BaseModel):
    count: int
    receipts: list[dict]


@router.get(
    "/recent",
    response_model=ReceiptListResponse,
    summary="Recent POP-LL-3.0 Receipts",
    description="Return the most recent N receipts from the in-memory ring buffer (max 1000).",
)
async def recent_receipts(
    n: int = Query(default=50, ge=1, le=1000, description="Number of receipts to return"),
) -> ReceiptListResponse:
    receipts = get_recent_receipts(n)
    return ReceiptListResponse(count=len(receipts), receipts=receipts)


# ── Stats ─────────────────────────────────────────────────────────────────────

class ReceiptStatsResponse(BaseModel):
    total: int
    ok_count: int
    ok_rate: float
    avg_latency_ms: float
    total_tokens: int
    models_seen: list[str]
    last_receipt_id: str | None


@router.get(
    "/stats",
    response_model=ReceiptStatsResponse,
    summary="POP-LL-3.0 Receipt Aggregate Stats",
    description="Aggregate statistics over all receipts in the ring buffer.",
)
async def receipt_stats() -> ReceiptStatsResponse:
    receipts = get_recent_receipts(1000)
    if not receipts:
        return ReceiptStatsResponse(
            total=0,
            ok_count=0,
            ok_rate=0.0,
            avg_latency_ms=0.0,
            total_tokens=0,
            models_seen=[],
            last_receipt_id=None,
        )

    ok_count = sum(1 for r in receipts if r.get("ok", False))
    latencies = [
        r.get("metrics", {}).get("latency_ms", 0.0)
        for r in receipts
        if "metrics" in r
    ]
    tokens = sum(
        r.get("metrics", {}).get("total_tokens", 0)
        for r in receipts
        if "metrics" in r
    )
    models = list({r.get("model", "unknown") for r in receipts})
    last_id = receipts[-1].get("receipt_id") if receipts else None

    return ReceiptStatsResponse(
        total=len(receipts),
        ok_count=ok_count,
        ok_rate=round(ok_count / len(receipts), 4),
        avg_latency_ms=round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
        total_tokens=tokens,
        models_seen=sorted(models),
        last_receipt_id=last_id,
    )
