import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { brand, navLinks } from "./site-data";
import { useFlowVoiceSession } from "@/lib/flowvoice-context";

export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isConnected, voiceState, connect, disconnect } = useFlowVoiceSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-5 pt-5 sm:px-8 sm:pt-7">
      <nav
        className={cn(
          "pointer-events-auto mx-auto grid max-w-[110rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border px-4 py-3 transition-all duration-500 sm:px-6",
          scrolled
            ? "border-border bg-background/70 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-5">
          <Link to="/" className="shrink-0 text-sm font-black tracking-[0.42em] text-foreground">
            {brand.name}
          </Link>
          <span className="hidden font-mono text-[0.62rem] tracking-[0.3em] text-muted-foreground lg:inline">
            {brand.version}
          </span>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-signal-warm/60 bg-signal-warm/10 font-mono text-[0.58rem] tracking-[0.2em] text-signal-warm">
              <span className="size-1.5 rounded-full bg-signal-warm animate-pulse" />
              LIVE ({voiceState.toUpperCase()})
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <ul className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <li key={l.label}>
                <a
                  href={`#${l.hash}`}
                  className="font-mono text-[0.68rem] tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label.toUpperCase()}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={isConnected ? disconnect : connect}
            className="hidden border border-border px-4 py-2 font-mono text-[0.66rem] tracking-[0.24em] text-foreground transition-colors hover:border-signal hover:text-signal sm:inline-block cursor-pointer"
          >
            {isConnected ? "DISCONNECT" : "CONNECT SESSION"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
            className="flex size-9 shrink-0 flex-col items-center justify-center gap-1.5 border border-border md:hidden cursor-pointer"
          >
            <span
              className={cn(
                "h-px w-4 bg-foreground transition-transform",
                open && "translate-y-[3.5px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-px w-4 bg-foreground transition-transform",
                open && "-translate-y-[3.5px] -rotate-45",
              )}
            />
          </button>
        </div>
      </nav>

      {open && (
        <div className="pointer-events-auto mx-auto mt-2 max-w-[110rem] border border-border bg-background/90 p-5 backdrop-blur-xl md:hidden">
          <ul className="flex flex-col gap-4">
            {navLinks.map((l) => (
              <li key={l.label}>
                <a
                  href={`#${l.hash}`}
                  onClick={() => setOpen(false)}
                  className="font-mono text-xs tracking-[0.24em] text-muted-foreground"
                >
                  {l.label.toUpperCase()}
                </a>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (isConnected) disconnect();
                  else connect();
                }}
                className="w-full text-left border border-border p-2 font-mono text-xs tracking-[0.24em] text-signal"
              >
                {isConnected ? "DISCONNECT" : "CONNECT SESSION"}
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
