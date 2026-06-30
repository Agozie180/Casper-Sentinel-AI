"""The :class:`RiskEngine` — orchestrates detectors and aggregates their signals.

The engine runs every applicable detector over an intent, isolates individual detector
failures so one bad detector cannot fail the whole screen, and combines the resulting
signals into a single 0-100 :class:`RiskScore`.

Aggregation model
-----------------
Each signal contributes ``confidence * weight``. We combine contributions using a
probabilistic OR ("noisy-or") so that multiple independent signals accumulate toward,
but never exceed, the maximum score — one strong signal already implies high risk, and
several weak ones should add up without overflowing.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from sentinel_core.detectors.base import DetectionContext, Detector
from sentinel_core.domain.intent import Intent
from sentinel_core.domain.signal import SCORE_MAX, RiskScore, Signal
from sentinel_core.ports.chain import ChainDataProvider

logger = logging.getLogger("sentinel.engine")

#: Caps a single detector's normalized contribution so no one detector can saturate the
#: score on its own unless it is both maximally confident and heavily weighted.
_MAX_WEIGHT_REFERENCE = 3.0


class RiskEngine:
    """Runs detectors and produces an explainable :class:`RiskScore`."""

    def __init__(self, detectors: Iterable[Detector]) -> None:
        self._detectors: tuple[Detector, ...] = tuple(detectors)
        if not self._detectors:
            logger.warning("RiskEngine constructed with no detectors; all intents score 0.")

    @property
    def detectors(self) -> tuple[Detector, ...]:
        return self._detectors

    def score(self, intent: Intent, chain: ChainDataProvider) -> RiskScore:
        """Evaluate ``intent`` against all applicable detectors and aggregate."""
        ctx = DetectionContext(intent=intent, chain=chain)
        signals: list[Signal] = []

        for detector in self._detectors:
            if not detector.supports(intent):
                continue
            try:
                signal = detector.evaluate(ctx)
            except Exception:  # noqa: BLE001 - isolate detector faults, never fail the screen
                logger.exception(
                    "Detector %r raised while screening intent %s; treating as no-signal.",
                    detector.name,
                    intent.intent_id,
                )
                continue
            if signal is not None:
                signals.append(signal)

        value = self._aggregate(signals)
        return RiskScore(value=value, signals=tuple(signals))

    @staticmethod
    def _aggregate(signals: list[Signal]) -> float:
        """Combine signals into a 0-100 score via weighted noisy-or."""
        if not signals:
            return 0.0

        # Each signal's contribution is a probability in [0, 1].
        product_of_complements = 1.0
        for signal in signals:
            normalized_weight = min(signal.weight, _MAX_WEIGHT_REFERENCE) / _MAX_WEIGHT_REFERENCE
            contribution = signal.confidence * normalized_weight
            contribution = min(max(contribution, 0.0), 1.0)
            product_of_complements *= 1.0 - contribution

        combined = 1.0 - product_of_complements
        return round(combined * SCORE_MAX, 2)
