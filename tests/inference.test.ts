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
