export type FrameItem = {
  id: string;
  /** Primary visible title, e.g. "timeout #1 · Timeout 1". */
  name: string;
  /** Secondary hint, e.g. "0ms · L3". */
  detail?: string;
  /** Web API timer state before it moves to the queue. */
  status?: "waiting" | "ready";
};

export type PanelSnapshot = {
  callStack: FrameItem[];
  webApis: FrameItem[];
  microtaskQueue: FrameItem[];
  callbackQueue: FrameItem[];
  /** Callback currently moving through the event loop (queue → stack). */
  transit: FrameItem | null;
  console: string[];
  lastEventIndex: number;
  /** True when the latest applied event is a queue→stack handoff. */
  loopTransfer: boolean;
};

export type PlaybackStatus = "idle" | "running" | "paused" | "finished";

export type LoopPhase =
  | "idle"
  | "executing"
  | "waiting-stack"
  | "waiting-task"
  | "transfer";
