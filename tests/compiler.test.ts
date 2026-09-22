import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { parse } from "../src/parser.js";

const hello = String.raw`
app "Hello"

screen Home {
  title "Build what you imagine"

  button "Continue" {
    opens Dashboard
  }
}

screen Dashboard {
  title "Built with Evermore"
}
`;

test("parses an application with screens and navigation", () => {
  const program = parse(hello);

  assert.equal(program.appName, "Hello");
  assert.equal(program.screens.length, 2);
  assert.equal(program.screens[0]?.name, "Home");
  assert.equal(program.screens[1]?.name, "Dashboard");
});

test("generates a complete Vue/Vite target", () => {
  const result = compile(hello);

  assert.equal(result.target, "vue");

  const paths = new Set(result.files.map((file) => file.path));

  assert.ok(paths.has("package.json"));
  assert.ok(paths.has("index.html"));
  assert.ok(paths.has("vite.config.ts"));
  assert.ok(paths.has("src/main.ts"));
  assert.ok(paths.has("src/App.vue"));
  assert.ok(paths.has("src/style.css"));
  assert.ok(paths.has("src/generated/screens/HomeScreen.vue"));
  assert.ok(paths.has("src/generated/routes.ts"));
  assert.ok(paths.has("src/generated/evermore.manifest.json"));
});

test("generated manifest matches the golden contract", () => {
  const result = compile(hello);
  const manifest = result.files.find(
    (file) => file.path === "src/generated/evermore.manifest.json",
  );

  assert.ok(manifest);

  const golden = readFileSync(
    new URL("./golden/hello.manifest.json", import.meta.url),
    "utf8",
  );

  assert.equal(manifest.content, golden);
});

test("rejects navigation to an unknown screen", () => {
  const invalid = String.raw`
app "Broken"

screen Home {
  button "Disappear" {
    opens Missing
  }
}
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2002");
      return true;
    },
  );
});
