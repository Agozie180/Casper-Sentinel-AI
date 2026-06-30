"""The :class:`Detector` abstraction — the central extensibility point.

Every threat check is a Detector (Strategy pattern). Adding a new threat means adding a
new Detector and registering it; the engine never changes. A detector receives a
:class:`DetectionContext` (the intent plus read-only ports) and returns zero or one
:class:`Signal`. Returning ``None`` means "nothing to say about this intent".
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from sentinel_core.domain.intent import Intent, SubjectKind
from sentinel_core.domain.signal import Signal
from sentinel_core.ports.chain import ChainDataProvider


@dataclass(frozen=True)
class DetectionContext:
    """Everything a detector may read while evaluating an intent.

    The context is read-only and carries the ports a detector is allowed to touch.
    Detectors must not perform I/O outside these ports, so they stay deterministic
    and unit-testable.
    """

    intent: Intent
    chain: ChainDataProvider


class Detector(ABC):
    """Base class for all threat detectors."""

    #: Stable, unique name used in signals, config, and audit trails.
    name: str

    #: Subject kinds this detector applies to. A detector that only makes sense for
    #: autonomous agents (e.g. prompt injection) restricts this to ``{SubjectKind.AGENT}``.
    applies_to: frozenset[SubjectKind] = frozenset(SubjectKind)

    def supports(self, intent: Intent) -> bool:
        """Whether this detector should run for ``intent``.

        Override for finer-grained gating (e.g. only approvals). The default checks the
        subject kind against :attr:`applies_to`.
        """
        return intent.subject.kind in self.applies_to

    @abstractmethod
    def evaluate(self, ctx: DetectionContext) -> Signal | None:
        """Inspect the intent and return a :class:`Signal`, or ``None`` if benign.

        Implementations must not raise on benign input; raising is reserved for genuine
        programming errors. The engine isolates detector failures, but a well-behaved
        detector returns ``None`` rather than raising for "no finding".
        """
        raise NotImplementedError
