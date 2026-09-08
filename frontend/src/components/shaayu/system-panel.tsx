import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useFlowVoiceSession } from "@/lib/flowvoice-context";

export function SystemPanel() {
  const {
    isConnected,
    transcript,
    traceLog,
    metrics,
    chips,
    toolDelay,
    setToolDelay,
    runStressTest,
  } = useFlowVoiceSession();

  const traceLogEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    traceLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceLog]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <section
      id="session"
      className="mx-auto max-w-[110rem] px-5 py-16 sm:px-8 border-t border-border"
      aria-label="FlowVoice Live Session & Telemetry"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <span className="font-mono text-[0.62rem] tracking-[0.3em] text-signal uppercase">
            LIVE SYSTEM TELEMETRY
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Console &amp; Verification Stream
          </h2>
        </div>

        {/* System Activity Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.6rem] tracking-[0.2em] text-muted-foreground mr-1">
            ACTIVITY:
          </span>
          <span
            className={cn(
              "px-2.5 py-1 text-[0.65rem] font-mono border transition-all duration-300",
              chips.stt
                ? "border-signal bg-signal/20 text-signal shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                : "border-border text-muted-foreground/60 bg-foreground/[0.02]",
            )}
          >
            STT
          </span>
          <span
            className={cn(
              "px-2.5 py-1 text-[0.65rem] font-mono border transition-all duration-300",
              chips.llm
                ? "border-signal bg-signal/20 text-signal shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                : "border-border text-muted-foreground/60 bg-foreground/[0.02]",
            )}
          >
            LLM
          </span>
          <span
            className={cn(
              "px-2.5 py-1 text-[0.65rem] font-mono border transition-all duration-300",
              chips.tool
                ? "border-signal-warm bg-signal-warm/20 text-signal-warm shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                : "border-border text-muted-foreground/60 bg-foreground/[0.02]",
            )}
          >
            TOOL
          </span>
          <span
            className={cn(
              "px-2.5 py-1 text-[0.65rem] font-mono border transition-all duration-300",
              chips.tts
                ? "border-signal bg-signal/20 text-signal shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                : "border-border text-muted-foreground/60 bg-foreground/[0.02]",
            )}
          >
            RIME TTS
          </span>
          <span
            className={cn(
              "px-2.5 py-1 text-[0.65rem] font-mono border transition-all duration-300",
              chips.playback
                ? "border-signal-warm bg-signal-warm/20 text-signal-warm shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                : "border-border text-muted-foreground/60 bg-foreground/[0.02]",
            )}
          >
            PLAYBACK
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div id="metrics" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-border p-4 bg-foreground/[0.02]">
          <span className="block font-mono text-[0.62rem] tracking-[0.24em] text-muted-foreground uppercase">
            Interruption Stop Latency
          </span>
          <span className="mt-2 block font-mono text-xl sm:text-2xl font-bold text-foreground">
            {metrics.stopLatencyMs}
          </span>
        </div>
        <div className="border border-border p-4 bg-foreground/[0.02]">
          <span className="block font-mono text-[0.62rem] tracking-[0.24em] text-muted-foreground uppercase">
            Stale Result Leakage
          </span>
          <span className="mt-2 block font-mono text-xl sm:text-2xl font-bold text-foreground">
            {metrics.staleLeakage}
          </span>
        </div>
        <div className="border border-border p-4 bg-foreground/[0.02]">
          <span className="block font-mono text-[0.62rem] tracking-[0.24em] text-muted-foreground uppercase">
            Correct Recovery
          </span>
          <span
            className={cn(
              "mt-2 block font-mono text-xl sm:text-2xl font-bold",
              metrics.correctRecovery === "PASS"
                ? "text-signal-warm"
                : metrics.correctRecovery === "FAIL"
                  ? "text-destructive"
                  : "text-foreground",
            )}
          >
            {metrics.correctRecovery}
          </span>
        </div>
        <div className="border border-border p-4 bg-foreground/[0.02]">
          <span className="block font-mono text-[0.62rem] tracking-[0.24em] text-muted-foreground uppercase">
            State Consistency
          </span>
          <span
            className={cn(
              "mt-2 block font-mono text-xl sm:text-2xl font-bold",
              metrics.stateConsistency === "PASS"
                ? "text-signal-warm"
                : metrics.stateConsistency === "FAIL"
                  ? "text-destructive"
                  : "text-foreground",
            )}
          >
            {metrics.stateConsistency}
          </span>
        </div>
      </div>

      {/* Main Console Grid: Transcript (Left) + Trace Log & Dev Controls (Right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transcript Panel */}
        <div className="flex flex-col border border-border bg-foreground/[0.01]">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-foreground/[0.02]">
            <span className="font-mono text-xs font-semibold tracking-[0.24em] text-foreground uppercase">
              Conversation Transcript
            </span>
            <span className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground">
              {transcript.length} TURNS
            </span>
          </div>

          <div className="h-80 overflow-y-auto p-5 space-y-4 font-sans text-sm">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center font-mono text-xs text-muted-foreground">
                Connect and speak to begin live transcription.
              </div>
            ) : (
              transcript.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-3.5 border text-sm transition-colors",
                    item.role === "user"
                      ? "border-signal/40 bg-signal/5 text-foreground"
                      : item.interrupted
                        ? "border-destructive/50 bg-destructive/10 text-muted-foreground"
                        : "border-border bg-foreground/[0.02] text-foreground",
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[0.68rem] tracking-[0.2em]">
                    <span
                      className={
                        item.role === "user"
                          ? "text-signal font-semibold"
                          : "text-signal-warm font-semibold"
                      }
                    >
                      {item.role === "user" ? "YOU" : "FLOWVOICE"}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.interrupted && (
                        <span className="text-[0.6rem] px-1.5 py-0.2 border border-destructive text-destructive font-mono">
                          CUT / INTERRUPTED
                        </span>
                      )}
                      <span className="text-muted-foreground">{item.timestamp}</span>
                    </div>
                  </div>
                  <p className="leading-relaxed">{item.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Live System Trace & Dev Controls Panel */}
        <div id="trace" className="flex flex-col border border-border bg-foreground/[0.01]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 bg-foreground/[0.02]">
            <span className="font-mono text-xs font-semibold tracking-[0.24em] text-foreground uppercase">
              Live System Trace
            </span>

            {/* Dev Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="tool-delay-select"
                  className="font-mono text-[0.62rem] tracking-[0.2em] text-muted-foreground uppercase"
                >
                  Delay:
                </label>
                <select
                  id="tool-delay-select"
                  value={toolDelay}
                  onChange={(e) => setToolDelay(Number(e.target.value))}
                  className="bg-background border border-border px-2 py-1 font-mono text-xs text-foreground cursor-pointer focus:outline-none focus:border-signal"
                >
                  <option value="0">0 ms</option>
                  <option value="500">500 ms</option>
                  <option value="1000">1000 ms</option>
                  <option value="2000">2000 ms</option>
                  <option value="5000">5000 ms</option>
                </select>
              </div>

              <button
                type="button"
                onClick={runStressTest}
                disabled={!isConnected}
                className="border border-border bg-foreground/[0.03] hover:border-signal hover:text-signal px-3 py-1 font-mono text-[0.66rem] tracking-[0.2em] text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                RUN STRESS TEST
              </button>
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-black/40">
            {traceLog.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                Trace events streamed over LiveKit DataChannel will display here in real time.
              </div>
            ) : (
              traceLog.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "px-2.5 py-1.5 border text-[0.72rem] leading-relaxed break-all",
                    log.isHot
                      ? "border-destructive/60 bg-destructive/15 text-destructive font-semibold"
                      : "border-border/60 bg-foreground/[0.01] text-muted-foreground",
                  )}
                >
                  <span className="text-muted-foreground/60">{log.ts}</span>
                  {" — "}
                  <span
                    className={
                      log.isHot ? "text-destructive font-bold" : "text-signal font-semibold"
                    }
                  >
                    {log.kind}
                  </span>{" "}
                  <span className="text-foreground/80">{JSON.stringify(log.payload)}</span>
                </div>
              ))
            )}
            <div ref={traceLogEndRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
