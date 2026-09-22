import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";

const source = String.raw`
app "Constructors"

protocol Named
  name text
end

data Person
  conforms Named
  name text
  age number
end

function makePerson
  takes name text
  takes age number
  returns Person
  return Person(name, age)
end

function makeNamed
  returns Named
  return Person("Ada", 37)
end

function readName
  returns text
  let person = Person("Grace", 85)
  return person.name
end

screen Home
  title "Construct real domain values"
`;

test("constructs nominal data values and preserves their type", () => {
  assert.doesNotThrow(() => compile(source));
});

test("data constructors lower to real TypeScript object values", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /return \(\{ "name": arg_0, "age": arg_1 \}\);/,
  );
  assert.match(
    generated.content,
    /return \(\{ "name": "Ada", "age": 37 \}\);/,
  );
  assert.match(
    generated.content,
    /const local_0 = \(\{ "name": "Grace", "age": 85 \}\);/,
  );
  assert.match(generated.content, /return \(local_0\)\["name"\];/);
});

test("data values are assignable to protocols they conform to", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /function fn_1\(\): EvermoreProtocols\["Named"\]/,
  );
});

test("rejects data constructor calls with the wrong arity", () => {
  const invalid = String.raw`
app "Broken"

data Person
  name text
  age number
end

function broken
  returns Person
  return Person("Ada")
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2230"),
      );
      return true;
    },
  );
});

test("rejects data constructor fields with incompatible types", () => {
  const invalid = String.raw`
app "Broken"

data Person
  name text
  age number
end

function broken
  returns Person
  return Person(42, "old")
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2231"),
      );
      return true;
    },
  );
});

test("function calls take precedence when a function shares a data name", () => {
  const collision = String.raw`
app "Namespaces"

data Person
  name text
end

function Person
  takes name text
  returns text
  return name
end

function usePerson
  returns text
  return Person("Ada")
end

screen Home
  title "Namespaces"
`;

  const result = compile(collision);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /return fn_0\("Ada"\);/);
  assert.doesNotMatch(generated.content, /"name": "Ada"/);
});
