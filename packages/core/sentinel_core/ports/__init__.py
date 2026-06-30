"""Ports: the interfaces the domain needs from the outside world.

These are :class:`typing.Protocol` definitions so the core never imports a database,
HTTP client, or blockchain SDK. The ``api`` and ``indexer`` packages provide concrete
adapters; tests provide in-memory fakes.
"""

from __future__ import annotations

from sentinel_core.ports.audit import AuditRecord, AuditSink
from sentinel_core.ports.chain import AccountReputation, ChainDataProvider
from sentinel_core.ports.notifier import Notifier

__all__ = [
    "AuditRecord",
    "AuditSink",
    "AccountReputation",
    "ChainDataProvider",
    "Notifier",
]
