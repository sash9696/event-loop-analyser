import type { SimEvent, SimulationResult } from "../../src/sim/types";

export function eventTypes(timeline: SimEvent[]): string[] {
  return timeline.map((e) => e.type);
}

export function firstTaskRunsOnlyWhenStackEmpty(timeline: SimEvent[]): boolean {
  let depth = 0;
  for (const event of timeline) {
    if (event.type === "pushStack") depth += 1;
    if (event.type === "popStack") depth -= 1;
    if (event.type === "dequeueTask") {
      return depth === 0;
    }
  }
  return false;
}

export function assertNoError(result: SimulationResult): void {
  if (result.error) {
    throw new Error(`Simulation error: ${result.error}`);
  }
}
