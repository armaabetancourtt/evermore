import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Protocols"

protocol Identified
  id id
end

protocol Named
  name text
end

data User
  conforms Identified
  conforms Named
  id id
  name text
  age number
end

data Team
  conforms Named
  name text
  members list of User
end

screen Home
  title "Protocols"
`;

test("parses protocols and multiple data conformances", () => {
  const program = parse(source);

  assert.equal(program.protocols.length, 2);
  assert.equal(program.protocols[0]?.name, "Identified");
  assert.deepEqual(
    program.data[0]?.conformances.map((item) => item.name),
    ["Identified", "Named"],
  );
});

test("formatter emits canonical protocol contracts and conformances", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /protocol Identified\n\n  id id\nend/);
  assert.match(formatted, /data User\n\n  conforms Identified\n  conforms Named/);
});

test("generates protocol contracts and model intersections", () => {
  const result = compile(source);
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );

  assert.ok(models);
  assert.match(models.content, /export type EvermoreProtocols/);
  assert.match(models.content, /"Identified": \{/);
  assert.match(models.content, /"Named": \{/);
  assert.match(
    models.content,
    /"User": EvermoreProtocols\["Identified"\] & EvermoreProtocols\["Named"\] & \{/,
  );
  assert.match(
    models.content,
    /"Team": EvermoreProtocols\["Named"\] & \{/,
  );
});

test("rejects missing required protocol fields", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data User
  conforms Named
  age number
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2406"),
      );
      return true;
    },
  );
});

test("rejects protocol field type mismatches", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data User
  conforms Named
  name number
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2407"),
      );
      return true;
    },
  );
});

test("rejects unknown protocols in conformances", () => {
  const invalid = String.raw`
app "Broken"

data User
  conforms Missing
  name text
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2405"),
      );
      return true;
    },
  );
});

test("rejects duplicate protocol conformances", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
end

data User
  conforms Named
  conforms Named
  name text
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2404"),
      );
      return true;
    },
  );
});

test("rejects duplicate required fields in a protocol", () => {
  const invalid = String.raw`
app "Broken"

protocol Named
  name text
  name text
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2401"),
      );
      return true;
    },
  );
});

test("rejects unknown types inside protocol field requirements", () => {
  const invalid = String.raw`
app "Broken"

protocol Owned
  owner Missing
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2408"),
      );
      return true;
    },
  );
});
