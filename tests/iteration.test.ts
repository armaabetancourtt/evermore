import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";

test("compiles typed for-in loops over lists", () => {
  const source = String.raw`
app "Iteration"

function sum
  takes values list of number
  returns number

  var total = 0
  for value in values
    set total = total + value
  end
  return total
end

screen Home
  title "Iteration"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /for \(const loop_item of arg_0\)/);
  assert.match(
    generated.content,
    /local_0 = \(local_0 \+ loop_item\);/,
  );
});

test("allows break and continue inside loops", () => {
  const source = String.raw`
app "Loop Control"

function first
  takes values list of number
  returns number

  var total = 0
  for value in values
    set total = value
    break
  end

  while total < 0
    continue
  end

  return total
end

screen Home
  title "Loop Control"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /break;/);
  assert.match(generated.content, /continue;/);
});

test("rejects break and continue outside loops", () => {
  const invalidBreak = String.raw`
app "Loop Control"

function badBreak
  returns number
  break
  return 0
end

screen Home
  title "Loop Control"
`;

  const invalidContinue = String.raw`
app "Loop Control"

function badContinue
  returns number
  continue
  return 0
end

screen Home
  title "Loop Control"
`;

  for (const [source, code] of [
    [invalidBreak, "E2242"],
    [invalidContinue, "E2243"],
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

test("rejects for-in over non-iterable values", () => {
  const invalid = String.raw`
app "Iteration"

function invalid
  returns number
  for digit in 42
    break
  end
  return 0
end

screen Home
  title "Iteration"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2241"),
      );
      return true;
    },
  );
});

test("natural and explicit iteration syntax lower identically", () => {
  const source = String.raw`
app "Iteration"

function sum
  takes values set of number
  returns number

  var total = 0
  for value in values
    set total = total + value
  end
  return total
end

screen Home
  title "Iteration"
`;

  const natural = formatSource(source, "natural");
  const explicit = formatSource(source, "explicit");

  assert.deepEqual(compile(natural).files, compile(explicit).files);
  assert.match(explicit, /for value in values \{/);
});
