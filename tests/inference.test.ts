import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";

test("infers an empty list from a declared return type", () => {
  const source = String.raw`
app "Inference"

function emptyNames
  returns list of text
  return []
end

screen Home
  title "Inference"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /ReadonlyArray<string>/);
  assert.match(generated.content, /return \[\];/);
});

test("infers empty list arguments from parameter types", () => {
  const source = String.raw`
app "Inference"

function countNames
  takes names list of text
  returns number
  return 0
end

function emptyCount
  returns number
  return countNames([])
end

screen Home
  title "Inference"
`;

  assert.doesNotThrow(() => compile(source));
});

test("propagates context through nested list literals", () => {
  const source = String.raw`
app "Inference"

function matrix
  returns list of list of number
  return [[]]
end

screen Home
  title "Inference"
`;

  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /ReadonlyArray<ReadonlyArray<number>>/);
  assert.match(generated.content, /return \[\[\]\];/);
});

test("keeps ambiguous empty local lists invalid", () => {
  const invalid = String.raw`
app "Inference"

function ambiguous
  returns number
  let values = []
  return 0
end

screen Home
  title "Inference"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2212"),
      );
      return true;
    },
  );
});

test("rejects empty lists when the expected type is not a list", () => {
  const invalid = String.raw`
app "Inference"

function wrong
  returns number
  return []
end

screen Home
  title "Inference"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2212"),
      );
      return true;
    },
  );
});


test("propagates expected result context into generic call arguments", () => {
  const source = String.raw`
app "Inference"

function identity
  generic T
  takes value T
  returns T
  return value
end

function wrap
  generic T
  takes value T
  returns list of T
  return [value]
end

function emptyNames
  returns list of text
  return identity([])
end

function nested
  returns list of list of number
  return wrap([])
end

function emptyIndex
  returns map of text to list of number
  return identity(map[])
end

function emptyTags
  returns set of text
  return identity(set[])
end

screen Home
  title "Inference"
`;

  assert.doesNotThrow(() => compile(source));
});

test("unifies compatible repeated generic evidence", () => {
  const source = String.raw`
app "Inference"

function choose
  generic T
  takes left T
  takes right T
  returns T
  return left
end

function maybeName
  returns optional text
  return choose(none, "Ada")
end

function maybeNames
  returns list of optional text
  return [choose(none, "Ada"), choose("Grace", none)]
end

screen Home
  title "Inference"
`;

  assert.doesNotThrow(() => compile(source));
});

test("keeps incompatible repeated generic evidence invalid", () => {
  const invalid = String.raw`
app "Inference"

function choose
  generic T
  takes left T
  takes right T
  returns T
  return left
end

function broken
  returns number
  return choose(1, "Ada")
end

screen Home
  title "Inference"
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
