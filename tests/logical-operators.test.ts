import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";

test("compiles and/or/not with boolean precedence", () => {
  const source = String.raw`
app "Logic"

function decide
  takes a boolean
  takes b boolean
  takes c boolean
  returns boolean
  return not a or b and c
end

screen Home
  title "Logic"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /return \(\(!arg_0\) \|\| \(arg_1 && arg_2\)\);/,
  );
});

test("logical operators work in while conditions", () => {
  const source = String.raw`
app "Logic"

function advance
  takes limit number
  takes enabled boolean
  returns number

  var current = 0
  while enabled and current < limit
    set current = current + 1
  end
  return current
end

screen Home
  title "Logic"
`;

  assert.doesNotThrow(() => compile(source));
});

test("rejects non-boolean logical operands", () => {
  const invalidNot = String.raw`
app "Logic"

function invalidNot
  returns boolean
  return not 1
end

screen Home
  title "Logic"
`;

  const invalidAnd = String.raw`
app "Logic"

function invalidAnd
  returns boolean
  return true and 1
end

screen Home
  title "Logic"
`;

  for (const [source, code] of [
    [invalidNot, "E2244"],
    [invalidAnd, "E2245"],
  ] as const) {
    assert.throws(
      () => compile(source),
      (error: unknown) => {
        assert.ok(error instanceof EvermoreDiagnosticError);
        assert.ok(
          error.diagnostics.some((diagnostic) => diagnostic.code === code),
        );
        return true;
      },
    );
  }
});

test("formatter preserves logical precedence in both syntax styles", () => {
  const source = String.raw`
app "Logic"

function decide
  takes a boolean
  takes b boolean
  takes c boolean
  returns boolean
  return (not a or b) and c
end

screen Home
  title "Logic"
`;

  const natural = formatSource(source, "natural");
  const explicit = formatSource(source, "explicit");

  assert.match(natural, /return \(not a or b\) and c/);
  assert.deepEqual(compile(natural).files, compile(explicit).files);
});
