"""
UnityGrid Agent — NVIDIA NIM Community Package
Provides: nemo_infer tool + POP-LL-3.0 receipt bus
"""

from .nemo_infer import nemo_infer
from .pop_receipt_bus import emit_receipt, get_recent_receipts, subscribe, unsubscribe

__all__ = [
    "nemo_infer",
    "emit_receipt",
    "get_recent_receipts",
    "subscribe",
    "unsubscribe",
]
