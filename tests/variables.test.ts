import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Mutable Locals"

function increment
  takes start number
  returns number

  var total = start
  set total = total + 1
  return total
end

screen Home
  title "Mutation is explicit"
`;

test("parses explicit mutable local declarations and assignments", () => {
  const program = parse(source);
  const fn = program.functions[0];

  assert.equal(fn?.body[0]?.kind, "VarStatement");
  assert.equal(fn?.body[1]?.kind, "SetStatement");
});

test("formatter preserves var and set statements", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /var total = start/);
  assert.match(formatted, /set total = total \+ 1/);
});

test("generates JavaScript mutation only for var locals", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /let local_0 = arg_0;/);
  assert.match(generated.content, /local_0 = \(local_0 \+ 1\);/);
  assert.match(generated.content, /return local_0;/);
});

test("let locals remain immutable", () => {
  const invalid = String.raw`
app "Broken"

function wrong
  returns number
  let total = 1
  set total = 2
  return total
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2233"),
      );
      return true;
    },
  );
});

test("function parameters remain immutable", () => {
  const invalid = String.raw`
app "Broken"

function wrong
  takes value number
  returns number
  set value = 2
  return value
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2233"),
      );
      return true;
    },
  );
});

test("rejects assignments to unknown locals", () => {
  const invalid = String.raw`
app "Broken"

function wrong
  returns number
  set missing = 2
  return 0
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2232"),
      );
      return true;
    },
  );
});

test("mutable locals keep their inferred storage type", () => {
  const invalid = String.raw`
app "Broken"

function wrong
  returns number
  var total = 1
  set total = "two"
  return total
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2234"),
      );
      return true;
    },
  );
});
