import type { ArrowFunctionExpression, FunctionExpression, Pattern } from "acorn";

export type Env = {
  parent: Env | null;
  bindings: Map<string, Value>;
};

export type FnValue = {
  kind: "fn";
  name: string;
  params: Pattern[];
  body: ArrowFunctionExpression["body"] | FunctionExpression["body"];
  env: Env;
  expression: boolean;
  line?: number;
};

export type PromiseReaction = {
  onFulfilled?: FnValue;
  onRejected?: FnValue;
  derived: PromiseValue;
  label: string;
};

export type PromiseValue = {
  kind: "promise";
  id: string;
  state: "pending" | "fulfilled" | "rejected";
  result: Value;
  reactions: PromiseReaction[];
};

export type Value =
  | { kind: "undefined" }
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | FnValue
  | PromiseValue
  | { kind: "native"; name: "console.log" | "setTimeout" | "queueMicrotask" }
  | { kind: "promiseCtor" }
  | {
      kind: "promiseMethod";
      method: "then" | "catch" | "resolve" | "reject";
      target?: PromiseValue;
    }
  | { kind: "object"; name: "console" };

export const UNDEFINED: Value = { kind: "undefined" };

export function createEnv(parent: Env | null = null): Env {
  return { parent, bindings: new Map() };
}

export function valueToLogString(value: Value): string {
  switch (value.kind) {
    case "undefined":
      return "undefined";
    case "null":
      return "null";
    case "boolean":
    case "number":
      return String(value.value);
    case "string":
      return value.value;
    case "fn":
      return value.name ? `[Function: ${value.name}]` : "[Function]";
    case "promise":
      return `[Promise ${value.state}]`;
    case "native":
      return `[Native: ${value.name}]`;
    case "promiseCtor":
      return "[Function: Promise]";
    case "promiseMethod":
      return `[Promise.${value.method}]`;
    case "object":
      return `[Object: ${value.name}]`;
  }
}

export function toNumber(value: Value): number {
  switch (value.kind) {
    case "number":
      return value.value;
    case "boolean":
      return value.value ? 1 : 0;
    case "string": {
      const n = Number(value.value);
      return Number.isFinite(n) ? n : 0;
    }
    default:
      return 0;
  }
}

export function envGet(env: Env, name: string): Value | undefined {
  let current: Env | null = env;
  while (current) {
    if (current.bindings.has(name)) return current.bindings.get(name);
    current = current.parent;
  }
  return undefined;
}

export function envSet(env: Env, name: string, value: Value): void {
  let current: Env | null = env;
  while (current) {
    if (current.bindings.has(name)) {
      current.bindings.set(name, value);
      return;
    }
    current = current.parent;
  }
  env.bindings.set(name, value);
}

export function envDefine(env: Env, name: string, value: Value): void {
  env.bindings.set(name, value);
}
