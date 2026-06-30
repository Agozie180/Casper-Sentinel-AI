"""Risk signals and the aggregated risk score.

A :class:`Signal` is one detector's opinion about an intent. A :class:`RiskScore` is the
engine's bounded aggregation of all signals, on a 0-100 scale, that preserves every
contributing signal so a verdict can always be explained.
"""

from __future__ import annotations

from enum import IntEnum

from pydantic import BaseModel, ConfigDict, Field

#: Risk scores are normalized to this inclusive range.
SCORE_MIN = 0.0
SCORE_MAX = 100.0


class Severity(IntEnum):
    """Coarse severity bucket for a signal, useful for display and policy shortcuts."""

    INFO = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class Signal(BaseModel):
    """One detector's finding about an intent.

    ``confidence`` (0..1) is how sure the detector is; ``weight`` (>=0) is how much this
    detector matters relative to others. The engine combines ``confidence * weight``
    across signals. ``evidence`` holds machine-readable specifics for the audit trail.
    """

    model_config = ConfigDict(frozen=True)

    detector: str = Field(description="Stable name of the detector that produced this signal.")
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0, description="Detector certainty, 0..1.")
    weight: float = Field(default=1.0, ge=0.0, description="Relative importance of this detector.")
    reason: str = Field(description="Human-readable explanation of the finding.")
    evidence: dict[str, str] = Field(
        default_factory=dict, description="Machine-readable supporting facts."
    )


class RiskScore(BaseModel):
    """Aggregated risk for an intent, with the signals that produced it.

    ``value`` is on a 0-100 scale where higher means riskier. ``signals`` is the full,
    ordered list of contributing findings, so any score can be reconstructed and audited.
    """

    model_config = ConfigDict(frozen=True)

    value: float = Field(ge=SCORE_MIN, le=SCORE_MAX)
    signals: tuple[Signal, ...] = Field(default_factory=tuple)

    @property
    def max_severity(self) -> Severity:
        """The highest severity among contributing signals (INFO if none)."""
        if not self.signals:
            return Severity.INFO
        return max(signal.severity for signal in self.signals)

    @property
    def top_reason(self) -> str:
        """The reason from the most severe, highest-confidence signal."""
        if not self.signals:
            return "no risk signals"
        leading = max(self.signals, key=lambda s: (s.severity, s.confidence))
        return leading.reason
