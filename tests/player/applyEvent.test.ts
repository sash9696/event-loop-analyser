import { describe, expect, it } from "vitest";
import { snapshotAt } from "../../src/player/applyEvent";
import { runSimulation } from "../../src/sim/runSimulation";

describe("Player timeline → panels", () => {
  it("TC-C01 player: after full timeline, console is A,C,B and queues empty", () => {
    const sim = runSimulation(`
      console.log("A");
      setTimeout(() => console.log("B"), 0);
      console.log("C");
    `);
    const snap = snapshotAt(sim.timeline, sim.timeline.length - 1);
    expect(snap.console).toEqual(["A", "C", "B"]);
    expect(snap.callStack).toEqual([]);
    expect(snap.webApis).toEqual([]);
    expect(snap.callbackQueue).toEqual([]);
  });

  it("TC-C01 player: timer sits in Web APIs before first enqueueTask", () => {
    const sim = runSimulation(`
      console.log("A");
      setTimeout(() => console.log("B"), 0);
      console.log("C");
    `);
    const enqueueIndex = sim.timeline.findIndex((e) => e.type === "enqueueTask");
    expect(enqueueIndex).toBeGreaterThan(0);
    const before = snapshotAt(sim.timeline, enqueueIndex - 1);
    expect(before.webApis.length).toBe(1);
    expect(before.callbackQueue.length).toBe(0);
  });

  it("labels timers as timeout #N with first-log hint", () => {
    const sim = runSimulation(`
      setTimeout(() => console.log("T1"), 0);
      setTimeout(() => console.log("T2"), 0);
    `);
    const scheduled = sim.timeline.filter((e) => e.type === "scheduleTimer");
    expect(scheduled.map((e) => e.label)).toEqual([
      "timeout #1 · T1",
      "timeout #2 · T2",
    ]);

    const afterSchedule = snapshotAt(
      sim.timeline,
      sim.timeline.findIndex((e) => e.type === "scheduleTimer" && e.id === "2"),
    );
    expect(afterSchedule.webApis.map((f) => f.name)).toEqual([
      "timeout #1 · T1",
      "timeout #2 · T2",
    ]);
    expect(afterSchedule.webApis[0]?.detail).toContain("0ms");
  });

  it("marks Web API timer ready before enqueue", () => {
    const sim = runSimulation(`
      setTimeout(() => console.log("B"), 0);
      console.log("A");
    `);
    const readyIndex = sim.timeline.findIndex((e) => e.type === "timerReady");
    const snap = snapshotAt(sim.timeline, readyIndex);
    expect(snap.webApis[0]?.status).toBe("ready");
    expect(snap.loopTransfer).toBe(false);
  });

  it("holds callback in transit on dequeueTask", () => {
    const sim = runSimulation(`
      setTimeout(() => console.log("B"), 0);
      console.log("A");
    `);
    const dequeueIndex = sim.timeline.findIndex((e) => e.type === "dequeueTask");
    const snap = snapshotAt(sim.timeline, dequeueIndex);
    expect(snap.loopTransfer).toBe(true);
    expect(snap.callbackQueue).toEqual([]);
    expect(snap.transit?.name).toContain("timeout #1");
    expect(snap.transit?.name).toContain("B");
  });

  it("tracks microtask queue before drain", () => {
    const sim = runSimulation(`
      Promise.resolve().then(() => console.log("micro"));
      console.log("s");
    `);
    const enqueueIndex = sim.timeline.findIndex(
      (e) => e.type === "enqueueMicrotask",
    );
    expect(enqueueIndex).toBeGreaterThanOrEqual(0);
    const before = snapshotAt(sim.timeline, enqueueIndex);
    expect(before.microtaskQueue.length).toBe(1);
    expect(before.callbackQueue.length).toBe(0);

    const dequeueIndex = sim.timeline.findIndex(
      (e) => e.type === "dequeueMicrotask",
    );
    const during = snapshotAt(sim.timeline, dequeueIndex);
    expect(during.loopTransfer).toBe(true);
    expect(during.microtaskQueue).toEqual([]);
    expect(during.transit?.name).toBeTruthy();
  });
});



