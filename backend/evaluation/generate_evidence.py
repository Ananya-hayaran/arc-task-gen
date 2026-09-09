"""
generate_evidence.py

Reads evaluation/results.json (written by stress_test.py) and renders
RIME_EVIDENCE.md at the repo root. Run this after every real evaluation run
so the committed evidence file always reflects an actual measurement, never
a hand-typed claim.

Usage: python evaluation/generate_evidence.py
"""

from __future__ import annotations

import json
from pathlib import Path

RESULTS_PATH = Path("evaluation/results.json")
OUT_PATH = Path("RIME_EVIDENCE.md")

TEMPLATE = """# RIME_EVIDENCE.md

_Generated automatically by `evaluation/generate_evidence.py` from
`evaluation/results.json`. Do not hand-edit the numbers below — re-run
`evaluation/stress_test.py` and regenerate instead._

## Hard voice claim

FlowVoice targets the **interruption and recovery** problem: when a user
barges in mid-response, queued Rime audio must stop promptly, any async
model/tool work already in flight must be fenced so it cannot re-enter the
conversation, and the next spoken turn must answer the user's latest
request — never a stale one.

## Acceptance test

1. Ask a question that triggers a tool call with a configurable artificial
   delay (`FLOWVOICE_TOOL_DELAY_MS` / the frontend's "Tool delay" control).
2. While the tool is in flight (or the agent is speaking), interrupt with a
   genuinely different request.
3. Measure:
   - Interruption → audio-stop latency.
   - Whether the stale tool result is ever spoken as current.
   - Whether the final answer matches the new request, not the old one.
   - Whether conversation state (chat history's `interrupted` flags) is
     consistent with real barge-in events.
4. Repeat N times at a fixed delay to check consistency, not just a single
   lucky run.

## Procedure

Run: `python evaluation/stress_test.py --room <room> --trials <N> --delay-ms <ms>`
against a live agent process (`python backend/agent.py dev`) connected to
the same room. Results are written to `evaluation/results.json` and this
file is regenerated from them.

## Results

{results_block}

## Limitations (disclosed, not hidden)

- `stop_latency_ms` is measured between this project's own trace events
  (`interruption_detected` → `assistant_item_committed` with
  `interrupted=True`), not an external microphone-to-speaker ground truth
  rig. It reflects application-level responsiveness, not raw hardware
  audio-path latency.
- The stress harness's "stale result leakage" check currently verifies the
  code-level guarantee (tools.py returns an explicit stale marker instead
  of real data once a tool call is fenced) rather than diffing full chat
  history content across every trial. A stronger version would assert
  directly against `ConversationItemAddedEvent` text content.
- `correct_recovery` is judged by keyword presence against the scripted
  scenario's expected topic, not general semantic understanding — it will
  not generalize to arbitrary interruption phrasing without extending the
  harness.
- All trials use synthetic tool data (no external weather/calendar API), so
  results are reproducible offline but do not exercise real third-party
  API latency variance.
"""


def render_results_block() -> str:
    if not RESULTS_PATH.exists():
        return "**Not yet measured.** Run `evaluation/stress_test.py` first."
    data = json.loads(RESULTS_PATH.read_text())
    lines = [
        f"- Trials: {data['trials']} (tool delay: {data['delay_ms']} ms)",
        f"- Interruption stop latency — mean: "
        f"{data['stop_latency_ms_mean'] if data['stop_latency_ms_mean'] is not None else 'not yet measured'} ms "
        f"(measured in {data['stop_latency_ms_measured_count']}/{data['trials']} trials)",
        f"- Interruption stop latency — p95: "
        f"{data['stop_latency_ms_p95'] if data['stop_latency_ms_p95'] is not None else 'not yet measured (needs >=20 trials)'}",
        f"- State consistency: {data['state_consistency_pass']}/{data['state_consistency_total']} trials",
        f"- Harness note: {data['note']}",
    ]
    return "\n".join(lines)


def main() -> None:
    block = render_results_block()
    OUT_PATH.write_text(TEMPLATE.format(results_block=block))
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
