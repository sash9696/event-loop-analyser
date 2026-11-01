import { describe, expect, it } from "vitest";
import { runSimulation } from "../../src/sim/runSimulation";
import { assertNoError, eventTypes } from "./helpers";

describe("Phase 2 Promise / microtask goldens", () => {
  it("queueMicrotask runs after sync and before setTimeout", () => {
    const result = runSimulation(`
      console.log("s");
      setTimeout(() => console.log("macro"), 0);
      queueMicrotask(() => console.log("q"));
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s", "q", "macro"]);
    expect(eventTypes(result.timeline)).toContain("enqueueMicrotask");
    expect(eventTypes(result.timeline)).toContain("dequeueMicrotask");
  });

  it("TC-E01: Promise.then beats setTimeout(0)", () => {
    const result = runSimulation(`
      console.log("s1");
      setTimeout(() => console.log("macro"), 0);
      Promise.resolve().then(() => console.log("micro"));
      console.log("s2");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s1", "s2", "micro", "macro"]);
  });

  it("TC-E04/E05: nested then stays before macrotasks", () => {
    const result = runSimulation(`
      Promise.resolve()
        .then(() => {
          console.log("m1");
          return Promise.resolve();
        })
        .then(() => console.log("m2"));
      console.log("s");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s", "m1", "m2"]);
  });

  it("TC-E06: microtasks inside macrotask run before next macrotask", () => {
    const result = runSimulation(`
      setTimeout(() => {
        console.log("macro-start");
        Promise.resolve().then(() => console.log("micro-in-macro"));
        console.log("macro-end");
      }, 0);
      Promise.resolve().then(() => console.log("micro-first"));
    `);
    assertNoError(result);
    expect(result.console).toEqual([
      "micro-first",
      "macro-start",
      "macro-end",
      "micro-in-macro",
    ]);
  });

  it("TC-E07: queueMicrotask and then are both before macros", () => {
    const result = runSimulation(`
      queueMicrotask(() => console.log("q"));
      Promise.resolve().then(() => console.log("p"));
      console.log("s");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s", "q", "p"]);
  });

  it("EC-043: Promise executor runs synchronously", () => {
    const result = runSimulation(`
      new Promise((resolve) => {
        console.log("exec");
        resolve();
      }).then(() => console.log("then"));
      console.log("s");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["exec", "s", "then"]);
  });

  it("EC-044: then on already-resolved promise is still async", () => {
    const result = runSimulation(`
      const p = Promise.resolve();
      p.then(() => console.log("then"));
      console.log("s");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s", "then"]);
  });

  it("TC-E08: catch handles rejection as microtask", () => {
    const result = runSimulation(`
      Promise.reject("x").catch(() => console.log("caught"));
      console.log("s");
    `);
    assertNoError(result);
    expect(result.console).toEqual(["s", "caught"]);
  });
});
