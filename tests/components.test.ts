import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Components"

component Actions

  stack horizontal

    button "Explore"
      opens Details

    button "Home"
      opens Home

  end

end

screen Home
  title "Reusable by default"
  use Actions

screen Details
  title "Still Evermore"
  use Actions
`;

test("parses top-level reusable components", () => {
  const program = parse(source);

  assert.equal(program.components.length, 1);
  assert.equal(program.components[0]?.name, "Actions");
  assert.equal(program.screens.length, 2);
});

test("component use expands through IR into generated screens", () => {
  const result = compile(source);
  const home = result.files.find(
    (file) => file.path === "src/generated/screens/HomeScreen.vue",
  );
  const details = result.files.find(
    (file) => file.path === "src/generated/screens/DetailsScreen.vue",
  );

  assert.ok(home);
  assert.ok(details);
  assert.match(home.content, />Explore</);
  assert.match(home.content, />Home</);
  assert.match(details.content, />Explore</);
  assert.match(details.content, />Home</);
});

test("formatter emits canonical natural components", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /component Actions/);
  assert.match(formatted, /\nend\n\nscreen Home/);
  assert.match(formatted, /use Actions/);
});

test("rejects unknown components", () => {
  const invalid = String.raw`
app "Broken"

screen Home
  use Missing
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E2011");
      return true;
    },
  );
});

test("rejects component cycles", () => {
  const invalid = String.raw`
app "Cycle"

component A
  use B
end

component B
  use A
end

screen Home
  use A
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2012"),
      );
      return true;
    },
  );
});

test("M1 components cannot access screen-local state", () => {
  const invalid = String.raw`
app "Stateful"

component CounterValue
  show count
end

screen Home
  state count starts 0
  use CounterValue
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2013"),
      );
      return true;
    },
  );
});
