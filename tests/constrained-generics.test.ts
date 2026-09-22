import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Constrained Generics"

protocol Named
  name text
end

data User
  conforms Named
  name text
  age number
end

data Product
  conforms Named
  name text
  price number
end

function label
  generic T conforms Named
  takes value T
  returns text
  return value.name
end

function userLabel
  takes user User
  returns text
  return label(user)
end

function productLabel
  takes product Product
  returns text
  return label(product)
end

screen Home
  title "Constraints"
`;

test("parses generic protocol constraints", () => {
  const program = parse(source);
  const generic = program.functions[0]?.typeParameters[0];

  assert.equal(generic?.name, "T");
  assert.equal(generic?.constraintName, "Named");
});

test("formatter preserves constrained generic syntax", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /generic T conforms Named/);
  assert.match(formatted, /return value\.name/);
});

test("allows member access through a constrained generic", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates TypeScript generic extends protocol contracts", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /function fn_0<T0 extends EvermoreProtocols\["Named"\]>\(arg_0: T0\): string/,
  );
  assert.match(generated.content, /\(arg_0\)\["name"\]/);
  assert.match(generated.content, /return fn_0\(arg_0\);/);
});

test("rejects values that do not satisfy generic protocol constraints", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data Machine
  id id
end

function label
  generic T conforms Named
  takes value T
  returns text
  return value.name
end

function wrong
  takes machine Machine
  returns text
  return label(machine)
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

test("rejects unknown protocols used as generic constraints", () => {
  const invalid = String.raw`
app "Broken"

function identity
  generic T conforms Missing
  takes value T
  returns T
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2223"),
      );
      return true;
    },
  );
});
