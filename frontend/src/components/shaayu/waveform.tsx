import { cn } from "@/lib/utils";
import type { VerificationState } from "./site-data";

const BAR_COUNT = 48;

const amplitudes = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.sin((i / BAR_COUNT) * Math.PI * 3) * 0.5 + 0.5;
  const detail = Math.sin(i * 1.9) * 0.22;
  return Math.round(Math.min(1, Math.max(0.12, wave * 0.8 + detail + 0.2)) * 100) / 100;
});

export function Waveform({ state, className }: { state: VerificationState; className?: string }) {
  const active =
    state === "listening" ||
    state === "analyzing" ||
    state === "speaking" ||
    state === "interrupted" ||
    state === "connecting";

  return (
    <div aria-hidden className={cn("flex h-10 items-center gap-[3px] overflow-hidden", className)}>
      {amplitudes.map((amp, i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] origin-center rounded-full transition-[background-color,opacity] duration-500",
            state === "verified" || state === "speaking"
              ? "bg-signal-warm"
              : state === "interrupted"
                ? "bg-destructive"
                : active
                  ? "bg-signal"
                  : "bg-foreground/25",
          )}
          style={{
            height: `${Math.round(amp * 100)}%`,
            opacity: active ? 1 : 0.7,
            animation: active
              ? `shaayu-bar ${state === "analyzing" || state === "speaking" ? 620 : 900 + (i % 7) * 60}ms ease-in-out ${i * 24}ms infinite`
              : undefined,
            transform: active ? undefined : `scaleY(${amp.toFixed(2)})`,
          }}
        />
      ))}
    </div>
  );
}
