import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { compilePackage } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { loadPackageProject } from "../src/package.js";

const virtualRoot = path.resolve("/virtual/packages");
const manifestPath = path.join(virtualRoot, "app", "evermore.json");

function reader(
  files: Readonly<Record<string, string>>,
): (absolutePath: string) => Promise<string> {
  const normalized = new Map(
    Object.entries(files).map(([name, source]) => [
      path.resolve(virtualRoot, name),
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

const files = {
  "app/evermore.json": JSON.stringify({
    name: "atlas-app",
    version: "0.1.0",
    entry: "main.ever",
    dependencies: {
      shared: {
        path: "../shared",
        version: "1.2.3",
      },
    },
  }),
  "app/main.ever": String.raw`
app "Package App"
import "shared/models"

function greeting
  returns text
  let user = makeUser("Ada")
  return user.display()
end

screen Home
  title "Packages"
`,
  "shared/evermore.json": JSON.stringify({
    name: "shared",
    version: "1.2.3",
    entry: "index.ever",
    dependencies: {
      contracts: {
        path: "../contracts",
        version: "2.0.0",
      },
    },
  }),
  "shared/index.ever": "module SharedIndex\n",
  "shared/models.ever": String.raw`
module SharedModels
import "contracts"

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
  "contracts/evermore.json": JSON.stringify({
    name: "contracts",
    version: "2.0.0",
    entry: "named.ever",
    dependencies: {},
  }),
  "contracts/named.ever": String.raw`
module Contracts

protocol Named
  name text

  function display
    returns text
  end
end
`,
};

test("loads exact local package dependencies transitively", async () => {
  const project = await loadPackageProject(
    manifestPath,
    reader(files),
  );

  assert.equal(project.rootPackage.manifest.name, "atlas-app");
  assert.equal(project.rootPackage.manifest.version, "0.1.0");
  assert.deepEqual(
    project.packages.map((item) => [
      item.manifest.name,
      item.manifest.version,
    ]),
    [
      ["atlas-app", "0.1.0"],
      ["contracts", "2.0.0"],
      ["shared", "1.2.3"],
    ],
  );

  assert.deepEqual(
    project.program.data.map((item) => item.name),
    ["User"],
  );
  assert.deepEqual(
    project.program.protocols.map((item) => item.name),
    ["Named"],
  );
});

test("compiles package imports across transitive package boundaries", async () => {
  const result = await compilePackage(
    manifestPath,
    reader(files),
  );

  assert.deepEqual(result.package, {
    name: "atlas-app",
    version: "0.1.0",
  });

  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );
  const packageArtifact = result.files.find(
    (file) => file.path === "src/generated/evermore.package.json",
  );

  assert.ok(models);
  assert.ok(functions);
  assert.ok(packageArtifact);
  assert.match(models.content, /"User": EvermoreProtocols\["Named"\]/);
  assert.match(functions.content, /"makeUser"/);

  const graph = JSON.parse(packageArtifact.content) as {
    name: string;
    version: string;
    packages: Array<{
      name: string;
      version: string;
      dependencies: Record<string, string>;
    }>;
  };

  assert.equal(graph.name, "atlas-app");
  assert.equal(graph.version, "0.1.0");
  assert.deepEqual(
    graph.packages.find((item) => item.name === "shared")?.dependencies,
    { contracts: "2.0.0" },
  );
});

test("rejects undeclared bare package imports", async () => {
  const invalid = {
    ...files,
    "app/main.ever": String.raw`
app "Broken"
import "missing/models"

screen Home
  title "Broken"
`,
  };

  await assert.rejects(
    () => loadPackageProject(manifestPath, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2704"),
      );
      return true;
    },
  );
});

test("rejects exact dependency version mismatches", async () => {
  const manifest = JSON.parse(files["app/evermore.json"]) as {
    dependencies: {
      shared: {
        path: string;
        version: string;
      };
    };
  };
  manifest.dependencies.shared.version = "9.9.9";

  const invalid = {
    ...files,
    "app/evermore.json": JSON.stringify(manifest),
  };

  await assert.rejects(
    () => loadPackageProject(manifestPath, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2705"),
      );
      return true;
    },
  );
});

test("rejects invalid package versions", async () => {
  const manifest = JSON.parse(files["app/evermore.json"]) as {
    version: string;
  };
  manifest.version = "latest";

  const invalid = {
    ...files,
    "app/evermore.json": JSON.stringify(manifest),
  };

  await assert.rejects(
    () => loadPackageProject(manifestPath, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2702"),
      );
      return true;
    },
  );
});

test("rejects non-local dependency paths in M2", async () => {
  const manifest = JSON.parse(files["app/evermore.json"]) as {
    dependencies: {
      shared: {
        path: string;
        version: string;
      };
    };
  };
  manifest.dependencies.shared.path = "https://example.com/shared";

  const invalid = {
    ...files,
    "app/evermore.json": JSON.stringify(manifest),
  };

  await assert.rejects(
    () => loadPackageProject(manifestPath, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2703"),
      );
      return true;
    },
  );
});

test("rejects cyclic package dependency graphs", async () => {
  const contractsManifest = {
    name: "contracts",
    version: "2.0.0",
    entry: "named.ever",
    dependencies: {
      "atlas-app": {
        path: "../app",
        version: "0.1.0",
      },
    },
  };

  const invalid = {
    ...files,
    "contracts/evermore.json": JSON.stringify(contractsManifest),
  };

  await assert.rejects(
    () => loadPackageProject(manifestPath, reader(invalid)),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2706"),
      );
      return true;
    },
  );
});
