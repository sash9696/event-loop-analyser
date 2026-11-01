import { describe, expect, it } from "vitest";
import { runSimulation } from "../../src/sim/runSimulation";

describe("Error / unsupported goldens", () => {
  it("TC-F01: import is unsupported / parse or runtime error", () => {
    const result = runSimulation(`import x from "y";`);
    expect(result.error).toBeTruthy();
    expect(result.console).toEqual([]);
  });

  it("TC-F03: syntax error aborts with message", () => {
    const result = runSimulation(`function (`);
    expect(result.error).toBeTruthy();
  });
});
