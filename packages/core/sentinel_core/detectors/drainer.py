"""Drainer / approval-abuse detector.

Wallet drainers most commonly operate by tricking a victim into signing an *approval*
that grants a large or unlimited spending allowance to an attacker-controlled account,
or by routing a transfer to an account linked to a known drainer cluster. This detector
flags both, weighting by the chain reputation of the counterparty and the size of the
allowance.

This is the first real detector and the reference implementation for the Strategy pattern.
"""

from __future__ import annotations

from decimal import Decimal

from sentinel_core.detectors.base import DetectionContext, Detector
from sentinel_core.domain.intent import IntentKind
from sentinel_core.domain.signal import Severity, Signal

#: Allowances at or above this (in motes) are treated as "effectively unlimited" and
#: inherently high-risk when granted to an unknown/young counterparty. 1e15 motes = 1M CSPR.
UNLIMITED_ALLOWANCE_MOTES = Decimal("1_000_000_000_000_000")

#: Counterparties newer than this are considered fresh and riskier.
YOUNG_ACCOUNT_DAYS = 7


class DrainerDetector(Detector):
    """Flags approval-abuse and transfers to drainer-linked accounts."""

    name = "drainer"

    def supports(self, intent: object) -> bool:  # type: ignore[override]
        # Only approvals and transfers can drain funds; skip stakes and benign calls.
        from sentinel_core.domain.intent import Intent

        if not isinstance(intent, Intent):
            return False
        return intent.kind in (IntentKind.APPROVAL, IntentKind.TRANSFER)

    def evaluate(self, ctx: DetectionContext) -> Signal | None:
        intent = ctx.intent
        counterparty = intent.recipient
        if counterparty is None:
            return None

        reputation = ctx.chain.reputation(counterparty)

        # Hard signal: counterparty is in a known drainer cluster.
        if reputation.drainer_linked:
            return Signal(
                detector=self.name,
                severity=Severity.CRITICAL,
                confidence=0.97,
                weight=3.0,
                reason="Counterparty is linked to a known wallet-drainer cluster.",
                evidence={
                    "counterparty": counterparty,
                    "risk_tags": ",".join(reputation.risk_tags),
                },
            )

        # Approval-specific heuristics: large allowance to an unknown/young account.
        if intent.kind is IntentKind.APPROVAL:
            unlimited = intent.amount_motes >= UNLIMITED_ALLOWANCE_MOTES
            young = (
                reputation.first_seen_age_days is not None
                and reputation.first_seen_age_days < YOUNG_ACCOUNT_DAYS
            )
            if unlimited and (not reputation.known or young):
                return Signal(
                    detector=self.name,
                    severity=Severity.HIGH,
                    confidence=0.85,
                    weight=2.0,
                    reason=(
                        "Near-unlimited approval granted to an unknown or newly-created "
                        "account — a classic drainer setup."
                    ),
                    evidence={
                        "counterparty": counterparty,
                        "amount_motes": str(intent.amount_motes),
                        "counterparty_known": str(reputation.known),
                    },
                )
            if unlimited:
                return Signal(
                    detector=self.name,
                    severity=Severity.MEDIUM,
                    confidence=0.5,
                    weight=1.5,
                    reason="Near-unlimited approval granted; verify the spender is trusted.",
                    evidence={
                        "counterparty": counterparty,
                        "amount_motes": str(intent.amount_motes),
                    },
                )

        return None
