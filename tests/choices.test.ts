import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Choices"

choice Status
  draft
  active
  archived
end

function defaultStatus
  returns Status
  return Status.draft
end

function isActive
  takes status Status
  returns boolean
  return status == Status.active
end

screen Home
  title "Choices"
`;

test("parses nominal choice declarations and case expressions", () => {
  const program = parse(source);

  assert.equal(program.choices.length, 1);
  assert.equal(program.choices[0]?.name, "Status");
  assert.deepEqual(
    program.choices[0]?.cases.map((item) => item.name),
    ["draft", "active", "archived"],
  );
});

test("formatter emits canonical natural choice syntax", () => {
  const formatted = formatSource(
    'app "Choices" choice Status { draft active } function status { returns Status return Status.draft } screen Home { title "Choices" }',
  );

  assert.match(formatted, /choice Status\n\n  draft\n  active\nend/);
  assert.match(formatted, /return Status\.draft/);
});

test("choice types and values generate into strict TypeScript", () => {
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
    /"Status": "draft" \| "active" \| "archived";/,
  );
  assert.match(functions.content, /return "draft";/);
  assert.match(functions.content, /=== "active"/);
  assert.match(functions.content, /EvermoreModels\["Status"\]/);
});

test("rejects unknown choice cases", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  active
end

function value
  returns Status
  return Status.missing
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2305"),
      );
      return true;
    },
  );
});

test("rejects duplicate cases", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  active
  active
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2301"),
      );
      return true;
    },
  );
});

test("keeps different choice types nominally distinct", () => {
  const invalid = String.raw`
app "Nominal"

choice Status
  active
end

choice Mode
  active
end

function wrong
  returns Status
  return Mode.active
end

screen Home
  title "Nominal"
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
