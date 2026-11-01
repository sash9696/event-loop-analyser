import { useEffect, useRef, useState } from "react";
import { emptySnapshot, snapshotAt } from "../player/applyEvent";
import type { PanelSnapshot, PlaybackStatus } from "../player/types";
import { runSimulation } from "../sim/runSimulation";
import type { SimEvent } from "../sim/types";

const SPEED_MS: Record<number, number> = {
  0.25: 1200,
  0.5: 700,
  1: 400,
  2: 200,
  4: 100,
};

export function usePlayback(source: string) {
  const [timeline, setTimeline] = useState<SimEvent[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [cursor, setCursor] = useState(-1);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [speed, setSpeed] = useState(0.5);
  const [snapshot, setSnapshot] = useState<PanelSnapshot>(emptySnapshot());
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    setSnapshot(cursor < 0 ? emptySnapshot() : snapshotAt(timeline, cursor));
  }, [timeline, cursor]);

  const resetVisual = () => {
    setCursor(-1);
    setSnapshot(emptySnapshot());
  };

  const load = () => {
    const result = runSimulation(source);
    setTimeline(result.timeline);
    setError(result.error);
    resetVisual();
    return result;
  };

  const run = () => {
    const result = load();
    if (result.error) {
      setStatus("idle");
      return;
    }
    if (result.timeline.length === 0) {
      setStatus("finished");
      return;
    }
    setStatus("running");
    setCursor(0);
  };

  const pause = () => {
    if (status === "running") setStatus("paused");
  };

  const resume = () => {
    if (status === "paused" && cursor < timeline.length - 1) {
      setStatus("running");
    }
  };

  const step = () => {
    if (timeline.length === 0) {
      const result = load();
      if (result.error || result.timeline.length === 0) {
        setStatus("finished");
        return;
      }
      setStatus("paused");
      setCursor(0);
      return;
    }
    if (cursor >= timeline.length - 1) {
      setStatus("finished");
      return;
    }
    setStatus("paused");
    setCursor((c) => c + 1);
  };

  const rerun = () => run();

  useEffect(() => {
    if (status !== "running") return;
    if (cursor < 0) return;
    if (cursor >= timeline.length - 1) {
      setStatus("finished");
      return;
    }
    const current = timeline[cursor];
    const base = SPEED_MS[speed] ?? 400;
    // Hold the queue→stack beat a little longer so the transit chip is readable.
    const delay =
      current?.type === "dequeueTask" || current?.type === "enqueueTask"
        ? Math.round(base * 1.45)
        : base;
    const id = window.setTimeout(() => {
      if (statusRef.current !== "running") return;
      setCursor((c) => c + 1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [status, cursor, timeline, speed]);

  const currentEvent =
    cursor >= 0 && cursor < timeline.length ? timeline[cursor] : undefined;

  return {
    timeline,
    error,
    cursor,
    status,
    speed,
    setSpeed,
    snapshot,
    currentEvent,
    run,
    pause,
    resume,
    step,
    rerun,
    resetVisual,
  };
}
