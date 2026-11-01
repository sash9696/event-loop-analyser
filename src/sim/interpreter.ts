import type {
  ArrowFunctionExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Node,
  Pattern,
  Program,
  Statement,
  VariableDeclarator,
} from "acorn";
import { hintFromCallback } from "./labelHint";
import type { SimEvent } from "./types";
import {
  createEnv,
  envDefine,
  envGet,
  envSet,
  toNumber,
  UNDEFINED,
  valueToLogString,
  type Env,
  type FnValue,
  type PromiseReaction,
  type PromiseValue,
  type Value,
} from "./values";

type TimerRecord = {
  id: string;
  due: number;
  callback: FnValue;
  name: string;
  label: string;
  ready: boolean;
};

type TaskRecord = {
  id: string;
  callback: FnValue;
  name: string;
  label: string;
};

type MicrotaskRecord = {
  id: string;
  name: string;
  label: string;
  run: () => void;
};

class ReturnSignal {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}

function asStatements(body: Program["body"]): Statement[] {
  return body.map((node) => {
    if (node.type.startsWith("Export") || node.type.startsWith("Import")) {
      throw new Error(`Unsupported statement: ${node.type}`);
    }
    return node as Statement;
  });
}

export class Interpreter {
  readonly console: string[] = [];
  readonly timeline: SimEvent[] = [];
  error?: string;

  private now = 0;
  private steps = 0;
  private nextTimerId = 1;
  private nextPromiseId = 1;
  private nextMicroId = 1;
  private timers: TimerRecord[] = [];
  private taskQueue: TaskRecord[] = [];
  private microtaskQueue: MicrotaskRecord[] = [];
  private stackDepth = 0;
  private microtasksDrained = 0;
  private program: Program;
  private maxSteps: number;
  private maxMicrotasks: number;

  constructor(program: Program, maxSteps: number, maxMicrotasks = 10_000) {
    this.program = program;
    this.maxSteps = maxSteps;
    this.maxMicrotasks = maxMicrotasks;
  }

  run(): void {
    try {
      const globalEnv = this.createGlobalEnv();
      const body = asStatements(this.program.body);
      this.pushStack("(main)", this.program.loc?.start.line);
      this.hoistFunctions(body, globalEnv);
      for (const stmt of body) {
        this.execStatement(stmt, globalEnv);
      }
      this.popStack("(main)");
      this.drainEventLoop();
    } catch (err) {
      if (!this.error) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  private createGlobalEnv(): Env {
    const env = createEnv(null);
    envDefine(env, "console", { kind: "object", name: "console" });
    envDefine(env, "setTimeout", { kind: "native", name: "setTimeout" });
    envDefine(env, "queueMicrotask", {
      kind: "native",
      name: "queueMicrotask",
    });
    envDefine(env, "Promise", { kind: "promiseCtor" });
    return env;
  }

  private bump(): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw new Error(`Step budget exceeded (${this.maxSteps})`);
    }
  }

  private emit(event: SimEvent): void {
    this.timeline.push(event);
  }

  private pushStack(name: string, line?: number, label = name): void {
    this.stackDepth += 1;
    this.emit({ type: "pushStack", name, label, line });
  }

  private popStack(name: string, label = name): void {
    this.stackDepth -= 1;
    this.emit({ type: "popStack", name, label });
  }

  private hoistFunctions(body: Statement[], env: Env): void {
    for (const stmt of body) {
      if (stmt.type === "FunctionDeclaration" && stmt.id) {
        envDefine(env, stmt.id.name, this.fnFromDeclaration(stmt, env));
      }
    }
  }

  private fnFromDeclaration(node: FunctionDeclaration, env: Env): FnValue {
    return {
      kind: "fn",
      name: node.id?.name ?? "anonymous",
      params: node.params,
      body: node.body,
      env,
      expression: false,
      line: node.loc?.start.line,
    };
  }

  private fnFromExpression(
    node: FunctionExpression | ArrowFunctionExpression,
    env: Env,
    fallbackName = "anonymous",
  ): FnValue {
    const name =
      node.type === "FunctionExpression" && node.id
        ? node.id.name
        : fallbackName;
    return {
      kind: "fn",
      name,
      params: node.params,
      body: node.body,
      env,
      expression: node.type === "ArrowFunctionExpression" && node.expression,
      line: node.loc?.start.line,
    };
  }

  private enqueueMicrotask(
    name: string,
    label: string,
    run: () => void,
  ): void {
    const id = String(this.nextMicroId++);
    this.emit({ type: "enqueueMicrotask", id, name, label });
    this.microtaskQueue.push({ id, name, label, run });
  }

  private drainMicrotasks(): void {
    while (this.microtaskQueue.length > 0 && !this.error) {
      this.microtasksDrained += 1;
      if (this.microtasksDrained > this.maxMicrotasks) {
        throw new Error(
          `Microtask budget exceeded (${this.maxMicrotasks})`,
        );
      }
      const job = this.microtaskQueue.shift()!;
      this.emit({
        type: "dequeueMicrotask",
        id: job.id,
        name: job.name,
        label: job.label,
      });
      job.run();
    }
  }

  private drainEventLoop(): void {
    while (!this.error) {
      this.drainMicrotasks();
      this.fireReadyTimers();

      if (this.taskQueue.length === 0) {
        const next = this.nextPendingTimer();
        if (!next) {
          this.drainMicrotasks();
          if (this.taskQueue.length === 0 && !this.nextPendingTimer()) break;
          continue;
        }
        this.now = next.due;
        this.fireReadyTimers();
      }

      this.drainMicrotasks();
      if (this.taskQueue.length === 0) continue;
      if (this.stackDepth !== 0) {
        throw new Error("Invariant: task dequeued while stack non-empty");
      }

      const task = this.taskQueue.shift()!;
      this.emit({
        type: "dequeueTask",
        id: task.id,
        name: task.name,
        label: task.label,
      });
      this.callFunction(task.callback, [], task.label);
    }
  }

  private nextPendingTimer(): TimerRecord | undefined {
    return this.timers
      .filter((t) => !t.ready)
      .sort((a, b) => a.due - b.due || Number(a.id) - Number(b.id))[0];
  }

  private fireReadyTimers(): void {
    const ready = this.timers
      .filter((t) => !t.ready && t.due <= this.now)
      .sort((a, b) => a.due - b.due || Number(a.id) - Number(b.id));

    for (const timer of ready) {
      timer.ready = true;
      this.emit({ type: "timerReady", id: timer.id, label: timer.label });
      this.emit({
        type: "enqueueTask",
        id: timer.id,
        name: timer.name,
        label: timer.label,
      });
      this.taskQueue.push({
        id: timer.id,
        callback: timer.callback,
        name: timer.name,
        label: timer.label,
      });
    }
  }

  private createPromise(state: PromiseValue["state"] = "pending"): PromiseValue {
    return {
      kind: "promise",
      id: String(this.nextPromiseId++),
      state,
      result: UNDEFINED,
      reactions: [],
    };
  }

  private fulfillPromise(promise: PromiseValue, value: Value): void {
    if (promise.state !== "pending") return;
    promise.state = "fulfilled";
    promise.result = value;
    this.flushReactions(promise);
  }

  private rejectPromise(promise: PromiseValue, reason: Value): void {
    if (promise.state !== "pending") return;
    promise.state = "rejected";
    promise.result = reason;
    this.flushReactions(promise);
  }

  private resolvePromise(promise: PromiseValue, value: Value): void {
    if (value.kind === "promise") {
      if (value === promise) {
        this.rejectPromise(promise, {
          kind: "string",
          value: "TypeError: Chaining cycle detected",
        });
        return;
      }
      const link = () => {
        if (value.state === "fulfilled") {
          this.resolvePromise(promise, value.result);
        } else if (value.state === "rejected") {
          this.rejectPromise(promise, value.result);
        }
      };
      if (value.state !== "pending") {
        this.enqueueMicrotask("adopt", `promise #${promise.id}`, link);
      } else {
        value.reactions.push({
          derived: promise,
          label: `adopt #${promise.id}`,
        });
      }
      return;
    }
    this.fulfillPromise(promise, value);
  }

  private flushReactions(promise: PromiseValue): void {
    const reactions = promise.reactions.splice(0);
    for (const reaction of reactions) {
      this.enqueueMicrotask("then", reaction.label, () => {
        this.runReaction(promise, reaction);
      });
    }
  }

  private runReaction(promise: PromiseValue, reaction: PromiseReaction): void {
    try {
      if (promise.state === "fulfilled") {
        if (!reaction.onFulfilled) {
          this.resolvePromise(reaction.derived, promise.result);
          return;
        }
        const ret = this.callFunction(
          reaction.onFulfilled,
          [promise.result],
          reaction.label,
        );
        this.resolvePromise(reaction.derived, ret);
        return;
      }
      if (promise.state === "rejected") {
        if (!reaction.onRejected) {
          this.rejectPromise(reaction.derived, promise.result);
          return;
        }
        const ret = this.callFunction(
          reaction.onRejected,
          [promise.result],
          reaction.label,
        );
        this.resolvePromise(reaction.derived, ret);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.rejectPromise(reaction.derived, { kind: "string", value: message });
    }
  }

  private promiseThenPublic(
    promise: PromiseValue,
    onFulfilled?: FnValue,
    onRejected?: FnValue,
  ): PromiseValue {
    const derived = this.createPromise("pending");
    const reactionLabel =
      onRejected && !onFulfilled
        ? `catch #${derived.id}`
        : `then #${derived.id}`;
    const hint = onFulfilled
      ? hintFromCallback(onFulfilled)
      : onRejected
        ? hintFromCallback(onRejected)
        : undefined;
    const display = hint ? `${reactionLabel} · ${hint}` : reactionLabel;

    const reaction: PromiseReaction = {
      onFulfilled,
      onRejected,
      derived,
      label: display,
    };

    if (promise.state === "pending") {
      promise.reactions.push(reaction);
    } else {
      this.enqueueMicrotask("then", display, () => {
        this.runReaction(promise, reaction);
      });
    }
    return derived;
  }

  private execStatement(stmt: Statement, env: Env): void {
    this.bump();
    switch (stmt.type) {
      case "EmptyStatement":
        return;
      case "BlockStatement": {
        const child = createEnv(env);
        this.hoistFunctions(stmt.body, child);
        for (const inner of stmt.body) {
          this.execStatement(inner, child);
        }
        return;
      }
      case "ExpressionStatement":
        this.evalExpression(stmt.expression, env);
        return;
      case "FunctionDeclaration":
        return;
      case "VariableDeclaration":
        for (const decl of stmt.declarations) {
          this.execDeclarator(decl, env);
        }
        return;
      case "ReturnStatement": {
        const value = stmt.argument
          ? this.evalExpression(stmt.argument, env)
          : UNDEFINED;
        throw new ReturnSignal(value);
      }
      case "IfStatement": {
        const test = this.evalExpression(stmt.test, env);
        if (this.isTruthy(test)) this.execStatement(stmt.consequent, env);
        else if (stmt.alternate) this.execStatement(stmt.alternate, env);
        return;
      }
      default:
        throw new Error(`Unsupported statement: ${stmt.type}`);
    }
  }

  private execDeclarator(decl: VariableDeclarator, env: Env): void {
    if (decl.id.type !== "Identifier") {
      throw new Error("Only simple variable bindings are supported");
    }
    const value = decl.init ? this.evalExpression(decl.init, env) : UNDEFINED;
    envDefine(env, decl.id.name, value);
  }

  private evalExpression(expr: Expression, env: Env): Value {
    this.bump();
    switch (expr.type) {
      case "Literal": {
        const v = expr.value;
        if (v === null) return { kind: "null" };
        if (typeof v === "string") return { kind: "string", value: v };
        if (typeof v === "number") return { kind: "number", value: v };
        if (typeof v === "boolean") return { kind: "boolean", value: v };
        throw new Error("Unsupported literal");
      }
      case "Identifier":
        return this.evalIdentifier(expr, env);
      case "MemberExpression":
        return this.evalMember(expr, env);
      case "CallExpression":
        return this.evalCall(expr, env);
      case "NewExpression":
        return this.evalNew(expr, env);
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        return this.fnFromExpression(expr, env);
      case "UnaryExpression": {
        const arg = this.evalExpression(expr.argument, env);
        if (expr.operator === "-" && arg.kind === "number") {
          return { kind: "number", value: -arg.value };
        }
        if (expr.operator === "!") {
          return { kind: "boolean", value: !this.isTruthy(arg) };
        }
        throw new Error(`Unsupported unary operator: ${expr.operator}`);
      }
      case "BinaryExpression": {
        const left = this.evalExpression(expr.left as Expression, env);
        const right = this.evalExpression(expr.right, env);
        return this.evalBinary(expr.operator, left, right);
      }
      case "LogicalExpression": {
        const left = this.evalExpression(expr.left, env);
        if (expr.operator === "&&") {
          return this.isTruthy(left)
            ? this.evalExpression(expr.right, env)
            : left;
        }
        if (expr.operator === "||") {
          return this.isTruthy(left)
            ? left
            : this.evalExpression(expr.right, env);
        }
        throw new Error(`Unsupported logical operator: ${expr.operator}`);
      }
      case "AssignmentExpression": {
        if (expr.left.type !== "Identifier") {
          throw new Error("Only identifier assignment is supported");
        }
        const value = this.evalExpression(expr.right, env);
        if (expr.operator !== "=") {
          throw new Error(`Unsupported assignment operator: ${expr.operator}`);
        }
        envSet(env, expr.left.name, value);
        return value;
      }
      case "UpdateExpression": {
        if (expr.argument.type !== "Identifier") {
          throw new Error("Only identifier update is supported");
        }
        const current = envGet(env, expr.argument.name) ?? UNDEFINED;
        const n = toNumber(current);
        const next = expr.operator === "++" ? n + 1 : n - 1;
        const nextVal: Value = { kind: "number", value: next };
        envSet(env, expr.argument.name, nextVal);
        return expr.prefix ? nextVal : current;
      }
      case "TemplateLiteral": {
        if (expr.expressions.length > 0) {
          throw new Error(
            "Interpolated template literals are not supported yet",
          );
        }
        return {
          kind: "string",
          value: expr.quasis.map((q) => q.value.cooked ?? "").join(""),
        };
      }
      default:
        throw new Error(`Unsupported expression: ${(expr as Node).type}`);
    }
  }

  private evalIdentifier(expr: Identifier, env: Env): Value {
    const value = envGet(env, expr.name);
    if (!value) throw new Error(`ReferenceError: ${expr.name} is not defined`);
    return value;
  }

  private evalMember(
    expr: Extract<Expression, { type: "MemberExpression" }>,
    env: Env,
  ): Value {
    if (expr.computed) throw new Error("Computed members are not supported");
    if (expr.property.type !== "Identifier") {
      throw new Error("Unsupported member property");
    }
    const object = this.evalExpression(expr.object as Expression, env);
    const prop = expr.property.name;

    if (object.kind === "object" && object.name === "console") {
      if (prop === "log") return { kind: "native", name: "console.log" };
    }
    if (object.kind === "promiseCtor") {
      if (prop === "resolve" || prop === "reject") {
        return { kind: "promiseMethod", method: prop };
      }
    }
    if (object.kind === "promise") {
      if (prop === "then" || prop === "catch") {
        return { kind: "promiseMethod", method: prop, target: object };
      }
    }
    throw new Error(`Unsupported member access: ${prop}`);
  }

  private evalNew(
    expr: Extract<Expression, { type: "NewExpression" }>,
    env: Env,
  ): Value {
    const callee = this.evalExpression(expr.callee as Expression, env);
    if (callee.kind !== "promiseCtor") {
      throw new Error("Only `new Promise(...)` is supported");
    }
    const args = expr.arguments.map((arg) => {
      if (arg.type === "SpreadElement") {
        throw new Error("Spread arguments are not supported");
      }
      return this.evalExpression(arg, env);
    });
    const executor = args[0];
    if (!executor || executor.kind !== "fn") {
      throw new Error("Promise executor must be a function");
    }

    const promise = this.createPromise("pending");
    this.callPromiseExecutor(executor, promise);
    return promise;
  }

  private callPromiseExecutor(executor: FnValue, promise: PromiseValue): void {
    const child = createEnv(executor.env);
    const resolveNative = this.makeHostCallback((value) => {
      this.resolvePromise(promise, value ?? UNDEFINED);
      return UNDEFINED;
    }, "resolve");
    const rejectNative = this.makeHostCallback((reason) => {
      this.rejectPromise(promise, reason ?? UNDEFINED);
      return UNDEFINED;
    }, "reject");

    this.bindParams(executor.params, [resolveNative, rejectNative], child);
    this.pushStack("Promise executor", executor.line, "Promise executor");
    try {
      if (executor.expression && executor.body.type !== "BlockStatement") {
        this.evalExpression(executor.body as Expression, child);
      } else if (executor.body.type === "BlockStatement") {
        this.hoistFunctions(executor.body.body, child);
        for (const stmt of executor.body.body) {
          this.execStatement(stmt, child);
        }
      }
      this.popStack("Promise executor", "Promise executor");
    } catch (err) {
      if (this.timeline.at(-1)?.type !== "popStack") {
        this.popStack("Promise executor", "Promise executor");
      }
      if (err instanceof ReturnSignal) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.rejectPromise(promise, { kind: "string", value: message });
    }
  }

  private makeHostCallback(
    impl: (value?: Value) => Value,
    name: string,
  ): Value {
    // Store in a side table keyed by fn identity using a unique native-like wrapper
    const host: FnValue = {
      kind: "fn",
      name,
      params: [{ type: "Identifier", name: "value", start: 0, end: 0 } as Identifier],
      body: { type: "BlockStatement", body: [], start: 0, end: 0 },
      env: createEnv(null),
      expression: false,
    };
    this.hostFns.set(host, impl);
    return host;
  }

  private hostFns = new WeakMap<FnValue, (value?: Value) => Value>();

  private evalCall(
    expr: Extract<Expression, { type: "CallExpression" }>,
    env: Env,
  ): Value {
    const callee = this.evalExpression(expr.callee as Expression, env);
    const args = expr.arguments.map((arg) => {
      if (arg.type === "SpreadElement") {
        throw new Error("Spread arguments are not supported");
      }
      return this.evalExpression(arg, env);
    });

    if (callee.kind === "native") {
      if (callee.name === "console.log") {
        const line = expr.loc?.start.line;
        const rendered = args.map(valueToLogString);
        this.console.push(rendered.join(" "));
        this.emit({ type: "log", args: rendered, line });
        return UNDEFINED;
      }
      if (callee.name === "setTimeout") {
        return this.nativeSetTimeout(args, expr.loc?.start.line);
      }
      if (callee.name === "queueMicrotask") {
        return this.nativeQueueMicrotask(args);
      }
    }

    if (callee.kind === "promiseMethod") {
      if (callee.method === "resolve" && !callee.target) {
        const value = args[0] ?? UNDEFINED;
        if (value.kind === "promise") return value;
        const p = this.createPromise("fulfilled");
        p.result = value;
        return p;
      }
      if (callee.method === "reject" && !callee.target) {
        const p = this.createPromise("rejected");
        p.result = args[0] ?? UNDEFINED;
        return p;
      }
      if (callee.method === "then" && callee.target) {
        const onFulfilled =
          args[0] && args[0].kind === "fn" ? args[0] : undefined;
        const onRejected =
          args[1] && args[1].kind === "fn" ? args[1] : undefined;
        return this.promiseThenPublic(callee.target, onFulfilled, onRejected);
      }
      if (callee.method === "catch" && callee.target) {
        const onRejected =
          args[0] && args[0].kind === "fn" ? args[0] : undefined;
        return this.promiseThenPublic(callee.target, undefined, onRejected);
      }
      // Host resolve/reject on a specific promise used wrongly — ignore
    }

    if (callee.kind === "fn") {
      const host = this.hostFns.get(callee);
      if (host) {
        return host(args[0]);
      }
      return this.callFunction(callee, args, callee.name);
    }

    throw new Error("Value is not a function");
  }

  private nativeQueueMicrotask(args: Value[]): Value {
    const callback = args[0];
    if (!callback || callback.kind !== "fn") {
      throw new Error("queueMicrotask requires a function");
    }
    const hint = hintFromCallback(callback);
    const idPreview = String(this.nextMicroId);
    const label = hint
      ? `microtask #${idPreview} · ${hint}`
      : `microtask #${idPreview}`;
    this.enqueueMicrotask("queueMicrotask", label, () => {
      this.callFunction(callback, [], label);
    });
    return UNDEFINED;
  }

  private nativeSetTimeout(args: Value[], callLine?: number): Value {
    const callback = args[0];
    if (!callback || callback.kind !== "fn") {
      throw new Error("setTimeout requires a function callback");
    }
    const delayRaw = args[1] ? toNumber(args[1]) : 0;
    const delay = Math.max(0, delayRaw);
    const id = String(this.nextTimerId++);
    const name = callback.name || "anonymous";
    const line = callLine ?? callback.line;
    const hint = hintFromCallback(callback);
    const label = hint ? `timeout #${id} · ${hint}` : `timeout #${id}`;
    this.timers.push({
      id,
      due: this.now + delay,
      callback,
      name,
      label,
      ready: false,
    });
    this.emit({
      type: "scheduleTimer",
      id,
      delay,
      name,
      label,
      hint,
      line,
    });
    return { kind: "number", value: Number(id) };
  }

  private callFunction(fn: FnValue, args: Value[], frameLabel: string): Value {
    const host = this.hostFns.get(fn);
    if (host) return host(args[0]);

    const child = createEnv(fn.env);
    this.bindParams(fn.params, args, child);
    const frameName = fn.name && fn.name !== "anonymous" ? fn.name : frameLabel;
    this.pushStack(frameName, fn.line, frameLabel);

    try {
      if (fn.expression && fn.body.type !== "BlockStatement") {
        const value = this.evalExpression(fn.body as Expression, child);
        this.popStack(frameName, frameLabel);
        return value;
      }

      if (fn.body.type !== "BlockStatement") {
        throw new Error("Invalid function body");
      }

      this.hoistFunctions(fn.body.body, child);
      for (const stmt of fn.body.body) {
        this.execStatement(stmt, child);
      }
      this.popStack(frameName, frameLabel);
      return UNDEFINED;
    } catch (err) {
      if (err instanceof ReturnSignal) {
        this.popStack(frameName, frameLabel);
        return err.value;
      }
      if (this.timeline.at(-1)?.type !== "popStack") {
        this.popStack(frameName, frameLabel);
      }
      throw err;
    }
  }

  private bindParams(params: Pattern[], args: Value[], env: Env): void {
    params.forEach((param, index) => {
      if (param.type !== "Identifier") {
        throw new Error("Only simple function parameters are supported");
      }
      envDefine(env, param.name, args[index] ?? UNDEFINED);
    });
  }

  private evalBinary(operator: string, left: Value, right: Value): Value {
    if (
      operator === "+" &&
      (left.kind === "string" || right.kind === "string")
    ) {
      return {
        kind: "string",
        value: valueToLogString(left) + valueToLogString(right),
      };
    }
    const l = toNumber(left);
    const r = toNumber(right);
    switch (operator) {
      case "+":
        return { kind: "number", value: l + r };
      case "-":
        return { kind: "number", value: l - r };
      case "*":
        return { kind: "number", value: l * r };
      case "/":
        return { kind: "number", value: l / r };
      case "%":
        return { kind: "number", value: l % r };
      case "<":
        return { kind: "boolean", value: l < r };
      case "<=":
        return { kind: "boolean", value: l <= r };
      case ">":
        return { kind: "boolean", value: l > r };
      case ">=":
        return { kind: "boolean", value: l >= r };
      case "==":
        return {
          kind: "boolean",
          value: valueToLogString(left) === valueToLogString(right),
        };
      case "===":
        return {
          kind: "boolean",
          value:
            left.kind === right.kind &&
            valueToLogString(left) === valueToLogString(right),
        };
      case "!=":
        return {
          kind: "boolean",
          value: valueToLogString(left) !== valueToLogString(right),
        };
      case "!==":
        return {
          kind: "boolean",
          value: !(
            left.kind === right.kind &&
            valueToLogString(left) === valueToLogString(right)
          ),
        };
      default:
        throw new Error(`Unsupported binary operator: ${operator}`);
    }
  }

  private isTruthy(value: Value): boolean {
    switch (value.kind) {
      case "undefined":
      case "null":
        return false;
      case "boolean":
        return value.value;
      case "number":
        return value.value !== 0 && !Number.isNaN(value.value);
      case "string":
        return value.value.length > 0;
      default:
        return true;
    }
  }
}
