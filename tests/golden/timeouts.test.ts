import { describe, expect, it } from "vitest";
import { runSimulation } from "../../src/sim/runSimulation";
import {
  assertNoError,
  eventTypes,
  firstTaskRunsOnlyWhenStackEmpty,
} from "./helpers";

describe("Phase 1 setTimeout goldens", () => {
  it("TC-C01: setTimeout(0) logs A, C, then B", () => {
    const result = runSimulation(`
      console.log("A");
      setTimeout(() => console.log("B"), 0);
      console.log("C");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["A", "C", "B"]);
    expect(eventTypes(result.timeline)).toContain("scheduleTimer");
    expect(eventTypes(result.timeline)).toContain("enqueueTask");
    expect(firstTaskRunsOnlyWhenStackEmpty(result.timeline)).toBe(true);
  });

  it("TC-C02: sibling zero-delay timeouts run FIFO after sync", () => {
    const result = runSimulation(`
      setTimeout(() => console.log("T1"), 0);
      setTimeout(() => console.log("T2"), 0);
      console.log("sync");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["sync", "T1", "T2"]);
  });

  it("TC-C05: nested timeout runs after outer turn", () => {
    const result = runSimulation(`
      setTimeout(function () {
        console.log("outer");
        setTimeout(function () {
          console.log("inner");
        }, 0);
      }, 0);
      console.log("sync");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["sync", "outer", "inner"]);
  });

  it("TC-C08: Loupe-style fixture console order", () => {
    const result = runSimulation(`
      console.log("Start");
      setTimeout(function () {
        console.log("Timeout 1");
        setTimeout(function () {
          console.log("Nested Timeout");
        }, 0);
      }, 0);
      setTimeout(function () {
        console.log("Timeout 2");
      }, 0);
      function test() {
        console.log("Inside test");
        setTimeout(function () {
          console.log("Timeout 3");
        }, 0);
        console.log("test finished");
      }
      test();
      console.log("End");
    `);
    assertNoError(result);
    expect(result.console).toEqual([
      "Start",
      "Inside test",
      "test finished",
      "End",
      "Timeout 1",
      "Timeout 2",
      "Timeout 3",
      "Nested Timeout",
    ]);
  });

  it("TC-C11: earlier delay wins over later delay", () => {
    const result = runSimulation(`
      setTimeout(() => console.log("late"), 20);
      setTimeout(() => console.log("early"), 0);
    `);
    assertNoError(result);
    expect(result.console).toEqual(["early", "late"]);
  });
});
