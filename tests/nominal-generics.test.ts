import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Nominal Generics"

data Box
  generic T
  value T

  function get
    returns T
    return value
  end
end

class Holder
  generic T
  public value T

  function get
    returns T
    return value
  end
end

function makeTextBox
  returns Box<text>
  return Box("hello")
end

function readTextBox
  takes box Box<text>
  returns text
  return box.get()
end

function makeNumberHolder
  returns Holder<number>
  return Holder(42)
end

function readNumberHolder
  takes holder Holder<number>
  returns number
  return holder.value
end

screen Home
  title "Nominal Generics"
`;

test("parses generic nominal declarations and applied types", () => {
  const program = parse(source);

  assert.equal(program.data[0]?.typeParameters[0]?.name, "T");
  assert.equal(program.classes[0]?.typeParameters[0]?.name, "T");

  const returnType = program.functions[0]?.returnType;
  assert.equal(returnType?.kind, "AppliedTypeAnnotation");

  if (returnType?.kind === "AppliedTypeAnnotation") {
    assert.equal(returnType.name, "Box");
    assert.equal(returnType.arguments.length, 1);
  }
});

test("formats generic nominal declarations canonically", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /data Box\n\n  generic T/);
  assert.match(formatted, /class Holder\n\n  generic T/);
  assert.match(formatted, /returns Box<text>/);
  assert.match(formatted, /takes holder Holder<number>/);
});

test("typechecks generic constructors, members and methods", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates generic TypeScript nominal contracts", () => {
  const result = compile(source);
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(models);
  assert.ok(functions);

  assert.match(
    models.content,
    /export type EvermoreGeneric_Box<T0> = \{/,
  );
  assert.match(models.content, /readonly "value": T0;/);
  assert.match(models.content, /readonly "get": \(\) => T0;/);
  assert.match(
    models.content,
    /export type EvermoreGeneric_Holder<T0> = \{/,
  );
  assert.match(
    functions.content,
    /function fn_0\(\): EvermoreGeneric_Box<string>/,
  );
  assert.match(
    functions.content,
    /function fn_1\(arg_0: EvermoreGeneric_Box<string>\): string/,
  );
  assert.match(
    functions.content,
    /function fn_2\(\): EvermoreGeneric_Holder<number>/,
  );
});

test("uses expected generic nominal context to reject wrong constructor fields", () => {
  const invalid = String.raw`
app "Broken"

data Box
  generic T
  value T
end

function broken
  returns Box<number>
  return Box("wrong")
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

test("rejects missing nominal type arguments", () => {
  const invalid = String.raw`
app "Broken"

data Box
  generic T
  value T
end

function broken
  takes box Box
  returns text
  return box.value
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

test("enforces protocol constraints on nominal generic constructors", () => {
  const valid = String.raw`
app "Constraints"

protocol Named
  name text
end

data User
  conforms Named
  name text
end

data Envelope
  generic T conforms Named
  item T
end

function build
  returns Envelope<User>
  return Envelope(User("Ada"))
end

screen Home
  title "Constraints"
`;

  assert.doesNotThrow(() => compile(valid));

  const invalid = String.raw`
app "Broken Constraints"

protocol Named
  name text
end

data Envelope
  generic T conforms Named
  item T
end

function build
  returns Envelope<number>
  return Envelope(42)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "E2231" ||
            diagnostic.code === "E2206" ||
            diagnostic.code === "E2236",
        ),
      );
      return true;
    },
  );
});


test("rejects constrained nominal applications even without construction", () => {
  const invalid = String.raw`
app "Broken Applied Constraint"

protocol Named
  name text
end

data Envelope
  generic T conforms Named
  item T
end

function consume
  takes value Envelope<number>
  returns number
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2236"),
      );
      return true;
    },
  );
});
