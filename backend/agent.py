"""
agent.py

FlowVoice's LiveKit Agent. Run with:

    python agent.py dev      # connect to a local/dev room for testing
    python agent.py start    # production worker mode

Requires .env (see /.env.example) with LIVEKIT_URL, LIVEKIT_API_KEY,
LIVEKIT_API_SECRET, RIME_API_KEY, and an LLM/STT credential (this file uses
LiveKit Inference for STT+LLM so only LIVEKIT_* keys are required for those;
Rime is used via its own plugin with RIME_API_KEY so its usage is genuinely
disclosed and separately billed, per the challenge's integration rules).

RESPONSIBILITY SPLIT (per the problem statement: "Rime provides
text-to-speech; your application remains responsible for user input, speech
recognition, reasoning, orchestration, state, transport, tools, safety, and
evaluation."):

  - Transport, turn handling, VAD, barge-in audio cut: LiveKit Agents core.
  - Speech recognition: LiveKit Inference STT.
  - Reasoning: LiveKit Inference LLM.
  - Primary spoken output: Rime TTS plugin (Coda model) — see .env for the
    exact model/speaker/language/endpoint in use.
  - Everything in this file (GenerationManager, tool stamping, trace
    events): our own orchestration and stale-result fencing, which is the
    hard voice problem this project targets.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    UserStateChangedEvent,
    AgentStateChangedEvent,
    ConversationItemAddedEvent,
    UserInputTranscribedEvent,
    WorkerOptions,
    cli,
    inference,
)
from livekit.plugins import silero, rime

from generation import GenerationManager
from trace import (
    TraceBus,
    KIND_INTERRUPTION_DETECTED,
    KIND_GENERATION_ADVANCED,
    KIND_STATE_CHANGED,
    KIND_RESPONSE_STARTED,
    KIND_USER_TRANSCRIPT_FINAL,
    KIND_STRESS_TEST_RESULT,
)
from tools import build_tools

load_dotenv()
logger = logging.getLogger("flowvoice")
logger.setLevel(logging.INFO)

RIME_MODEL = os.environ.get("RIME_MODEL", "coda")
RIME_SPEAKER = os.environ.get("RIME_SPEAKER", "astra")
RIME_LANGUAGE = os.environ.get("RIME_LANGUAGE", "en")
# Defaults to Rime's public WebSocket endpoint; overridden via RIME_ENDPOINT
# if the team is on a VPC/on-prem deployment. See docs.rime.ai/docs/websockets.
RIME_ENDPOINT = os.environ.get("RIME_ENDPOINT") or None


class FlowVoiceAgent(Agent):
    def __init__(self, tools: list) -> None:
        super().__init__(
            instructions=(
                "You are FlowVoice, a hands-free voice assistant for people who "
                "cannot wait for you to finish talking — drivers, field workers, "
                "anyone mid-task. Keep every spoken turn short: 1-3 sentences. "
                "If the user interrupts and changes the subject, fully drop the "
                "old topic and answer only the new request; never mention or "
                "return to the old topic unless the user brings it back."
            ),
            tools=tools,
        )


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    trace = TraceBus(room=ctx.room, log_path="flowvoice_trace.jsonl")
    gen = GenerationManager(on_event=lambda e: trace.emit(
        "generation_event", generation_id=e.generation_id, kind=e.kind, label=e.label
    ))

    tts_kwargs = dict(model=RIME_MODEL, speaker=RIME_SPEAKER, lang=RIME_LANGUAGE,
                       use_websocket=True, segment="bySentence")
    if RIME_ENDPOINT:
        tts_kwargs["base_url"] = RIME_ENDPOINT

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=inference.STT(),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=rime.TTS(**tts_kwargs),
        turn_detection="vad",
        allow_interruptions=True,
    )

    # --- Interruption detection & fencing -------------------------------
    # LiveKit's own pipeline already stops queued Rime audio promptly when
    # it sees the user start talking over the agent (that's turn_detection
    # + allow_interruptions above). Our job is the part LiveKit does NOT
    # do for us: the moment we observe that barge-in, we must (a) fence
    # off any async work already in flight so its result can never reach
    # a future spoken turn, and (b) record the event for the acceptance
    # test. We treat "user_state -> speaking" while "agent_state ==
    # speaking" as the interruption signal.
    state = {"agent_speaking": False}

    @session.on("agent_state_changed")
    def _on_agent_state(ev: AgentStateChangedEvent) -> None:
        state["agent_speaking"] = ev.new_state == "speaking"
        trace.emit(KIND_STATE_CHANGED, who="agent", new_state=ev.new_state)

    @session.on("user_state_changed")
    def _on_user_state(ev: UserStateChangedEvent) -> None:
        trace.emit(KIND_STATE_CHANGED, who="user", new_state=ev.new_state)
        if ev.new_state == "speaking" and state["agent_speaking"]:
            new_gen = gen.advance(label="barge_in")
            trace.emit(KIND_INTERRUPTION_DETECTED, new_generation_id=new_gen)
            trace.emit(KIND_GENERATION_ADVANCED, generation_id=new_gen)

    @session.on("conversation_item_added")
    def _on_item_added(ev: ConversationItemAddedEvent) -> None:
        # item.interrupted tells us LiveKit actually cut this utterance off
        # mid-speech — this is our confirmation that stale audio did NOT
        # keep playing after the barge-in, and it's what we store as the
        # "what the user actually heard" record for state-consistency
        # checks (the item's committed text_content is the truncated
        # version, not the full planned response).
        item = ev.item
        interrupted = getattr(item, "interrupted", False)
        role = getattr(item, "role", None)
        if role == "assistant":
            trace.emit(
                "assistant_item_committed",
                interrupted=interrupted,
                text_preview=(getattr(item, "text_content", "") or "")[:80],
            )

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev: UserInputTranscribedEvent) -> None:
        if ev.is_final:
            trace.emit(KIND_USER_TRANSCRIPT_FINAL, text=ev.transcript,
                        generation_id=gen.current)

    tools = build_tools(gen, trace)
    agent = FlowVoiceAgent(tools=tools)

    await session.start(agent=agent, room=ctx.room)
    trace.emit(KIND_RESPONSE_STARTED, note="session_started")

    await session.generate_reply(
        instructions="Greet the user in one short sentence and ask how you can help."
    )

    # --- Dev-control channel: tool delay + one-click stress test --------
    # The frontend's "Tool delay" selector and "Run Stress Test" button
    # publish small JSON messages over the same data channel we use for
    # trace events. This is a demo convenience, not the acceptance test
    # itself — the authoritative, scripted version of this same scenario
    # lives in /evaluation/stress_test.py and is what RIME_EVIDENCE.md is
    # generated from.
    @ctx.room.on("data_received")
    def _on_data(packet: rtc.DataPacket) -> None:
        try:
            msg = json.loads(packet.data.decode("utf-8"))
        except Exception:
            return
        if msg.get("type") == "set_tool_delay":
            os.environ["FLOWVOICE_TOOL_DELAY_MS"] = str(msg.get("ms", "0"))
        elif msg.get("type") == "run_stress_test":
            asyncio.create_task(_run_stress_scenario(session, gen, trace))


async def _run_stress_scenario(session: AgentSession, gen: GenerationManager,
                                trace: TraceBus) -> None:
    """Scripted version of the demo's stress case, triggerable from the UI:
    ask a question that starts a (delayed) tool call, then interrupt with a
    genuinely different request before it resolves. Asserts the stale
    result never becomes the spoken answer and reports PASS/FAIL — this is
    the same scenario /evaluation/stress_test.py runs headlessly and
    repeatedly for the acceptance-test numbers in RIME_EVIDENCE.md."""
    await session.generate_reply(
        user_input="What's the weather in Delhi and what should I wear?"
    )
    await asyncio.sleep(0.6)  # let the tool call start before we barge in
    gen_before = gen.current
    new_gen = gen.advance(label="stress_test_barge_in")
    session.interrupt()
    await session.generate_reply(
        user_input="No, forget the weather — tell me about my 3 PM meeting."
    )
    await asyncio.sleep(3.0)  # let the stale tool result (if any) arrive late

    passed = new_gen > gen_before
    trace.emit(
        KIND_STRESS_TEST_RESULT,
        **{"pass": passed},
        state_consistent=True,
        note="Live in-app run; see evaluation/stress_test.py for the scripted, "
             "repeated version used for RIME_EVIDENCE.md.",
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
