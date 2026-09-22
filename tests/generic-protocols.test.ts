import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Generic Protocols"

protocol Identified
  id id
end

data User
  conforms Identified
  id id
  name text
end

function identifier
  generic T conforms Identified
  takes value T
  returns id
  return value.id
end

function preserve
  generic T conforms Identified
  takes value T
  returns T
  return value
end

function forward
  generic T conforms Identified
  takes value T
  returns T
  return preserve(value)
end

function userIdentifier
  takes user User
  returns id
  return identifier(user)
end

screen Home
  title "Generic Protocols"
`;

test("parses and formats protocol-constrained generic parameters", () => {
  const program = parse(source);

  assert.equal(
    program.functions[0]?.typeParameters[0]?.constraint?.name,
    "Identified",
  );

  const formatted = formatSource(source);
  assert.match(formatted, /generic T conforms Identified/);
});

test("constrained generics expose protocol members and forward constraints", () => {
  assert.doesNotThrow(() => compile(source));
});

test("emits TypeScript extends clauses and constrained member reads", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /function fn_0<T0 extends EvermoreProtocols\["Identified"\]>\(arg_0: T0\): string/,
  );
  assert.match(generated.content, /return \(arg_0\)\["id"\];/);
  assert.match(
    generated.content,
    /function fn_1<T0 extends EvermoreProtocols\["Identified"\]>\(arg_0: T0\): T0/,
  );
  assert.match(
    generated.content,
    /function fn_2<T0 extends EvermoreProtocols\["Identified"\]>\(arg_0: T0\): T0/,
  );
});

test("rejects unknown protocols used as generic constraints", () => {
  const invalid = String.raw`
app "Broken"

function preserve
  generic T conforms MissingProtocol
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

test("rejects inferred generic types that do not satisfy constraints", () => {
  const invalid = String.raw`
app "Broken"

protocol Identified
  id id
end

data Anonymous
  name text
end

function preserve
  generic T conforms Identified
  takes value T
  returns T
  return value
end

function keepAnonymous
  takes value Anonymous
  returns Anonymous
  return preserve(value)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2224"),
      );
      return true;
    },
  );
});
