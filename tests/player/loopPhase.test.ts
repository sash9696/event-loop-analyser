import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../src/player/applyEvent";
import { deriveLoopPhase } from "../../src/player/loopPhase";

describe("Event loop phase", () => {
  it("transfer only on dequeue, not while sync is running", () => {
    const executing = {
      ...emptySnapshot(),
      callStack: [{ id: "1", name: "(main)" }],
    };
    expect(deriveLoopPhase("running", executing, { type: "log", args: ["A"] })).toBe(
      "executing",
    );

    const transfer = {
      ...emptySnapshot(),
      loopTransfer: true,
    };
    expect(
      deriveLoopPhase("running", transfer, {
        type: "dequeueTask",
        id: "1",
        name: "anonymous",
        label: "timeout #1",
      }),
    ).toBe("transfer");
  });

  it("waiting-stack when callbacks are queued but stack is busy", () => {
    const snap = {
      ...emptySnapshot(),
      callStack: [{ id: "1", name: "(main)" }],
      callbackQueue: [{ id: "2", name: "timeout #1" }],
    };
    expect(deriveLoopPhase("running", snap, undefined)).toBe("waiting-stack");
  });
});
