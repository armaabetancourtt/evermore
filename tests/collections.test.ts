import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Collections"

function tags
  returns set of text
  return set["compiler", "language"]
end

function scores
  returns map of text to number
  return map["Ada": 100, "Grace": 99]
end

function emptyTags
  returns set of text
  return set[]
end

function emptyScores
  returns map of text to number
  return map[]
end

function echoSet
  generic T
  takes values set of T
  returns set of T
  return values
end

function echoMap
  generic K
  generic V
  takes values map of K to V
  returns map of K to V
  return values
end

function inferredSet
  returns set of number
  return echoSet(set[1, 2, 3])
end

function inferredMap
  returns map of text to boolean
  return echoMap(map["ready": true])
end

screen Home
  title "Collections"
`;

test("parses set and map collection types and literals", () => {
  const program = parse(source);

  assert.equal(program.functions[0]?.returnType.kind, "SetTypeAnnotation");
  assert.equal(program.functions[0]?.body[0]?.kind, "ReturnStatement");
  assert.equal(
    program.functions[0]?.body[0]?.kind === "ReturnStatement"
      ? program.functions[0].body[0].expression.kind
      : undefined,
    "SetExpression",
  );

  assert.equal(program.functions[1]?.returnType.kind, "MapTypeAnnotation");
  assert.equal(
    program.functions[1]?.body[0]?.kind === "ReturnStatement"
      ? program.functions[1].body[0].expression.kind
      : undefined,
    "MapExpression",
  );
});

test("formatter preserves canonical collection syntax", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /returns set of text/);
  assert.match(formatted, /return set\["compiler", "language"\]/);
  assert.match(formatted, /returns map of text to number/);
  assert.match(formatted, /return map\["Ada": 100, "Grace": 99\]/);
});

test("generates strict TypeScript Set and Map values", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /ReadonlySet<string>/);
  assert.match(
    generated.content,
    /new Set\(\["compiler", "language"\]\)/,
  );
  assert.match(generated.content, /ReadonlyMap<string, number>/);
  assert.match(
    generated.content,
    /new Map\(\[\["Ada", 100\], \["Grace", 99\]\]\)/,
  );
});

test("infers empty sets and maps from declared context", () => {
  assert.doesNotThrow(() => compile(source));
});

test("propagates generics through set and map collections", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /function fn_4<T0>\(arg_0: ReadonlySet<T0>\): ReadonlySet<T0>/,
  );
  assert.match(
    generated.content,
    /function fn_5<T0, T1>\(arg_0: ReadonlyMap<T0, T1>\): ReadonlyMap<T0, T1>/,
  );
});

test("rejects heterogeneous set elements", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns set of number
  return set[1, "two"]
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2236"),
      );
      return true;
    },
  );
});

test("rejects heterogeneous map keys", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns map of text to number
  return map["one": 1, 2: 2]
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2238"),
      );
      return true;
    },
  );
});

test("rejects heterogeneous map values", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns map of text to number
  return map["one": 1, "two": "two"]
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2239"),
      );
      return true;
    },
  );
});

test("rejects ambiguous empty sets", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns number
  let values = set[]
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2235"),
      );
      return true;
    },
  );
});

test("rejects ambiguous empty maps", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns number
  let values = map[]
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2237"),
      );
      return true;
    },
  );
});
