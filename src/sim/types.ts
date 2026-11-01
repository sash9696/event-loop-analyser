export type SimEvent =
  | { type: "pushStack"; name: string; label: string; line?: number }
  | { type: "popStack"; name: string; label: string }
  | { type: "log"; args: string[]; line?: number }
  | {
      type: "scheduleTimer";
      id: string;
      delay: number;
      name: string;
      label: string;
      hint?: string;
      line?: number;
    }
  | { type: "timerReady"; id: string; label: string }
  | { type: "enqueueTask"; id: string; name: string; label: string }
  | { type: "dequeueTask"; id: string; name: string; label: string };

export type SimulationResult = {
  console: string[];
  timeline: SimEvent[];
  error?: string;
};

export type RunSimulationOptions = {
  /** Max interpreter steps before aborting (runaway loops / recursion). */
  maxSteps?: number;
};
