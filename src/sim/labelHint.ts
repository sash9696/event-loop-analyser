import type {
  ArrowFunctionExpression,
  Expression,
  FunctionExpression,
  Statement,
} from "acorn";
import type { FnValue } from "./values";

function firstLogFromStatements(body: Statement[]): string | undefined {
  for (const stmt of body) {
    if (stmt.type !== "ExpressionStatement") continue;
    const expr = stmt.expression;
    if (expr.type !== "CallExpression") continue;
    const callee = expr.callee;
    if (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.object.name === "console" &&
      callee.property.type === "Identifier" &&
      callee.property.name === "log" &&
      expr.arguments[0]?.type === "Literal" &&
      typeof expr.arguments[0].value === "string"
    ) {
      return expr.arguments[0].value;
    }
  }
  return undefined;
}

function firstLogFromExpression(expr: Expression): string | undefined {
  if (expr.type !== "CallExpression") return undefined;
  const callee = expr.callee;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "console" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "log" &&
    expr.arguments[0]?.type === "Literal" &&
    typeof expr.arguments[0].value === "string"
  ) {
    return expr.arguments[0].value;
  }
  return undefined;
}

/** Best-effort teaching label from the callback's first console.log string. */
export function hintFromCallback(fn: FnValue): string | undefined {
  const body = fn.body as
    | ArrowFunctionExpression["body"]
    | FunctionExpression["body"];
  if (body.type === "BlockStatement") {
    return firstLogFromStatements(body.body);
  }
  return firstLogFromExpression(body as Expression);
}
