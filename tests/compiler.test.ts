import assert from "node:assert/strict";
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

test("generates a Vue-oriented target", () => {
  const result = compile(hello);

  assert.equal(result.target, "vue");
  assert.ok(
    result.files.some(
      (file) => file.path === "src/generated/screens/HomeScreen.vue",
    ),
  );
  assert.ok(
    result.files.some((file) => file.path === "src/generated/routes.ts"),
  );
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
