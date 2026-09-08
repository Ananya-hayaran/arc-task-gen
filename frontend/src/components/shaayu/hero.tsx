import heroArt from "@/assets/shaayu-hero.png.asset.json";
import { VerificationControl } from "./verification-control";
import { heroCopy, marqueeSpecs } from "./site-data";
import { useFlowVoiceSession } from "@/lib/flowvoice-context";

export function Hero() {
  const { metrics, voiceState, isConnected } = useFlowVoiceSession();

  const dynamicFloatingLabels = [
    {
      id: "lat",
      label: "STOP LATENCY",
      value: metrics.stopLatencyMs !== "—" ? metrics.stopLatencyMs : "< 250 ms",
    },
    {
      id: "acc",
      label: "STALE LEAKAGE",
      value: metrics.staleLeakage !== "0 / 0" ? metrics.staleLeakage : "0.00 %",
    },
    {
      id: "smp",
      label: "STATE / ENGINE",
      value: isConnected ? `${voiceState.toUpperCase()} · RIME CODA` : "Rime Coda (WebSocket)",
    },
  ];

  return (
    <section id="verify" className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Dominant hero artwork */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={heroArt.url}
          alt="FlowVoice voice resonance sculpture"
          className="absolute right-[-18%] top-1/2 w-[135%] max-w-none -translate-y-1/2 opacity-90 sm:right-[-10%] sm:w-[95%] lg:right-[-6%] lg:w-[62%]"
          style={{ animation: "shaayu-drift 18s ease-in-out infinite" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_50%,var(--background)_28%,transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative mx-auto grid min-h-[100svh] max-w-[110rem] grid-cols-1 items-end gap-12 px-5 pb-14 pt-32 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:pb-20">
        <div className="min-w-0">
          <p className="font-mono text-[0.66rem] tracking-[0.3em] text-muted-foreground">
            {heroCopy.eyebrow.toUpperCase()}
          </p>

          <h1 className="mt-7 text-[3.25rem] font-black uppercase leading-[0.86] tracking-[-0.045em] text-foreground sm:text-[5.5rem] lg:text-[7.5rem] xl:text-[9rem]">
            {heroCopy.lines.map((line, i) => (
              <span key={line} className="block">
                {i === 2 ? (
                  <span className="bg-gradient-to-r from-foreground via-signal to-signal-warm bg-clip-text text-transparent">
                    {line}
                  </span>
                ) : (
                  line
                )}
              </span>
            ))}
          </h1>

          <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {heroCopy.body}
          </p>

          <VerificationControl className="mt-10" />
        </div>

        {/* Technical floating labels */}
        <div className="relative hidden h-full min-h-[30rem] lg:block">
          {dynamicFloatingLabels.map((item, i) => (
            <div
              key={item.id}
              className="absolute right-0 flex flex-col items-end gap-1 border-r border-border pr-4"
              style={{ top: `${18 + i * 27}%` }}
            >
              <span className="font-mono text-[0.6rem] tracking-[0.3em] text-muted-foreground">
                {item.label}
              </span>
              <span className="font-mono text-lg tracking-tight text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spec ticker */}
      <div className="relative border-y border-border bg-background/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 sm:px-8">
          {marqueeSpecs.map((s) => (
            <span
              key={s}
              className="font-mono text-[0.6rem] tracking-[0.28em] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
