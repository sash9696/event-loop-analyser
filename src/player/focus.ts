import type { SimEvent } from "../sim/types";
import type { PanelSnapshot, PlaybackStatus } from "./types";

export type FocusZone =
  | "stack"
  | "api"
  | "micro"
  | "queue"
  | "loop"
  | "console"
  | null;

export type FocusState = {
  zone: FocusZone;
  /** Single sentence the learner should read right now. */
  now: string;
};

export function deriveFocus(
  status: PlaybackStatus,
  snapshot: PanelSnapshot,
  currentEvent: SimEvent | undefined,
): FocusState {
  if (status === "idle") {
    return { zone: null, now: "Press Run to watch one step at a time." };
  }
  if (status === "finished") {
    return {
      zone: "console",
      now: "Finished — read the console order top to bottom.",
    };
  }
  if (!currentEvent) {
    return { zone: null, now: "Ready." };
  }

  switch (currentEvent.type) {
    case "pushStack":
      return {
        zone: "stack",
        now: `Call stack: entered ${currentEvent.label}`,
      };
    case "popStack":
      return {
        zone: "stack",
        now: `Call stack: left ${currentEvent.label}`,
      };
    case "log":
      return {
        zone: "console",
        now: `Console: ${currentEvent.args.join(" ")}`,
      };
    case "scheduleTimer":
      return {
        zone: "api",
        now: `Web APIs: scheduled ${currentEvent.label}`,
      };
    case "timerReady":
      return {
        zone: "api",
        now: `Web APIs: ${currentEvent.label} finished waiting`,
      };
    case "enqueueTask":
      return {
        zone: "queue",
        now: `Callback queue: ${currentEvent.label} is waiting`,
      };
    case "dequeueTask":
      return {
        zone: "loop",
        now: `Event loop: moving ${currentEvent.label} → call stack`,
      };
    case "enqueueMicrotask":
      return {
        zone: "micro",
        now: `Microtask queue: ${currentEvent.label} is waiting`,
      };
    case "dequeueMicrotask":
      return {
        zone: "loop",
        now: `Event loop: draining microtask ${currentEvent.label} → call stack`,
      };
    default:
      return { zone: null, now: snapshot.transit?.name ?? "…" };
  }
}
