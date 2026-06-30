"""Domain models for Casper Sentinel AI.

These are the vocabulary of the system: an :class:`Intent` is screened, producing
:class:`Signal` objects that aggregate into a :class:`RiskScore`, which a policy turns
into a :class:`Decision`.
"""

from __future__ import annotations

from sentinel_core.domain.decision import Decision, Verdict
from sentinel_core.domain.intent import Intent, IntentKind, SubjectKind
from sentinel_core.domain.signal import RiskScore, Severity, Signal

__all__ = [
    "Decision",
    "Verdict",
    "Intent",
    "IntentKind",
    "SubjectKind",
    "RiskScore",
    "Severity",
    "Signal",
]
