"""
UnityGrid Agent — POP-LL-3.0 Receipt Event Bus
===============================================
In-process SSE broadcaster. Every NIM inference call, agent action,
and tool execution emits a receipt here. The /api/receipts endpoint
reads from this bus and streams events to connected clients.

Authority: KHAN-Ω | Spec: POP-LL-3.0
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)

# ── Internal state ────────────────────────────────────────────────────────────
_lock = threading.Lock()
_receipt_log: deque[dict[str, Any]] = deque(maxlen=1000)  # ring buffer
_async_queues: list[asyncio.Queue] = []                    # SSE subscriber queues
_loop: asyncio.AbstractEventLoop | None = None             # main event loop ref


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Register the main asyncio event loop (called at app startup)."""
    global _loop
    _loop = loop


def emit_receipt(receipt: dict[str, Any]) -> None:
    """
    Emit a POP-LL-3.0 receipt.

    Thread-safe: can be called from sync tool code, background threads,
    or async coroutines. Appends to the ring buffer and fans out to all
    active SSE subscriber queues.
    """
    with _lock:
        _receipt_log.append(receipt)
        queues = list(_async_queues)

    if not queues:
        return

    payload = json.dumps(receipt, default=str)
    loop = _loop

    if loop is not None and loop.is_running():
        for q in queues:
            # Schedule from a sync thread into the async loop
            try:
                loop.call_soon_threadsafe(q.put_nowait, payload)
            except Exception as exc:
                logger.debug("Receipt bus put_nowait failed: %s", exc)
    else:
        logger.debug("Receipt bus: no running event loop, receipt buffered only")


def get_recent_receipts(n: int = 100) -> list[dict[str, Any]]:
    """Return the most recent n receipts from the ring buffer."""
    with _lock:
        items = list(_receipt_log)
    return items[-n:]


def subscribe() -> asyncio.Queue:
    """Register a new SSE subscriber queue and return it."""
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    with _lock:
        _async_queues.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a subscriber queue (called when SSE client disconnects)."""
    with _lock:
        try:
            _async_queues.remove(q)
        except ValueError:
            pass
