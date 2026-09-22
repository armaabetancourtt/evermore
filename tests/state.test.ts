import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const counter = String.raw`
app "Counter"

screen Home

  title "Count without ceremony"

  state count starts 0

  show count

  button "Add"
    increases count
`;

test("parses numeric screen state and increment actions", () => {
  const program = parse(counter);
  const screen = program.screens[0];

  assert.equal(screen?.body[1]?.kind, "StateDeclaration");
  assert.equal(screen?.body[2]?.kind, "ShowStatement");
  assert.equal(screen?.body[3]?.kind, "ButtonStatement");

  if (screen?.body[3]?.kind === "ButtonStatement") {
    assert.equal(screen.body[3].action?.kind, "IncrementAction");
  }
});

test("formats reactive state using natural syntax", () => {
  const formatted = formatSource(
    'app "Counter" screen Home { state count starts 0 show count button "Add" { increases count } }',
  );

  assert.equal(
    formatted,
    `app "Counter"

screen Home

  state count starts 0

  show count

  button "Add"
    increases count
`,
  );
});

test("Vue target uses ref and reactive mutation", () => {
  const result = compile(counter);
  const home = result.files.find(
    (file) => file.path === "src/generated/screens/HomeScreen.vue",
  );

  assert.ok(home);
  assert.match(home.content, /import \{ ref \} from "vue";/);
  assert.match(home.content, /const state_count = ref\(0\);/);
  assert.match(home.content, /\{\{ state_count \}\}/);
  assert.match(home.content, /@click="state_count \+= 1"/);
});

test("rejects references to unknown state", () => {
  const invalid = String.raw`
app "Broken"

screen Home
  show missing
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2004");
      return true;
    },
  );
});

test("rejects increments of unknown state", () => {
  const invalid = String.raw`
app "Broken"

screen Home
  button "Add"
    increases missing
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2005");
      return true;
    },
  );
});
