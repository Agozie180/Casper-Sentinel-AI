"""The :class:`Decision` — the final, explainable verdict returned to a client."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from sentinel_core.domain.signal import RiskScore


class Verdict(StrEnum):
    """What the client should do with the intent."""

    ALLOW = "allow"
    """Proceed with signing/broadcast."""

    REVIEW = "review"
    """Hold for human review (or step-up auth) before proceeding."""

    BLOCK = "block"
    """Do not sign. The intent is judged unsafe."""


class Decision(BaseModel):
    """The policy verdict for a screened intent, carrying its full justification."""

    model_config = ConfigDict(frozen=True)

    intent_id: str
    verdict: Verdict
    risk_score: RiskScore
    reason: str = Field(description="Why the policy reached this verdict.")
    policy_id: str = Field(description="Identifier of the policy/ruleset that decided.")

    @property
    def allowed(self) -> bool:
        """True only for an outright ALLOW (REVIEW and BLOCK both withhold signing)."""
        return self.verdict is Verdict.ALLOW
