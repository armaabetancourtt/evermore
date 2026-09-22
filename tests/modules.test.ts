import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { compile, compileProject } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";
import { loadProject } from "../src/project.js";

const root = path.resolve("/virtual/evermore");
const entry = path.join(root, "main.ever");

function reader(
  files: Readonly<Record<string, string>>,
): (absolutePath: string) => Promise<string> {
  const normalized = new Map(
    Object.entries(files).map(([name, source]) => [
      path.resolve(root, name),
      source,
    ]),
  );

  return async (absolutePath: string) => {
    const source = normalized.get(path.resolve(absolutePath));
    if (source === undefined) {
      throw new Error("missing " + absolutePath);
    }
    return source;
  };
}

const sources = {
  "main.ever": String.raw`
app "Modules"
import "./domain"

function greeting
  returns text
  let user = makeUser("Ada")
  return user.display()
end

screen Home
  title "Modules"
`,
  "domain.ever": String.raw`
module Domain
import "./contracts.ever"

data User
  conforms Named
  name text

  function display
    returns text
    return name
  end
end

function makeUser
  takes name text
  returns User
  return User(name)
end
`,
  "contracts.ever": String.raw`
module Contracts

protocol Named
  name text

  function display
    returns text
  end
end
`,
};

test("parses and formats module headers with relative imports", () => {
  const program = parse(sources["domain.ever"]);

  assert.equal(program.unitKind, "module");
  assert.equal(program.moduleName, "Domain");
  assert.equal(program.imports[0]?.path, "./contracts.ever");

  const formatted = formatSource(sources["domain.ever"]);
  assert.match(formatted, /^module Domain\nimport "\.\/contracts\.ever"/);
});

test("loads recursive modules into one semantic project", async () => {
  const project = await loadProject(entry, reader(sources));

  assert.equal(project.program.unitKind, "app");
  assert.equal(project.program.appName, "Modules");
  assert.equal(project.units.length, 3);
  assert.deepEqual(
    project.units.map((unit) => path.basename(unit.path)),
    ["contracts.ever", "domain.ever", "main.ever"],
  );
  assert.deepEqual(
    project.program.protocols.map((item) => item.name),
    ["Named"],
  );
  assert.deepEqual(
    project.program.data.map((item) => item.name),
    ["User"],
  );
});

test("compiles cross-module types, functions, protocols and methods", async () => {
  const result = await compileProject(entry, reader(sources));
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );

  assert.ok(functions);
  assert.ok(models);
  assert.match(models.content, /"User": EvermoreProtocols\["Named"\]/);
  assert.match(functions.content, /"makeUser"/);
  assert.match(functions.content, /\["display"\]\(\)/);
});

test("deduplicates a physical module imported through the graph", async () => {
  const duplicateSources = {
    ...sources,
    "main.ever": String.raw`
app "Modules"
import "./domain"
import "./contracts.ever"

screen Home
  title "Modules"
`,
  };

  const project = await loadProject(entry, reader(duplicateSources));
  assert.equal(project.units.length, 3);
  assert.equal(project.program.protocols.length, 1);
});

test("rejects package-like imports until package semantics exist", async () => {
  const invalid = {
    "main.ever": String.raw`
app "Broken"
import "some-package"

screen Home
  title "Broken"
`,
  };

  await assert.rejects(
    () => loadProject(entry, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2602"),
      );
      return true;
    },
  );
});

test("rejects importing another app as a module", async () => {
  const invalid = {
    "main.ever": String.raw`
app "Broken"
import "./other.ever"

screen Home
  title "Broken"
`,
    "other.ever": String.raw`
app "Other"

screen Other
  title "Other"
`,
  };

  await assert.rejects(
    () => loadProject(entry, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2601"),
      );
      return true;
    },
  );
});

test("rejects cyclic module imports", async () => {
  const invalid = {
    "main.ever": String.raw`
app "Broken"
import "./a.ever"

screen Home
  title "Broken"
`,
    "a.ever": String.raw`
module A
import "./b.ever"
`,
    "b.ever": String.raw`
module B
import "./a.ever"
`,
  };

  await assert.rejects(
    () => loadProject(entry, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2603"),
      );
      return true;
    },
  );
});

test("rejects duplicate module names across different files", async () => {
  const invalid = {
    "main.ever": String.raw`
app "Broken"
import "./a.ever"
import "./b.ever"

screen Home
  title "Broken"
`,
    "a.ever": "module Shared\n",
    "b.ever": "module Shared\n",
  };

  await assert.rejects(
    () => loadProject(entry, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2604"),
      );
      return true;
    },
  );
});

test("standalone compile rejects module roots and unresolved imports", () => {
  assert.throws(
    () => compile("module Domain\n"),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2600");
      return true;
    },
  );

  assert.throws(
    () =>
      compile(String.raw`
app "NeedsModules"
import "./domain.ever"

screen Home
  title "Needs modules"
`),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2606");
      return true;
    },
  );
});
