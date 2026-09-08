import { cn } from "@/lib/utils";
import { Waveform } from "./waveform";
import { verificationStates } from "./site-data";
import { useFlowVoiceSession } from "@/lib/flowvoice-context";

export function VerificationControl({ className }: { className?: string }) {
  const { voiceState, isConnected, isConnecting, connect, disconnect, error } =
    useFlowVoiceSession();

  const meta = verificationStates[voiceState] || verificationStates.idle;

  const handleClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className={cn("w-full max-w-md", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isConnecting}
        aria-live="polite"
        className={cn(
          "group relative flex w-full items-center justify-between gap-4 border px-5 py-4 text-left transition-colors duration-500 cursor-pointer disabled:cursor-not-allowed",
          voiceState === "interrupted"
            ? "border-destructive/80 bg-destructive/15"
            : voiceState === "speaking" || voiceState === "verified"
              ? "border-signal-warm/60 bg-signal-warm/10"
              : voiceState === "idle"
                ? "border-border bg-foreground/[0.03] hover:border-signal/70 hover:bg-signal/10"
                : voiceState === "error"
                  ? "border-destructive/60 bg-destructive/10"
                  : "border-signal/60 bg-signal/10",
        )}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[0.72rem] tracking-[0.28em] text-muted-foreground">
            {meta.hint}
          </span>
          <span className="truncate text-sm font-semibold tracking-[0.22em] text-foreground">
            {meta.label}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full transition-all duration-500",
            voiceState === "interrupted"
              ? "size-2.5 bg-destructive shadow-[0_0_18px_4px_color-mix(in_oklab,var(--destructive)_60%,transparent)]"
              : voiceState === "speaking" || voiceState === "verified"
                ? "size-2.5 bg-signal-warm shadow-[0_0_18px_4px_color-mix(in_oklab,var(--signal-warm)_60%,transparent)]"
                : voiceState === "idle"
                  ? "size-2.5 bg-foreground/40"
                  : voiceState === "error"
                    ? "size-2.5 bg-destructive"
                    : "size-2.5 animate-pulse bg-signal shadow-[0_0_18px_4px_color-mix(in_oklab,var(--signal)_60%,transparent)]",
          )}
        />
      </button>

      <div className="mt-4 flex items-center gap-4 border-b border-border pb-4">
        <Waveform state={voiceState} className="flex-1" />
        <span className="shrink-0 font-mono text-[0.68rem] tracking-[0.24em] text-muted-foreground">
          {voiceState === "speaking"
            ? "RIME"
            : voiceState === "listening"
              ? "MIC ON"
              : voiceState === "interrupted"
                ? "CUT"
                : isConnected
                  ? "LIVE"
                  : "--.-%"}
        </span>
      </div>

      {error && <p className="mt-2 font-mono text-xs text-destructive">{error}</p>}
    </div>
  );
}
