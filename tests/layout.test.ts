import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const natural = String.raw`
app "Layout"

screen Home

  title "Designed in Evermore"

  stack vertical

    text "Compose interfaces with intent."

    stack horizontal

      button "Explore"
        opens Details

      button "Again"
        opens Home

    end

  end

screen Details

  title "Layout without framework ceremony"

  text "Stacks are language semantics, not Vue syntax."
`;

const explicit = String.raw`
app "Layout"

screen Home {
  title "Designed in Evermore"

  stack vertical {
    text "Compose interfaces with intent."

    stack horizontal {
      button "Explore" {
        opens Details
      }

      button "Again" {
        opens Home
      }
    }
  }
}

screen Details {
  title "Layout without framework ceremony"
  text "Stacks are language semantics, not Vue syntax."
}
`;

test("parses nested natural stacks", () => {
  const program = parse(natural);
  const home = program.screens[0];

  assert.equal(home?.body[1]?.kind, "StackStatement");

  if (home?.body[1]?.kind === "StackStatement") {
    assert.equal(home.body[1].direction, "vertical");
    assert.equal(home.body[1].body[1]?.kind, "StackStatement");
  }
});

test("natural and explicit stacks lower identically", () => {
  assert.deepEqual(compile(natural).files, compile(explicit).files);
});

test("formatter preserves natural stack terminators", () => {
  const formatted = formatSource(explicit);

  assert.match(formatted, /stack vertical/);
  assert.match(formatted, /stack horizontal/);
  assert.match(formatted, /\n    end\n\n  end/);
});

test("Vue target renders nested responsive stack classes", () => {
  const result = compile(natural);
  const home = result.files.find(
    (file) => file.path === "src/generated/screens/HomeScreen.vue",
  );

  assert.ok(home);
  assert.match(
    home.content,
    /evermore-stack evermore-stack--vertical/,
  );
  assert.match(
    home.content,
    /evermore-stack evermore-stack--horizontal/,
  );
});

test("semantic validation reaches buttons inside stacks", () => {
  const invalid = String.raw`
app "Broken"

screen Home

  stack vertical

    button "Missing"
      opens Nowhere

  end
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
