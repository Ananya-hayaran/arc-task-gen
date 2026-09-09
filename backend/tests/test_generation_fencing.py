"""
test_generation_fencing.py

Unit tests for backend/generation.py — the core stale-result fencing logic.
These run standalone with plain pytest, no LiveKit room, no Rime API key,
no network. This is deliberate: the hardest claim in this project
("stale results cannot re-enter the conversation") should be provable in
isolation, not only observable in a live demo.

Run: pytest tests/test_generation_fencing.py -v
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generation import GenerationManager  # noqa: E402


def test_starts_at_generation_zero():
    gen = GenerationManager()
    assert gen.current == 0


def test_stamp_returns_current_generation():
    gen = GenerationManager()
    gid = gen.stamp()
    assert gid == 0
    assert gen.is_current(gid)


def test_advance_invalidates_old_stamps():
    gen = GenerationManager()
    old_gid = gen.stamp(label="weather_call")
    gen.advance(label="barge_in")
    assert not gen.is_current(old_gid)


def test_new_stamps_after_advance_are_current():
    gen = GenerationManager()
    gen.stamp()
    gen.advance()
    new_gid = gen.stamp()
    assert gen.is_current(new_gid)


def test_accept_or_reject_reports_correctly():
    gen = GenerationManager()
    gid = gen.stamp()
    assert gen.accept_or_reject(gid) is True
    gen.advance()
    assert gen.accept_or_reject(gid) is False


def test_multiple_interruptions_only_the_latest_generation_is_current():
    gen = GenerationManager()
    gid_a = gen.stamp(label="a")
    gen.advance()
    gid_b = gen.stamp(label="b")
    gen.advance()
    gid_c = gen.stamp(label="c")

    assert not gen.is_current(gid_a)
    assert not gen.is_current(gid_b)
    assert gen.is_current(gid_c)


def test_events_are_emitted_for_stamp_advance_accept_reject():
    events = []
    gen = GenerationManager(on_event=lambda e: events.append(e.kind))

    gid = gen.stamp()
    gen.advance()
    gen.accept_or_reject(gid)  # stale -> reject
    new_gid = gen.stamp()
    gen.accept_or_reject(new_gid)  # current -> accept

    assert events == ["stamp", "advance", "reject_stale", "stamp", "accept"]


def test_out_of_order_completion_does_not_resurrect_stale_work():
    """Simulates the exact race the hackathon problem statement describes:
    a slow tool call started under generation 0 finishes AFTER the user has
    already interrupted and moved to generation 1. Its result must never
    read as current, no matter when it happens to arrive."""
    gen = GenerationManager()

    # Turn 1: weather tool dispatched.
    weather_gid = gen.stamp(label="get_weather")

    # User interrupts before the tool finishes.
    gen.advance(label="barge_in")

    # New turn's tool dispatched and finishes quickly.
    calendar_gid = gen.stamp(label="get_calendar")
    assert gen.accept_or_reject(calendar_gid) is True

    # The OLD weather result finally arrives, late.
    assert gen.accept_or_reject(weather_gid) is False
