import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";

export type FlowVoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "analyzing"
  | "speaking"
  | "interrupted"
  | "verified"
  | "error";

export interface TranscriptItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  interrupted?: boolean;
  timestamp: string;
}

export interface TraceLogItem {
  id: string;
  ts: string;
  kind: string;
  payload: Record<string, unknown>;
  isHot?: boolean;
}

export interface FlowVoiceMetrics {
  stopLatencyMs: string;
  staleLeakage: string;
  correctRecovery: string;
  stateConsistency: string;
}

export interface ActivityChips {
  stt: boolean;
  llm: boolean;
  tool: boolean;
  tts: boolean;
  playback: boolean;
}

interface TraceEventPayload {
  who?: string;
  new_state?: string;
  text_preview?: string;
  text?: string;
  interrupted?: boolean;
  stale?: boolean;
  pass?: boolean;
  state_consistent?: boolean;
  [key: string]: unknown;
}

const DEFAULT_TOKEN_SERVER_URL = "http://localhost:8000/token";

export function useFlowVoice() {
  const [voiceState, setVoiceState] = useState<FlowVoiceState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolDelay, setToolDelayState] = useState<number>(1000);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [traceLog, setTraceLog] = useState<TraceLogItem[]>([]);
  const [metrics, setMetrics] = useState<FlowVoiceMetrics>({
    stopLatencyMs: "—",
    staleLeakage: "0 / 0",
    correctRecovery: "not yet measured",
    stateConsistency: "not yet measured",
  });
  const [chips, setChips] = useState<ActivityChips>({
    stt: false,
    llm: false,
    tool: false,
    tts: false,
    playback: false,
  });

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLMediaElement[]>([]);
  const lastInterruptionAtRef = useRef<number | null>(null);
  const staleTotalRef = useRef(0);
  const staleRejectedRef = useRef(0);
  const chipTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashChip = useCallback((name: keyof ActivityChips, ms = 900) => {
    setChips((prev) => ({ ...prev, [name]: true }));
    if (chipTimersRef.current[name]) {
      clearTimeout(chipTimersRef.current[name]);
    }
    chipTimersRef.current[name] = setTimeout(() => {
      setChips((prev) => ({ ...prev, [name]: false }));
    }, ms);
  }, []);

  const handleTraceEvent = useCallback(
    (evt: { kind: string; payload: TraceEventPayload; ts?: string }) => {
      const { kind, payload } = evt;
      const isHot = kind === "interruption_detected" || kind === "stale_result_rejected";
      const ts = new Date().toLocaleTimeString();

      setTraceLog((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          ts,
          kind,
          payload,
          isHot,
        },
      ]);

      switch (kind) {
        case "state_changed":
          if (payload.who === "agent") {
            if (payload.new_state === "speaking") {
              setVoiceState("speaking");
              flashChip("tts");
              flashChip("playback");
            } else if (payload.new_state === "listening") {
              setVoiceState("listening");
            } else if (payload.new_state === "thinking") {
              setVoiceState("analyzing");
              flashChip("llm");
            }
          }
          if (payload.who === "user" && payload.new_state === "speaking") {
            setVoiceState("listening");
            flashChip("stt");
          }
          break;

        case "interruption_detected":
          lastInterruptionAtRef.current = performance.now();
          setVoiceState("interrupted");
          setTimeout(() => {
            setVoiceState((current) => (current === "interrupted" ? "listening" : current));
          }, 600);
          break;

        case "assistant_item_committed":
          if (payload.text_preview) {
            setTranscript((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                role: "assistant",
                text: payload.text_preview || "",
                interrupted: payload.interrupted,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          }
          if (payload.interrupted && lastInterruptionAtRef.current != null) {
            const latencyMs = Math.round(performance.now() - lastInterruptionAtRef.current);
            setMetrics((prev) => ({ ...prev, stopLatencyMs: `${latencyMs} ms` }));
            lastInterruptionAtRef.current = null;
          }
          break;

        case "user_transcript_final":
          if (payload.text) {
            setTranscript((prev) => [
              ...prev,
              {
                id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                role: "user",
                text: payload.text || "",
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          }
          break;

        case "tool_started":
          setVoiceState("analyzing");
          flashChip("tool", 1500);
          break;

        case "tool_completed":
          if (payload.stale !== undefined) {
            staleTotalRef.current += 1;
            if (payload.stale) staleRejectedRef.current += 1;
            setMetrics((prev) => ({
              ...prev,
              staleLeakage: `${staleRejectedRef.current} / ${staleTotalRef.current}`,
            }));
          }
          break;

        case "llm_started":
          setVoiceState("analyzing");
          flashChip("llm");
          break;

        case "stress_test_result":
          setMetrics((prev) => ({
            ...prev,
            correctRecovery: payload.pass ? "PASS" : "FAIL",
            stateConsistency: payload.state_consistent ? "PASS" : "FAIL",
          }));
          break;
      }
    },
    [flashChip],
  );

  const publishData = useCallback((payload: Record<string, unknown>) => {
    if (!roomRef.current) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      roomRef.current.localParticipant.publishData(data, { reliable: true });
    } catch (err) {
      console.warn("Failed to publish data to LiveKit:", err);
    }
  }, []);

  const setToolDelay = useCallback(
    (ms: number) => {
      setToolDelayState(ms);
      publishData({ type: "set_tool_delay", ms });
    },
    [publishData],
  );

  const runStressTest = useCallback(() => {
    publishData({ type: "run_stress_test" });
  }, [publishData]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (err) {
        console.error("Error disconnecting from LiveKit room:", err);
      }
      roomRef.current = null;
    }
    audioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    });
    audioElementsRef.current = [];
    setIsConnected(false);
    setIsConnecting(false);
    setVoiceState("idle");
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (isConnecting || isConnected) {
      disconnect();
      return;
    }

    setIsConnecting(true);
    setError(null);
    setVoiceState("connecting");

    const tokenServerUrl =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_TOKEN_SERVER_URL) ||
      DEFAULT_TOKEN_SERVER_URL;

    try {
      const res = await fetch(tokenServerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(
          `Token request failed (${res.status}). Ensure backend/token_server.py is running on port 8000.`,
        );
      }

      const { token, url } = await res.json();
      if (!token || !url) {
        throw new Error("Invalid token server response (missing token or url).");
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type === "flowvoice_trace") {
            handleTraceEvent(msg);
          }
        } catch {
          /* ignore malformed frames */
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          document.body.appendChild(el);
          audioElementsRef.current.push(el);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => {
          el.remove();
          audioElementsRef.current = audioElementsRef.current.filter((e) => e !== el);
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setVoiceState("idle");
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setIsConnected(true);
      setIsConnecting(false);
      setVoiceState("listening");

      // Sync initial tool delay
      const data = new TextEncoder().encode(
        JSON.stringify({ type: "set_tool_delay", ms: toolDelay }),
      );
      room.localParticipant.publishData(data, { reliable: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect to LiveKit voice backend.";
      console.error("LiveKit connection error:", err);
      setError(msg);
      setVoiceState("error");
      setIsConnecting(false);
      setIsConnected(false);
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {
          /* ignore */
        }
        roomRef.current = null;
      }
    }
  }, [isConnecting, isConnected, disconnect, handleTraceEvent, toolDelay]);

  useEffect(() => {
    const activeTimers = chipTimersRef.current;
    const activeAudios = audioElementsRef.current;
    return () => {
      Object.values(activeTimers).forEach(clearTimeout);
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {
          /* ignore */
        }
      }
      activeAudios.forEach((el) => {
        try {
          el.pause();
          el.srcObject = null;
          el.remove();
        } catch {
          /* ignore */
        }
      });
    };
  }, []);

  return {
    voiceState,
    isConnected,
    isConnecting,
    error,
    transcript,
    traceLog,
    metrics,
    chips,
    toolDelay,
    setToolDelay,
    runStressTest,
    connect,
    disconnect,
  };
}
