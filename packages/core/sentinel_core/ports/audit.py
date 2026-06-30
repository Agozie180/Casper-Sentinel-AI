"""Port for writing immutable audit records.

Every screening decision must be persisted with its full justification. The audit sink
is append-only from the domain's perspective; adapters decide where records land
(Postgres, an on-chain attestation, a log pipeline).
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict

from sentinel_core.domain.decision import Decision
from sentinel_core.domain.intent import Intent


class AuditRecord(BaseModel):
    """An immutable record of one screening decision."""

    model_config = ConfigDict(frozen=True)

    trace_id: str
    tenant_id: str
    intent: Intent
    decision: Decision
    recorded_at: datetime


@runtime_checkable
class AuditSink(Protocol):
    """Append-only sink for audit records."""

    def record(self, record: AuditRecord) -> None:
        """Persist ``record``. Implementations must treat records as immutable."""
        ...
