import { createContext, useContext, type ReactNode } from "react";
import {
  useFlowVoice,
  type FlowVoiceState,
  type TranscriptItem,
  type TraceLogItem,
  type FlowVoiceMetrics,
  type ActivityChips,
} from "@/hooks/use-flowvoice";

interface FlowVoiceContextValue {
  voiceState: FlowVoiceState;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  transcript: TranscriptItem[];
  traceLog: TraceLogItem[];
  metrics: FlowVoiceMetrics;
  chips: ActivityChips;
  toolDelay: number;
  setToolDelay: (ms: number) => void;
  runStressTest: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const FlowVoiceContext = createContext<FlowVoiceContextValue | null>(null);

export function FlowVoiceProvider({ children }: { children: ReactNode }) {
  const voice = useFlowVoice();
  return <FlowVoiceContext.Provider value={voice}>{children}</FlowVoiceContext.Provider>;
}

export function useFlowVoiceSession() {
  const ctx = useContext(FlowVoiceContext);
  if (!ctx) {
    throw new Error("useFlowVoiceSession must be used within a FlowVoiceProvider");
  }
  return ctx;
}
