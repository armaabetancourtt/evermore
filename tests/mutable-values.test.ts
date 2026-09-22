import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Mutable Values"

function incrementTwice
  takes start number
  returns number

  var value = start
  set value = value + 1
  set value = value + 1
  return value
end

screen Home
  title "Mutable values"
`;

test("parses mutable locals and typed assignments", () => {
  const program = parse(source);
  const body = program.functions[0]?.body;

  assert.equal(body?.[0]?.kind, "VarStatement");
  assert.equal(body?.[1]?.kind, "SetStatement");
  assert.equal(body?.[2]?.kind, "SetStatement");
});

test("formatter preserves canonical var and set syntax", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /var value = start/);
  assert.match(formatted, /set value = value \+ 1/);
});

test("generates let-backed mutable TypeScript locals", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /let local_0 = arg_0;/);
  assert.match(generated.content, /local_0 = \(local_0 \+ 1\);/);
  assert.match(generated.content, /return local_0;/);
});

test("rejects assignment to immutable let locals", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns number
  let value = 1
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

test("rejects assignment to unknown locals", () => {
  const invalid = String.raw`
app "Broken"

function broken
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

test("rejects assignments that change the inferred storage type", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns number
  var value = 1
  set value = "text"
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2234"),
      );
      return true;
    },
  );
});

test("parameters remain immutable storage", () => {
  const invalid = String.raw`
app "Broken"

function broken
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
