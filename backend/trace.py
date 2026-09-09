"""
trace.py

A single structured event stream that serves two consumers:

1. The frontend "System Trace" / debug panel — events are published as JSON
   over the LiveKit room's data channel (rtc.LocalParticipant.publish_data),
   so any connected client sees the play-by-play in real time with no extra
   backend infrastructure.

2. The evaluation harness (/evaluation/stress_test.py) — the same events are
   appended to a local JSONL file so the acceptance-test metrics
   (interruption stop latency, stale-result leakage, recovery success) can
   be computed after a run, from real recorded timestamps rather than
   hand-typed numbers.

Every event has: ts (wall-clock ISO), monotonic (perf-counter float for
latency math), kind, and a free-form payload dict. Keep kinds stable —
the evaluation harness matches on them by name.
"""

from __future__ import annotations

import json
import time
import datetime
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional

try:
    from livekit import rtc
except ImportError:  # allows unit tests / evaluation scripts to import this
    rtc = None  # type: ignore


# Stable event kind names used across agent.py, tools.py, generation.py and
# the evaluation harness. Keep this list in sync with README's state machine
# section — it's the vocabulary the trace panel and the evidence generator
# both rely on.
KIND_USER_SPEECH_STARTED = "user_speech_started"
KIND_USER_TRANSCRIPT_FINAL = "user_transcript_final"
KIND_LLM_STARTED = "llm_started"
KIND_TOOL_STARTED = "tool_started"
KIND_TOOL_COMPLETED = "tool_completed"
KIND_TOOL_CANCELLED = "tool_cancelled"
KIND_TTS_STARTED = "tts_started"
KIND_INTERRUPTION_DETECTED = "interruption_detected"
KIND_PLAYBACK_STOPPED = "playback_stopped"
KIND_GENERATION_ADVANCED = "generation_advanced"
KIND_STALE_RESULT_REJECTED = "stale_result_rejected"
KIND_RESPONSE_STARTED = "response_started"
KIND_STATE_CHANGED = "state_changed"
KIND_STRESS_TEST_RESULT = "stress_test_result"


@dataclass
class TraceEvent:
    ts: str
    monotonic: float
    kind: str
    payload: dict


class TraceBus:
    def __init__(self, room: Optional["rtc.Room"] = None,
                 log_path: Optional[str] = "flowvoice_trace.jsonl"):
        self._room = room
        self._log_path = Path(log_path) if log_path else None
        if self._log_path:
            # start each session with a fresh file so evaluation runs don't
            # mix events from previous sessions.
            self._log_path.write_text("")

    def set_room(self, room: "rtc.Room") -> None:
        self._room = room

    def emit(self, kind: str, **payload: Any) -> TraceEvent:
        event = TraceEvent(
            ts=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            monotonic=time.perf_counter(),
            kind=kind,
            payload=payload,
        )
        self._write_log(event)
        self._publish(event)
        return event

    def _write_log(self, event: TraceEvent) -> None:
        if not self._log_path:
            return
        with self._log_path.open("a") as f:
            f.write(json.dumps(asdict(event)) + "\n")

    def _publish(self, event: TraceEvent) -> None:
        if self._room is None or rtc is None:
            return
        data = json.dumps({"type": "flowvoice_trace", **asdict(event)}).encode("utf-8")
        try:
            # Fire-and-forget: publish_data is async in recent SDK versions,
            # so schedule it without blocking the caller's control flow.
            import asyncio
            asyncio.ensure_future(
                self._room.local_participant.publish_data(data, reliable=True)
            )
        except Exception:
            # Trace publishing must never break the voice pipeline itself.
            pass
