"""
generation.py

The core "hard voice problem" solution for FlowVoice.

LiveKit Agents already stops queued TTS audio promptly when it detects an
interruption (VAD / adaptive interruption, see docs.livekit.io/agents/logic/turns).
That solves "stop the audio" but NOT the harder problem: async work that was
already in flight (an LLM generation, a tool call) can still finish AFTER the
interruption and try to re-enter the conversation as if it were current. This
is a real, documented failure class in LiveKit's own issue tracker (e.g.
livekit/agents#3702 — tool results lost/duplicated across an interruption
boundary; livekit/agents#5092 — interrupted tool output breaks the next LLM
call). FlowVoice does not rely on LiveKit's cancellation alone to prevent
this: every unit of async work is stamped with a generation id when it is
dispatched, and its result is only allowed to affect the conversation if that
id still matches the current generation when the result comes back.

Design:

- GenerationManager holds a single monotonically increasing counter,
  `current`, representing "the generation the user is currently on."
- Any code that starts async work (a tool call, an LLM completion, a TTS
  turn) calls `manager.stamp()` to get the generation id it belongs to.
- When work completes, the caller calls `manager.is_current(stamped_id)`
  before allowing the result to reach the LLM context or the TTS input.
  If it's stale, the caller must discard it and log a `stale_rejected`
  trace event instead of using it.
- On interruption, `manager.advance()` is called exactly once. This is the
  fencing operation: nothing stamped before this call can pass
  `is_current()` again.

This class has no LiveKit or Rime dependency and is unit-testable in
isolation (see /tests/test_generation_fencing.py).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class GenerationEvent:
    kind: str  # "advance" | "stamp" | "accept" | "reject_stale"
    generation_id: int
    at: float
    label: Optional[str] = None


class GenerationManager:
    """Tracks the current conversational generation and fences stale results.

    Thread-safety note: this class assumes it is only ever mutated from the
    single asyncio event loop that runs the LiveKit AgentSession for one
    room. That is true of the reference agent in agent.py. If you shard work
    across processes/loops, wrap access in an asyncio.Lock.
    """

    def __init__(self, on_event: Optional[Callable[[GenerationEvent], None]] = None):
        self._current = 0
        self._on_event = on_event
        self._last_advance_at: float = time.monotonic()

    @property
    def current(self) -> int:
        return self._current

    def _emit(self, kind: str, generation_id: int, label: Optional[str] = None) -> None:
        if self._on_event is not None:
            self._on_event(GenerationEvent(kind=kind, generation_id=generation_id,
                                            at=time.monotonic(), label=label))

    def stamp(self, label: Optional[str] = None) -> int:
        """Call when dispatching new async work. Returns the generation id
        that work belongs to. Store this id alongside the work (e.g. as a
        field on the asyncio.Task, or a closure variable) so it can be
        checked later in is_current()."""
        gid = self._current
        self._emit("stamp", gid, label)
        return gid

    def is_current(self, generation_id: int) -> bool:
        return generation_id == self._current

    def accept_or_reject(self, generation_id: int, label: Optional[str] = None) -> bool:
        """Convenience wrapper: returns True and emits an 'accept' event if
        the result is still current, otherwise emits 'reject_stale' and
        returns False. Callers MUST check the return value before using the
        result — this function does not raise, by design, since a stale
        result is an expected, routine outcome, not an error."""
        if self.is_current(generation_id):
            self._emit("accept", generation_id, label)
            return True
        self._emit("reject_stale", generation_id, label)
        return False

    def advance(self, label: Optional[str] = None) -> int:
        """Call exactly once per genuine interruption. Increments the
        current generation so that any work stamped before this call will
        fail is_current() from now on. Returns the new generation id."""
        self._current += 1
        self._emit("advance", self._current, label)
        self._last_advance_at = time.monotonic()
        return self._current

    def seconds_since_last_advance(self) -> float:
        return time.monotonic() - self._last_advance_at
