import { createFileRoute } from "@tanstack/react-router";
import { FloatingNav } from "@/components/shaayu/floating-nav";
import { Hero } from "@/components/shaayu/hero";
import { SystemPanel } from "@/components/shaayu/system-panel";
import { FlowVoiceProvider } from "@/lib/flowvoice-context";

const title = "FlowVoice — Interruption-Safe Voice AI | Powered by Rime & LiveKit";
const description =
  "FlowVoice stops speech instantly on barge-in, fences stale asynchronous tool executions from prior conversational generations, and recovers state seamlessly.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <FlowVoiceProvider>
      <main className="min-h-screen bg-background text-foreground">
        <FloatingNav />
        <Hero />
        <SystemPanel />
        <section
          id="technology"
          className="mx-auto max-w-[110rem] px-5 py-24 sm:px-8 border-t border-border"
          aria-label="Interruption & Generation Architecture"
        >
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                k: "01",
                t: "Generation Fencing",
                d: "Every tool call is stamped with a monotonic generation ID at dispatch time. When a barge-in occurs, the generation ID advances and stale async results are rejected.",
              },
              {
                k: "02",
                t: "Rime Coda Streaming",
                d: "Rime's Coda voice model streams low-latency PCM audio over WebSockets, with sub-250ms audio cut when user speech is detected by Silero VAD.",
              },
              {
                k: "03",
                t: "State Consistency",
                d: "Conversation history reflects only what the user actually heard, preventing interrupted assistant drafts from corrupting downstream LLM turns.",
              },
            ].map((c) => (
              <article key={c.k} className="min-w-0">
                <span className="font-mono text-[0.62rem] tracking-[0.3em] text-signal">{c.k}</span>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">{c.t}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </FlowVoiceProvider>
  );
}
