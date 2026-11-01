import { describe, expect, it } from "vitest";
import { runSimulation } from "../../src/sim/runSimulation";
import { assertNoError, eventTypes } from "./helpers";

describe("Phase 1 sync goldens", () => {
  it('TC-B01: console.log(1); console.log(2) prints in order', () => {
    const result = runSimulation(`
      console.log(1);
      console.log(2);
    `);
    assertNoError(result);
    expect(result.console).toEqual(["1", "2"]);
  });

  it("TC-B02: nested sync calls push and pop the stack in order", () => {
    const result = runSimulation(`
      function bar() {
        console.log("bar");
      }
      function foo() {
        console.log("foo");
        bar();
      }
      foo();
    `);
    assertNoError(result);
    expect(result.console).toEqual(["foo", "bar"]);

    const types = eventTypes(result.timeline);
    const pushNames = result.timeline
      .filter((e) => e.type === "pushStack")
      .map((e) => e.name);
    const popNames = result.timeline
      .filter((e) => e.type === "popStack")
      .map((e) => e.name);

    expect(pushNames).toEqual(["(main)", "foo", "bar"]);
    expect(popNames).toEqual(["bar", "foo", "(main)"]);
    expect(types.indexOf("pushStack")).toBeLessThan(types.lastIndexOf("popStack"));
  });

  it("TC-B04: empty program completes with empty console", () => {
    const result = runSimulation(``);
    assertNoError(result);
    expect(result.console).toEqual([]);
  });
});
