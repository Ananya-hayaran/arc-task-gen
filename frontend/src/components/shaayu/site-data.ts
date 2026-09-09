// Demo-ready content model.

export const brand = {
  name: "FLOWVOICE",
  tagline: "Interruption-Safe Voice AI",
  version: "v1.4 · RIME CODA / LIVEKIT",
};

export const navLinks = [
  { label: "Console", to: "/" as const, hash: "session" },
  { label: "Trace", to: "/" as const, hash: "trace" },
  { label: "Metrics", to: "/" as const, hash: "metrics" },
  { label: "Architecture", to: "/" as const, hash: "technology" },
];

export const heroCopy = {
  lines: ["TALK", "WITHOUT", "WAITING"],
  eyebrow: "Interruption-Safe Voice AI — Powered by Rime & LiveKit",
  body: "FlowVoice stops speech instantly when you barge in, fences stale asynchronous tool executions from prior conversational generations, and recovers state seamlessly.",
  cta: "CONNECT & START TALKING",
};

export const floatingLabels = [
  { id: "lat", label: "STOP LATENCY", value: "< 250 ms", position: "top-right" },
  { id: "acc", label: "STALE LEAKAGE", value: "0.00 %", position: "mid-right" },
  { id: "smp", label: "TTS ENGINE", value: "Rime Coda (WebSocket)", position: "bottom-right" },
];

export const marqueeSpecs = [
  "RIME CODA TTS",
  "LIVEKIT WEBRTC",
  "GENERATION FENCING",
  "SUB-250MS BARGE-IN",
  "STALE RESULT DISCARD",
  "SILERO VAD",
  "DATACHANNEL TELEMETRY",
];

export type VerificationState =
  | "idle"
  | "connecting"
  | "listening"
  | "analyzing"
  | "speaking"
  | "interrupted"
  | "verified"
  | "error";

export const verificationStates: Record<VerificationState, { label: string; hint: string }> = {
  idle: { label: "CONNECT & TALK", hint: "AWAITING CONNECTION" },
  connecting: { label: "CONNECTING...", hint: "FETCHING TOKEN & JOINING ROOM" },
  listening: { label: "LISTENING", hint: "MICROPHONE ACTIVE — SPEAK FREELY" },
  analyzing: { label: "PROCESSING", hint: "LLM / TOOL REASONING" },
  speaking: { label: "FLOWVOICE SPEAKING", hint: "RIME CODA TTS STREAMING" },
  interrupted: { label: "INTERRUPTED", hint: "BARGE-IN DETECTED — FENCING STALE WORK" },
  verified: { label: "SESSION ACTIVE", hint: "CONNECTED TO FLOWVOICE BACKEND" },
  error: { label: "CONNECTION ERROR", hint: "CHECK TOKEN SERVER ON PORT 8000" },
};
