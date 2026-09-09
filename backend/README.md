# FlowVoice

**Interruption-safe voice AI for hands-free work — built for the DataForge × Rime Hackathon Challenge.**

Speech provider used in the judged flow: **Rime, model `coda`, speaker `astra`,
language `en`**, via Rime's LiveKit plugin over WebSocket streaming
(`use_websocket=True`), PCM audio. Exact values live in `.env` — see
[Environment variables](#environment-variables). No fallback TTS provider is
wired in this reference build; if one is added later it must be disclosed
here and made visible in the UI per the challenge rules.

## 1. Product overview

FlowVoice is a voice assistant for people who cannot wait for an AI to
finish talking — drivers, field technicians, anyone mid-task. You can
interrupt it at any point, change the subject entirely, and it will stop
talking immediately, discard whatever it was in the middle of doing, and
answer your new request instead of your old one.

## 2. Problem

Voice agents that pause the mic while "thinking" or that keep speaking
stale content after a user interrupts feel broken in a way text chat never
does — the failure is audible and immediate. Naive implementations also
have a subtler bug: async work started before the interruption (a tool
call, an LLM generation) can finish *after* the interruption and still
leak into the conversation, either as spoken audio or as corrupted chat
state. This is a real, currently open class of issue even in mature
frameworks — see LiveKit's own tracker,
[livekit/agents#3702](https://github.com/livekit/agents/issues/3702) (tool
results lost/duplicated across an interruption boundary) and
[livekit/agents#5092](https://github.com/livekit/agents/issues/5092)
(interrupted tool output breaking the next LLM call).

## 3. Why voice is essential

Remove speech and there is no product: the entire value proposition is
being usable while your hands and eyes are busy. A text interface would
not have an interruption problem at all — there is no "audio to stop." The
hard voice problem this project targets only exists because the output is
spoken.

## 4. Hard voice problem

**Interruption and recovery.** Specifically: (a) stop queued Rime audio
promptly when the user barges in, (b) fence any async model/tool result
that was in flight before the interruption so it can never re-enter the
conversation, and (c) keep conversation state consistent with what the
user actually heard, not with what the agent originally planned to say.

## 5. Solution

- LiveKit Agents' built-in VAD/turn-detection handles the audio-level cut:
  it stops queued Rime playback as soon as it detects the user talking
  over the agent.
- FlowVoice adds an explicit **generation-fencing layer**
  (`backend/generation.py`) on top of that: every tool call is stamped
  with a monotonically increasing generation id at dispatch time. The
  moment a real barge-in is detected, the generation id is advanced. Any
  result that comes back stamped with an old generation id is rejected —
  it returns an explicit "stale, discard" marker instead of real data, so
  it cannot be spoken as current even if it reaches the LLM context.
- Every state transition is logged as a structured trace event
  (`backend/trace.py`) and streamed to the frontend's live debug panel, so
  the mechanism is visible while it happens, not just claimed after the
  fact.

## 6. Key innovation

Treating "stale result rejection" as a property of the **generation id**,
not of any single component. The fencing check lives at the point a result
is about to become real content (inside the tool function, right before
returning), which means it works regardless of exactly how or when
LiveKit's own cancellation propagates — it's a second, independent
safety net specifically aimed at the async-leak class of bug, not a
reimplementation of LiveKit's audio-level interruption handling.

## 7. Architecture

```
Frontend (static HTML/JS)          Backend (Python)
┌─────────────────────────┐        ┌───────────────────────────┐
│ livekit-client (mic,     │◄──────►│ LiveKit Agents             │
│ playback, room)          │  WebRTC│  AgentSession               │
│                          │        │   - VAD (silero)            │
│ Trace/metrics panels,    │◄──data─┤   - STT (LiveKit Inference) │
│ transcript, dev controls │ channel│   - LLM (LiveKit Inference) │
└─────────────────────────┘        │   - TTS (Rime plugin, Coda) │
                                    │                             │
                                    │ GenerationManager (fencing) │
                                    │ TraceBus (events)           │
                                    │ tools.py (weather, calendar,│
                                    │   configurable delay)       │
                                    └───────────────────────────┘
        ┌───────────────────────┐
        │ token_server.py        │  mints short-lived LiveKit
        │ (FastAPI)               │  room-join tokens; never
        └───────────────────────┘  exposes LIVEKIT/RIME secrets
```

Transport is LiveKit (WebRTC), per the problem statement's recommendation,
rather than a custom WebSocket protocol — this gives us production-grade
turn handling and audio-level interruption handling for free, so our own
engineering effort concentrates on the actual hard problem (stale-result
fencing) instead of reimplementing real-time transport.

## 8. Data flow

1. User speaks → LiveKit Inference STT → `user_input_transcribed` (final).
2. LLM (LiveKit Inference) reasons, may call a tool.
3. Tool call is stamped with the current generation id.
4. Rime TTS streams the response (Coda, WebSocket streaming).
5. If the user barges in while the agent is speaking: LiveKit stops queued
   audio; FlowVoice advances the generation id.
6. Any tool result that returns stamped with an old generation id is
   rejected at the tool level (see `tools.py`) — it never becomes spoken
   content.
7. The new user utterance is processed as a fresh turn under the new
   generation id.

## 9. Interruption state machine

`IDLE → LISTENING → THINKING → (TOOL_RUNNING) → SPEAKING → INTERRUPTING → RECOVERING → THINKING...`

Implemented via LiveKit's `agent_state_changed` / `user_state_changed`
events (`backend/agent.py`): a `user_state == "speaking"` transition while
`agent_state == "speaking"` is treated as a genuine interruption, which
triggers `GenerationManager.advance()`.

## 10. Rime integration

- Plugin: `livekit-plugins-rime`, `rime.TTS(model="coda", speaker="astra", use_websocket=True, segment="bySentence")`.
- WebSocket streaming is used (not HTTP) for lower latency and word-level
  timestamps.
- `RIME_API_KEY` is read server-side only, in `backend/agent.py` (via the
  plugin) — never sent to or readable from the frontend.
- Model/voice/language are read from `.env`, not hardcoded, so the team can
  update them against Rime's live catalog without touching code — the PS
  explicitly warns against copying a stale speaker list into the app.

## 11. LLM integration

LiveKit Inference LLM (`inference.LLM(model="openai/gpt-4.1-mini")`) — swap
the model string for whatever your team has access to; LiveKit Inference
avoids needing a separate provider key for this reference build.

## 12. Tool orchestration

Two demo tools in `backend/tools.py`: `get_weather` and `get_calendar`,
both returning synthetic data (reproducible offline, no external API
flakiness). Both honor `FLOWVOICE_TOOL_DELAY_MS` for the configurable
artificial latency the problem statement asks for, and both check
`GenerationManager.is_current()` before returning real data.

## 13. Stale-result protection

See [Solution](#5-solution) and `backend/generation.py`. Proven in
isolation by `tests/test_generation_fencing.py` — in particular
`test_out_of_order_completion_does_not_resurrect_stale_work`, which
reproduces the exact "late result after interruption" race from the
problem statement without needing a live voice session to demonstrate it.

## 14. Evaluation methodology

`evaluation/stress_test.py` runs the delayed-tool + interrupt scenario N
times against a live agent, reading real timestamps from
`flowvoice_trace.jsonl` (written by `backend/trace.py`) rather than
computing anything by hand. `evaluation/generate_evidence.py` renders
`RIME_EVIDENCE.md` from those results.

## 15. Results

See `RIME_EVIDENCE.md`. It is generated, not hand-written — if it says "not
yet measured," that means `stress_test.py` has not been run yet, not that
the number was omitted.

## 16. Limitations

- Interruption stop latency is measured from this project's own trace
  events, not an external microphone-to-speaker ground-truth rig (see
  `RIME_EVIDENCE.md` for the full disclosure).
- `correct_recovery` in the evaluation harness uses a keyword heuristic,
  not semantic understanding — documented, not hidden.
- Demo tools use synthetic data; no real weather/calendar API is called.
- LiveKit Inference is used for STT/LLM to minimize the number of API keys
  required to run this reference build; swap in direct provider plugins if
  your deployment needs specific models.

## 17. Setup

```bash
git clone <this repo> && cd flowvoice
cp .env.example .env   # fill in real values, never commit this file
pip install -r backend/requirements.txt
```

## 18. Environment variables

See `.env.example` — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`RIME_API_KEY`, `RIME_MODEL`, `RIME_SPEAKER`, `RIME_LANGUAGE`, `RIME_ENDPOINT`
(optional), `FLOWVOICE_TOOL_DELAY_MS` (dev default).

## 19. Local development

```bash
# terminal 1 — token server
cd backend && uvicorn token_server:app --port 8000 --reload

# terminal 2 — agent
cd backend && python agent.py dev

# terminal 3 — frontend
npx serve frontend -l 5173
# open http://localhost:5173
```

## 20. Deployment

Deploy `backend/agent.py` as a LiveKit Agents worker (`python agent.py
start`) on any always-on host; deploy `token_server.py` behind HTTPS with
`allow_origins` restricted to your frontend's real domain; deploy
`frontend/` as static files on any static host, pointed at the deployed
token server's URL.

## 21. Security

- `RIME_API_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are read only in
  `backend/` processes, never in `frontend/`.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- The token server issues short-lived, room-scoped join tokens — it never
  hands out the underlying API secret.

## 22. AI-assisted development disclosure

This repository's architecture, code, tests, and documentation were
drafted with AI assistance (Claude), based on a human-provided product
brief and the official DataForge × Rime problem statement, and verified
against current Rime and LiveKit documentation during development (see
inline citations to `docs.rime.ai` and `docs.livekit.io` in code comments).
The team should read, understand, and be prepared to defend every file
before submission, per the challenge's AI-development guidance — treat
this as a strong first draft, not a finished, unreviewed submission.

- Human-written: product framing, demo script, final review.
- AI-assisted: architecture, backend code, frontend code, tests, docs.
- Third-party/open-source: LiveKit Agents, `livekit-client`, FastAPI,
  Silero VAD.
- External APIs: Rime (TTS), LiveKit Inference (STT/LLM), LiveKit Cloud
  (transport).
- Generated assets: none (no images/audio assets beyond synthesized
  speech).

## 23. Third-party services

Rime (TTS), LiveKit Cloud (WebRTC transport + Agents runtime + Inference
STT/LLM).

## 24. Licenses

Add your team's chosen license here (e.g. MIT) before submission. This
reference build does not vendor any code that would conflict with a
permissive license.

---

## Reproducing the stress test

```bash
python evaluation/stress_test.py --room flowvoice-eval --trials 20 --delay-ms 2000
python evaluation/generate_evidence.py
```

This requires `backend/agent.py dev` already running and dispatched into
`flowvoice-eval`. Results land in `evaluation/results.json` and
`RIME_EVIDENCE.md` is regenerated from them — a judge can run this exact
command and get the same shape of output.

## Known gaps to close before submission (do not hide these from the team)

- `agent.py`'s data-channel handler (`set_tool_delay`, `run_stress_test`) is
  a demo convenience; wire it more robustly (e.g. validate sender identity)
  before a public deployment.
- `stress_test.py`'s stale-leakage check currently verifies the code-level
  guarantee in `tools.py` rather than diffing full chat-history content —
  see the limitation noted in `generate_evidence.py`. Strengthening this to
  inspect `ConversationItemAddedEvent` content directly would make the
  evidence harder to argue with.
- Verify the exact LiveKit Agents API surface (`AgentSession` event names,
  `function_tool` cancellation semantics) against the version actually
  installed at build time — this project was written against
  `livekit-agents~=1.6` per current docs, but LiveKit ships fast; re-check
  `docs.livekit.io` if anything doesn't match.
