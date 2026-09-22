import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const functions = String.raw`
app "Core"

data User
  id id
end

function add
  takes a number
  takes b number
  returns number
  return a + b
end

function score
  takes base number
  returns number
  let doubled = base * 2
  return add(doubled, 10 / 2)
end

function identity
  takes user User
  returns User
  return user
end

screen Home
  title "Core"
`;

test("parses typed functions, locals, calls and arithmetic", () => {
  const program = parse(functions);

  assert.equal(program.functions.length, 3);
  assert.equal(program.functions[0]?.name, "add");
  assert.equal(program.functions[1]?.body[0]?.kind, "LetStatement");
});

test("formatter preserves arithmetic precedence", () => {
  const formatted = formatSource(
    'app "Math" function value { returns number return 2 + 3 * 4 } screen Home { title "Math" }',
  );

  assert.match(formatted, /return 2 \+ 3 \* 4/);
});

test("generates strictly typed target functions", () => {
  const result = compile(functions);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /function fn_0\(arg_0: number, arg_1: number\): number/);
  assert.match(generated.content, /return \(arg_0 \+ arg_1\);/);
  assert.match(generated.content, /const local_0 = \(arg_0 \* 2\);/);
  assert.match(generated.content, /fn_0\(local_0, \(10 \/ 2\)\)/);
  assert.match(generated.content, /import type \{ EvermoreModels \}/);
  assert.match(generated.content, /EvermoreModels\["User"\]/);
});

test("rejects return type mismatches", () => {
  const invalid = String.raw`
app "Broken"
function wrong
  returns number
  return "text"
end
screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2206"),
      );
      return true;
    },
  );
});

test("rejects arithmetic with non-number operands", () => {
  const invalid = String.raw`
app "Broken"
function wrong
  returns text
  return "a" + "b"
end
screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2205"),
      );
      return true;
    },
  );
});

test("rejects unknown values", () => {
  const invalid = String.raw`
app "Broken"
function wrong
  returns number
  return missing
end
screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2204"),
      );
      return true;
    },
  );
});

test("rejects wrong function call arity", () => {
  const invalid = String.raw`
app "Broken"

function add
  takes a number
  takes b number
  returns number
  return a + b
end

function wrong
  returns number
  return add(1)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2208"),
      );
      return true;
    },
  );
});

test("rejects wrong function argument types", () => {
  const invalid = String.raw`
app "Broken"

function double
  takes value number
  returns number
  return value * 2
end

function wrong
  returns number
  return double("no")
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2209"),
      );
      return true;
    },
  );
});

test("requires every typed function to return a value", () => {
  const invalid = String.raw`
app "Broken"

function empty
  returns number
  let value = 1
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2210"),
      );
      return true;
    },
  );
});
