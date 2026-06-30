"""Port for reading Casper chain-derived features.

Detectors never call the chain directly; they ask a :class:`ChainDataProvider` for
pre-computed reputation and relationship features. This keeps detectors deterministic
and unit-testable, and lets the indexer own all RPC/CEP-88 plumbing.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field


class AccountReputation(BaseModel):
    """Risk-relevant facts about a single account, derived from indexed chain data."""

    model_config = ConfigDict(frozen=True)

    account_hash: str
    known: bool = Field(
        default=False, description="Whether the indexer has ever observed this account."
    )
    first_seen_age_days: int | None = Field(
        default=None, description="Age in days since first activity; None if unknown/new."
    )
    sanctioned: bool = Field(default=False, description="On a sanctions/blocklist.")
    mixer_linked: bool = Field(default=False, description="Linked to a known mixer/tumbler.")
    drainer_linked: bool = Field(
        default=False, description="Linked to a known drainer campaign cluster."
    )
    risk_tags: tuple[str, ...] = Field(
        default_factory=tuple, description="Free-form labels, e.g. 'phishing', 'rug-pull'."
    )


@runtime_checkable
class ChainDataProvider(Protocol):
    """Read-side interface over indexed Casper data."""

    def reputation(self, account_hash: str) -> AccountReputation:
        """Return reputation for ``account_hash`` (a ``known=False`` record if unseen)."""
        ...

    def is_first_interaction(self, subject_hash: str, counterparty_hash: str) -> bool:
        """True if ``subject`` has never previously transacted with ``counterparty``.

        A first-time counterparty is a key feature for address-poisoning detection.
        """
        ...
