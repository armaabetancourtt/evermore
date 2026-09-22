import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const typed = String.raw`
app "Typed Product"

data User
  id id
  name text
  age number
  active boolean
  address Address
end

data Address
  street text
  city text
end

screen Home
  title "Types belong to the language"
`;

test("parses nominal data declarations and forward references", () => {
  const program = parse(typed);

  assert.equal(program.data.length, 2);
  assert.equal(program.data[0]?.name, "User");
  assert.equal(program.data[0]?.fields[4]?.typeName, "Address");
});

test("generates target-neutral nominal types into TypeScript model map", () => {
  const result = compile(typed);
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );

  assert.ok(models);
  assert.match(models.content, /export type EvermoreModels/);
  assert.match(models.content, /"id": string;/);
  assert.match(models.content, /"age": number;/);
  assert.match(models.content, /"active": boolean;/);
  assert.match(
    models.content,
    /"address": EvermoreModels\["Address"\];/,
  );
});

test("formatter emits canonical natural data blocks", () => {
  const formatted = formatSource(
    'app "Demo" data User { name text age number } screen Home { title "Hi" }',
  );

  assert.equal(
    formatted,
    `app "Demo"

data User

  name text
  age number
end

screen Home

  title "Hi"
`,
  );
});

test("rejects unknown field types", () => {
  const invalid = String.raw`
app "Broken"

data User
  pet Unicorn
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2102"),
      );
      return true;
    },
  );
});

test("rejects duplicate fields", () => {
  const invalid = String.raw`
app "Broken"

data User
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2101"),
      );
      return true;
    },
  );
});

test("rejects duplicate data type names", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text
end

data User
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2100"),
      );
      return true;
    },
  );
});
