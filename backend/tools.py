"""
tools.py

Demo tools for FlowVoice: getWeather and getCalendar. Both are ordinary
async LiveKit function_tools; the interesting part is not the tools
themselves (they return synthetic data — no external API needed for the
demo to be reproducible offline) but two things layered around them:

1. Configurable artificial latency (`FLOWVOICE_TOOL_DELAY_MS`), so the judge
   can reproduce the exact stress condition described in the problem
   statement ("introduce a fixed delay into a tool call, interrupt while it
   is in flight").

2. Generation stamping: every tool call is stamped with the current
   generation id (via GenerationManager.stamp()) at dispatch time. When the
   tool finishes, agent.py checks accept_or_reject() before letting the
   result reach the LLM/TTS. This file only does the stamping and honors
   `asyncio.CancelledError` cleanly — the accept/reject decision itself
   lives in agent.py, next to where results are turned into speech, which
   is the correct place to make that decision (see README, "Stale-result
   protection").
"""

from __future__ import annotations

import asyncio
import os
import random

from livekit.agents import RunContext, function_tool

from generation import GenerationManager
from trace import TraceBus, KIND_TOOL_STARTED, KIND_TOOL_COMPLETED, KIND_TOOL_CANCELLED


def _configured_delay_seconds() -> float:
    """Reads FLOWVOICE_TOOL_DELAY_MS, set by the frontend's "Tool delay"
    dev control via the room's data channel -> agent env, or directly in
    the environment for scripted evaluation runs. Defaults to 0."""
    raw = os.environ.get("FLOWVOICE_TOOL_DELAY_MS", "0")
    try:
        return max(0, int(raw)) / 1000.0
    except ValueError:
        return 0.0


def build_tools(gen: GenerationManager, trace: TraceBus):
    """Returns the tool functions bound to this session's GenerationManager
    and TraceBus (LiveKit tools are plain functions; binding via closure
    keeps agent.py simple and keeps generation.py dependency-free)."""

    @function_tool()
    async def get_weather(context: RunContext, city: str) -> dict:
        """Look up the current weather for a city. Use this when the user
        asks about weather, temperature, or what to wear."""
        gid = gen.stamp(label=f"get_weather:{city}")
        trace.emit(KIND_TOOL_STARTED, tool="get_weather", city=city, generation_id=gid)
        delay = _configured_delay_seconds()
        try:
            if delay:
                await asyncio.sleep(delay)
            # Synthetic, deterministic-ish data — no external API, so the
            # demo/stress test is reproducible without network access.
            conditions = random.choice(["clear", "light rain", "overcast", "windy"])
            temp_c = random.randint(8, 28)
            is_stale = not gen.is_current(gid)
            trace.emit(KIND_TOOL_COMPLETED, tool="get_weather", generation_id=gid,
                       stale=is_stale)
            if is_stale:
                # Fenced: the user moved on before this finished. Return an
                # explicit marker rather than real data, so even if this
                # result reaches the LLM context it cannot be spoken as a
                # current answer. The audio-level cut is handled separately
                # by LiveKit's own interruption handling (see README).
                return {"stale": True, "generation_id": gid,
                        "note": "Superseded by a newer user turn; discard."}
            return {
                "city": city,
                "temp_c": temp_c,
                "conditions": conditions,
                "recommendation": _clothing_recommendation(temp_c, conditions),
                "generation_id": gid,
            }
        except asyncio.CancelledError:
            trace.emit(KIND_TOOL_CANCELLED, tool="get_weather", generation_id=gid)
            raise

    @function_tool()
    async def get_calendar(context: RunContext, when: str = "next") -> dict:
        """Look up the user's next meeting. Use this when the user asks
        about their schedule, calendar, or an upcoming meeting."""
        gid = gen.stamp(label=f"get_calendar:{when}")
        trace.emit(KIND_TOOL_STARTED, tool="get_calendar", when=when, generation_id=gid)
        delay = _configured_delay_seconds()
        try:
            if delay:
                await asyncio.sleep(delay)
            is_stale = not gen.is_current(gid)
            trace.emit(KIND_TOOL_COMPLETED, tool="get_calendar", generation_id=gid,
                       stale=is_stale)
            if is_stale:
                return {"stale": True, "generation_id": gid,
                        "note": "Superseded by a newer user turn; discard."}
            return {
                "title": "3 PM sync with the DataForge team",
                "time": "15:00",
                "prep_needed": "Bring the interruption-latency numbers from the stress test.",
                "generation_id": gid,
            }
        except asyncio.CancelledError:
            trace.emit(KIND_TOOL_CANCELLED, tool="get_calendar", generation_id=gid)
            raise

    return [get_weather, get_calendar]


def _clothing_recommendation(temp_c: int, conditions: str) -> str:
    if temp_c <= 12:
        base = "a warm jacket"
    elif temp_c <= 20:
        base = "a light layer"
    else:
        base = "something light"
    if "rain" in conditions:
        base += " and something waterproof"
    return base
