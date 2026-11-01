import type { SimEvent } from "../sim/types";
import type { LoopPhase, PanelSnapshot, PlaybackStatus } from "./types";

export function deriveLoopPhase(
  status: PlaybackStatus,
  snapshot: PanelSnapshot,
  currentEvent: SimEvent | undefined,
): LoopPhase {
  if (status === "idle") return "idle";
  if (
    currentEvent?.type === "dequeueTask" ||
    currentEvent?.type === "dequeueMicrotask" ||
    snapshot.loopTransfer ||
    snapshot.transit
  ) {
    return "transfer";
  }
  if (snapshot.callStack.length > 0) {
    if (
      snapshot.microtaskQueue.length > 0 ||
      snapshot.callbackQueue.length > 0 ||
      snapshot.webApis.length > 0
    ) {
      return "waiting-stack";
    }
    return "executing";
  }
  if (snapshot.microtaskQueue.length > 0) return "waiting-task";
  if (snapshot.callbackQueue.length > 0) return "waiting-task";
  if (status === "finished") return "idle";
  return "idle";
}

export function loopPhaseCaption(phase: LoopPhase): string {
  switch (phase) {
    case "idle":
      return "Idle — nothing to move";
    case "executing":
      return "Running JS on the call stack";
    case "waiting-stack":
      return "Waiting for an empty call stack";
    case "waiting-task":
      return "Stack empty — drain microtasks, then macrotasks";
    case "transfer":
      return "Event loop → moving callback to stack";
  }
}
