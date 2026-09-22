import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Classes"

protocol Named
  name text

  function display
    returns text
  end
end

class Account
  conforms Named
  public name text
  private token text

  function display
    returns text
    return name
  end

  function reveal
    returns text
    return token
  end
end

function create
  returns Account
  return Account("Ada", "secret-token")
end

function displayAccount
  takes account Account
  returns text
  return account.display()
end

function displayNamed
  takes value Named
  returns text
  return value.display()
end

function publicName
  takes account Account
  returns text
  return account.name
end

function revealThroughBehavior
  takes account Account
  returns text
  return account.reveal()
end

screen Home
  title "Classes"
`;

test("parses class visibility, methods and protocol conformance", () => {
  const program = parse(source);

  assert.equal(program.classes.length, 1);
  assert.equal(program.classes[0]?.name, "Account");
  assert.deepEqual(
    program.classes[0]?.fields.map((field) => [
      field.name,
      field.visibility,
    ]),
    [
      ["name", "public"],
      ["token", "private"],
    ],
  );
  assert.equal(program.classes[0]?.methods.length, 2);
  assert.deepEqual(
    program.classes[0]?.conformances.map((item) => item.name),
    ["Named"],
  );
});

test("formatter emits canonical public/private class fields", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /class Account/);
  assert.match(formatted, /public name text/);
  assert.match(formatted, /private token text/);
  assert.match(formatted, /function reveal[\s\S]*return token/);
});

test("classes are constructible and assignable to conformed protocols", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generated class types hide private fields while methods capture them", () => {
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
    /"Account": EvermoreProtocols\["Named"\] & \{/,
  );
  assert.match(models.content, /readonly "name": string;/);
  assert.doesNotMatch(models.content, /readonly "token": string;/);
  assert.match(models.content, /readonly "reveal": \(\) => string;/);

  assert.match(functions.content, /const field_1 = "secret-token";/);
  assert.doesNotMatch(functions.content, /"token": field_1/);
  assert.match(
    functions.content,
    /"reveal": \(\): string => \{ return field_1; \}/,
  );
});

test("rejects external access to private class fields", () => {
  const invalid = String.raw`
app "Broken"

class Account
  private token text
end

function leak
  takes account Account
  returns text
  return account.token
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2330"),
      );
      return true;
    },
  );
});

test("private fields cannot satisfy public protocol requirements", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

class Account
  conforms Named
  private name text
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2506"),
      );
      return true;
    },
  );
});

test("class constructor arguments are typechecked", () => {
  const invalid = String.raw`
app "Broken"

class Account
  public name text
  private token text
end

function wrong
  returns Account
  return Account("Ada", 42)
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

test("rejects duplicate class members", () => {
  const invalid = String.raw`
app "Broken"

class Account
  public name text

  function name
    returns text
    return name
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2411"),
      );
      return true;
    },
  );
});

test("class methods typecheck private field reads", () => {
  const invalid = String.raw`
app "Broken"

class Account
  private token text

  function score
    returns number
    return token
  end
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
