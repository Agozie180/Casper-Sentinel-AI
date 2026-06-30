"""Detector framework and registry.

The registry is the single place where detectors are wired in. Adding a threat check is
adding a module here and appending it to :func:`default_detectors` — the engine and API
never change.
"""

from __future__ import annotations

from sentinel_core.detectors.base import DetectionContext, Detector
from sentinel_core.detectors.drainer import DrainerDetector

__all__ = ["DetectionContext", "Detector", "DrainerDetector", "default_detectors"]


def default_detectors() -> list[Detector]:
    """The detector set enabled by default.

    Order is not significant to scoring (the engine aggregates), but is preserved in the
    signal list for stable, readable audit trails.
    """
    return [
        DrainerDetector(),
    ]
