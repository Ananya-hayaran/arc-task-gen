# FlowVoice — quick runbook for the DataForge × Rime hackathon

Read `SECURITY_NOTE.md` first if you haven't — a leaked credential zip was
found and removed, and the keys inside it need rotating before you demo or
submit.

## 0. What was fixed in this pass

- **`backend/agent.py`** — `RIME_LANGUAGE` was read from `.env` but never
  actually passed to `rime.TTS(...)`. It's now wired in as `lang=`, so the
  language your README/RIME_EVIDENCE.md claims is the language actually
  spoken (this matters for judging — "Rime integration and voice
  experience" scores whether the configured model/voice/language match
  what's really running).
- **`frontend/.env.example`** — added. The frontend previously had no
  documented way to point at a token server other than
  `http://localhost:8000/token`; this is required once you deploy the
  frontend anywhere else.
- **`.gitignore`** (root + frontend) — hardened so `.env` files and the
  kind of accidental full-repo zip that leaked credentials can't happen
  again.
- Removed `flowvoice.zip` (contained the leaked `.env`, see
  `SECURITY_NOTE.md`) and stray `__pycache__` directories.
- Verified `backend/generation.py` (the actual "hard voice problem" fencing
  logic) against its unit tests: **8/8 pass**, including the exact
  late-arriving-stale-result race the problem statement describes. This is
  the part of the codebase judges will scrutinize hardest, and it holds up.
- Cross-checked the LiveKit Agents event names (`agent_state_changed`,
  `user_state_changed`, `conversation_item_added`, `user_input_transcribed`)
  and the Rime plugin's `TTS(...)` constructor args used in `agent.py`
  against current LiveKit/Rime docs — they're correct for
  `livekit-agents~=1.6` / `livekit-plugins-rime~=1.6`.

## 1. What I could not verify here

I do not have network access or your API keys in this environment, so I
could not run `pip install` / `npm install` / `bun install`, could not start
the agent against real LiveKit/Rime infrastructure, and could not exercise
the browser mic → LiveKit → Rime → speaker path end to end. Everything above
is a static/logic review plus unit tests that need no network. **You need to
run the steps below yourself before the demo**, on a machine with internet
access and your (rotated) keys.

## 2. One-time setup

```bash
git clone <your repo> && cd flowvoice   # or use this cleaned folder directly
cp backend/.env.example backend/.env    # fill in REAL, NEWLY-ROTATED keys
cp frontend/.env.example frontend/.env  # only needed if not using localhost:8000

pip install -r backend/requirements.txt
cd frontend && npm install && cd ..     # or `bun install` if you prefer bun
```

Fill in `backend/.env`:
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — from your LiveKit
  Cloud project.
- `RIME_API_KEY` — from your Rime dashboard.
- `RIME_MODEL=coda`, `RIME_SPEAKER=astra`, `RIME_LANGUAGE=en` are already
  sensible defaults; check `astra` is still listed for `coda` in
  [Rime's live catalog](https://docs.rime.ai/docs/voices) before your demo,
  since the problem statement explicitly warns against a stale speaker list.

## 3. Run it (3 terminals)

```bash
# terminal 1 — token server (mints LiveKit join tokens; never exposes secrets)
cd backend && uvicorn token_server:app --port 8000 --reload

# terminal 2 — the voice agent itself
cd backend && python agent.py dev

# terminal 3 — frontend
cd frontend && npm run dev
# open the printed local URL (Vite/TanStack Start dev server)
```

Click the mic control on the page. First click will prompt for microphone
permission in the browser — accept it. You should hear FlowVoice's greeting
within a couple of seconds if `agent.py` is running and your keys are valid.

## 4. Before you trust the demo, actually run the acceptance test

```bash
cd backend
python -m pytest tests/test_generation_fencing.py -v   # no keys/network needed
```

Then, with `agent.py dev` running and dispatched into a room named
`flowvoice-eval` (or use the in-page "RUN STRESS TEST" button once
connected):

```bash
python evaluation/stress_test.py --room flowvoice-eval --trials 20 --delay-ms 2000
python evaluation/generate_evidence.py
```

This regenerates `RIME_EVIDENCE.md` from real, timestamped trace events —
don't hand-edit that file; if a number in it looks wrong, fix the harness or
the agent, then re-run the two commands above so the evidence file and the
demo agree.

## 5. Pre-demo checklist

- [ ] Rotated LiveKit + Rime keys (see `SECURITY_NOTE.md`), new keys only in
      untracked `.env` files.
- [ ] `pytest tests/test_generation_fencing.py -v` passes.
- [ ] Confirmed `astra` (or your chosen speaker) is still valid for `coda`
      in Rime's live catalog.
- [ ] Ran a real mic→agent→Rime round trip end to end at least once today,
      on the network/device you'll demo from — cloud STT/LLM/TTS latency and
      your own network conditions are the biggest source of "worked
      yesterday, glitchy today."
- [ ] Ran the stress test and regenerated `RIME_EVIDENCE.md` today, not from
      an old run.
- [ ] `RIME_ENDPOINT` left blank unless you're on a VPC/on-prem Rime
      deployment.
- [ ] No `.env`, API keys, or credential-bearing zips anywhere in the
      repo you actually push/submit (`git log --all -- '*.env' '*.zip'` to
      double check).
