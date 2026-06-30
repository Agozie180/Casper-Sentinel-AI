"""The :class:`Intent` — a transaction a wallet or agent is *about to* perform.

Sentinel screens intents before they are signed or broadcast. An intent is deliberately
chain-shaped but framework-neutral: it captures who is acting, what they are about to do,
and the parameters that a detector needs to reason about risk.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class SubjectKind(StrEnum):
    """Who is initiating the intent.

    The same engine screens both, but detector selection and policy differ:
    an autonomous agent is held to spend budgets and prompt-injection checks that
    a human wallet is not.
    """

    WALLET = "wallet"
    AGENT = "agent"


class IntentKind(StrEnum):
    """The category of on-chain action being attempted."""

    TRANSFER = "transfer"
    """Move CSPR or a token to another account."""

    CONTRACT_CALL = "contract_call"
    """Invoke an entry point on a smart contract."""

    APPROVAL = "approval"
    """Grant a spending allowance to another party (classic drainer vector)."""

    STAKE = "stake"
    """Delegate / undelegate stake."""


class Subject(BaseModel):
    """The actor behind an intent."""

    model_config = ConfigDict(frozen=True)

    kind: SubjectKind
    account_hash: str = Field(description="Casper account-hash of the initiating account.")
    agent_id: str | None = Field(
        default=None,
        description="Stable identifier of the AI agent, when kind == AGENT.",
    )


class Intent(BaseModel):
    """A single action to be screened before signing.

    Amounts are expressed in motes (1 CSPR = 1e9 motes) as :class:`~decimal.Decimal`
    to avoid floating-point loss. The ``recipient``/``contract`` fields and ``args``
    are what detectors inspect for risk.
    """

    model_config = ConfigDict(frozen=True)

    intent_id: str = Field(description="Client-supplied idempotency / correlation id.")
    kind: IntentKind
    subject: Subject

    recipient: str | None = Field(
        default=None, description="Destination account-hash (transfers/approvals)."
    )
    contract: str | None = Field(
        default=None, description="Target contract package/hash (contract calls)."
    )
    entry_point: str | None = Field(
        default=None, description="Entry-point name for a contract call."
    )
    amount_motes: Decimal = Field(
        default=Decimal(0), ge=0, description="Value moved, in motes (1 CSPR = 1e9 motes)."
    )
    args: dict[str, str] = Field(
        default_factory=dict,
        description="Stringified call arguments; detectors parse what they understand.",
    )
    chain_name: str = Field(default="casper", description="e.g. 'casper' or 'casper-test'.")
    created_at: datetime | None = Field(
        default=None, description="Client timestamp; None if not provided."
    )
    metadata: dict[str, str] = Field(
        default_factory=dict,
        description="Opaque client context (e.g. agent prompt id, session id).",
    )
