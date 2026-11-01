import { parse } from "acorn";
import { Interpreter } from "./interpreter";
import type { RunSimulationOptions, SimulationResult } from "./types";

const DEFAULT_MAX_STEPS = 100_000;

export function runSimulation(
  source: string,
  options: RunSimulationOptions = {},
): SimulationResult {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;

  let program;
  try {
    program = parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
    });
  } catch (err) {
    return {
      console: [],
      timeline: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const interpreter = new Interpreter(program, maxSteps);
  interpreter.run();

  return {
    console: interpreter.console,
    timeline: interpreter.timeline,
    error: interpreter.error,
  };
}
