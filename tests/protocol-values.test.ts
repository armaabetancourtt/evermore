import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Protocol Values"

protocol Named
  name text
end

data User
  conforms Named
  id id
  name text
  age number
end

choice Status
  active
  archived
end

function displayName
  takes value Named
  returns text
  return value.name
end

function userName
  takes user User
  returns text
  return displayName(user)
end

function directUserName
  takes user User
  returns text
  return user.name
end

function asNamed
  takes user User
  returns Named
  return user
end

function defaultStatus
  returns Status
  return Status.active
end

screen Home
  title "Protocol Values"
`;

test("parses dotted syntax as semantic member access", () => {
  const program = parse(source);
  const protocolReturn = program.functions[0]?.body[0];
  const choiceReturn = program.functions[4]?.body[0];

  assert.equal(protocolReturn?.kind, "ReturnStatement");
  assert.equal(choiceReturn?.kind, "ReturnStatement");

  if (protocolReturn?.kind === "ReturnStatement") {
    assert.equal(protocolReturn.expression.kind, "MemberExpression");
  }

  if (choiceReturn?.kind === "ReturnStatement") {
    assert.equal(choiceReturn.expression.kind, "MemberExpression");
  }
});

test("allows conforming data where a protocol value is expected", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates protocol parameter types and checked member reads", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(
    generated.content,
    /arg_0: EvermoreProtocols\["Named"\]/,
  );
  assert.match(
    generated.content,
    /arg_0: EvermoreModels\["User"\]/,
  );
  assert.match(generated.content, /\(arg_0\)\["name"\]/);
  assert.match(
    generated.content,
    /\): EvermoreProtocols\["Named"\]/,
  );
  assert.match(generated.content, /return "active";/);
});

test("rejects nonconforming data passed to a protocol parameter", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data Machine
  id id
end

function displayName
  takes value Named
  returns text
  return value.name
end

function wrong
  takes machine Machine
  returns text
  return displayName(machine)
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

test("rejects nonconforming data returned as a protocol", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data Machine
  id id
end

function wrong
  takes machine Machine
  returns Named
  return machine
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2206"),
      );
      return true;
    },
  );
});

test("rejects unknown members on data and protocol values", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

function wrong
  takes value Named
  returns text
  return value.missing
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2321"),
      );
      return true;
    },
  );
});

test("rejects member access on primitive values", () => {
  const invalid = String.raw`
app "Broken"

function wrong
  takes value number
  returns text
  return value.name
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2320"),
      );
      return true;
    },
  );
});

test("requires optional values to be resolved before member access", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text
end

function wrong
  takes user optional User
  returns text
  return user.name
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2322"),
      );
      return true;
    },
  );
});
