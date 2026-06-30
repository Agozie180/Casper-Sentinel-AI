"""Port for emitting alerts when a risky intent is screened."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from sentinel_core.domain.decision import Decision
from sentinel_core.domain.intent import Intent


@runtime_checkable
class Notifier(Protocol):
    """Side-channel for alerting operators/users about notable decisions."""

    def notify(self, tenant_id: str, intent: Intent, decision: Decision) -> None:
        """Emit an alert (webhook, email, dashboard push). Best-effort; must not raise."""
        ...
