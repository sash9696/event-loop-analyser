import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../src/player/applyEvent";
import { deriveFocus } from "../../src/player/focus";

describe("Focus spotlight", () => {
  it("points at one zone per event", () => {
    const snap = emptySnapshot();
    expect(
      deriveFocus("running", snap, {
        type: "scheduleTimer",
        id: "1",
        delay: 0,
        name: "anonymous",
        label: "timeout #1 · T1",
      }).zone,
    ).toBe("api");

    expect(
      deriveFocus("running", snap, {
        type: "dequeueTask",
        id: "1",
        name: "anonymous",
        label: "timeout #1 · T1",
      }).zone,
    ).toBe("loop");

    expect(
      deriveFocus("running", snap, { type: "log", args: ["Start"] }).zone,
    ).toBe("console");
  });
});
