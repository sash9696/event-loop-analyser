import type { SimEvent } from "../sim/types";
import type { FrameItem, PanelSnapshot } from "./types";

function cloneSnapshot(snapshot: PanelSnapshot): PanelSnapshot {
  return {
    callStack: snapshot.callStack.map((item) => ({ ...item })),
    webApis: snapshot.webApis.map((item) => ({ ...item })),
    callbackQueue: snapshot.callbackQueue.map((item) => ({ ...item })),
    transit: snapshot.transit ? { ...snapshot.transit } : null,
    console: [...snapshot.console],
    lastEventIndex: snapshot.lastEventIndex,
    loopTransfer: false,
  };
}

export function emptySnapshot(): PanelSnapshot {
  return {
    callStack: [],
    webApis: [],
    callbackQueue: [],
    transit: null,
    console: [],
    lastEventIndex: -1,
    loopTransfer: false,
  };
}

function timerDetail(
  event: Extract<SimEvent, { type: "scheduleTimer" }>,
): string {
  const bits = [`${event.delay}ms`];
  if (event.line != null) bits.push(`line ${event.line}`);
  if (event.name !== "anonymous") bits.push(`${event.name}()`);
  return bits.join(" · ");
}

export function applyEvent(
  snapshot: PanelSnapshot,
  event: SimEvent,
  index: number,
): PanelSnapshot {
  const next = cloneSnapshot(snapshot);
  next.lastEventIndex = index;

  switch (event.type) {
    case "pushStack":
      next.transit = null;
      next.callStack.push({
        id: `stack-${index}`,
        name: event.label,
        detail:
          event.label !== event.name && event.name !== "anonymous"
            ? `${event.name}()`
            : event.line != null
              ? `line ${event.line}`
              : undefined,
      });
      break;
    case "popStack":
      next.callStack.pop();
      break;
    case "log":
      next.console.push(event.args.join(" "));
      break;
    case "scheduleTimer":
      next.webApis.push({
        id: event.id,
        name: event.label,
        detail: timerDetail(event),
        status: "waiting",
      });
      break;
    case "timerReady": {
      const item = next.webApis.find((frame) => frame.id === event.id);
      if (item) item.status = "ready";
      break;
    }
    case "enqueueTask": {
      const idx = next.webApis.findIndex((item) => item.id === event.id);
      let frame: FrameItem;
      if (idx >= 0) {
        frame = { ...next.webApis[idx]!, status: undefined };
        next.webApis.splice(idx, 1);
      } else {
        frame = { id: event.id, name: event.label, detail: "macrotask" };
      }
      next.callbackQueue.push(frame);
      break;
    }
    case "dequeueTask": {
      const idx = next.callbackQueue.findIndex((item) => item.id === event.id);
      const frame =
        idx >= 0
          ? next.callbackQueue.splice(idx, 1)[0]!
          : next.callbackQueue.shift();
      next.transit = frame
        ? { ...frame, id: `transit-${event.id}` }
        : {
            id: event.id,
            name: event.label,
            detail: "moving to call stack",
          };
      next.loopTransfer = true;
      break;
    }
  }

  return next;
}

export function snapshotAt(
  timeline: SimEvent[],
  eventIndex: number,
): PanelSnapshot {
  let snapshot = emptySnapshot();
  const end = Math.min(eventIndex, timeline.length - 1);
  for (let i = 0; i <= end; i += 1) {
    snapshot = applyEvent(snapshot, timeline[i]!, i);
  }
  return snapshot;
}
