import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";

test("compiles typed while loops with mutable outer state", () => {
  const source = String.raw`
app "Control Flow"

function countTo
  takes limit number
  returns number

  var current = 0

  while current < limit
    set current = current + 1
  end

  return current
end

screen Home
  title "Control Flow"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /while \(/);
  assert.match(generated.content, /local_0 = \(local_0 \+ 1\);/);
});

test("requires boolean while conditions", () => {
  const invalid = String.raw`
app "Control Flow"

function invalidLoop
  returns number

  var value = 0
  while 1
    set value = value + 1
  end
  return value
end

screen Home
  title "Control Flow"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2240"),
      );
      return true;
    },
  );
});

test("keeps locals declared inside while scoped to the loop", () => {
  const invalid = String.raw`
app "Control Flow"

function scoped
  returns number

  var current = 0
  while current < 1
    let hidden = 42
    set current = current + 1
  end
  return hidden
end

screen Home
  title "Control Flow"
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

test("natural and explicit while syntax lower identically", () => {
  const source = String.raw`
app "Control Flow"

function countTo
  takes limit number
  returns number

  var current = 0
  while current < limit
    set current = current + 1
  end
  return current
end

screen Home
  title "Control Flow"
`;

  const natural = formatSource(source, "natural");
  const explicit = formatSource(source, "explicit");

  assert.deepEqual(compile(natural).files, compile(explicit).files);
  assert.match(explicit, /while .* \{/);
});
