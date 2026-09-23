import assert from "node:assert/strict";
import test from "node:test";

import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { parse } from "../src/parser.js";

test("reports multiple independent syntax errors in one parse", () => {
  const source = String.raw`
app "Broken"

screen Home {
  typo "one"
  title
  button "Continue" {
    opens Dashboard
  }
}

screen Dashboard {
  typo "two"
  title "Still parsed"
}
`;

  assert.throws(
    () => parse(source),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics.length, 3);
      assert.equal(error.diagnostics[0]?.code, "E1004");
      assert.equal(error.diagnostics[1]?.code, "E1001");
      assert.equal(error.diagnostics[2]?.code, "E1004");
      return true;
    },
  );
});

test("recovers at the next screen after a malformed declaration", () => {
  const source = String.raw`
app "Broken"

screen {
  title "Missing name"
}

screen Valid {
  title "Recovered"
}
`;

  assert.throws(
    () => parse(source),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics.length, 1);
      assert.equal(error.diagnostics[0]?.code, "E1001");
      return true;
    },
  );
});


test("stray screen end is rejected without stalling recovery", () => {
  const source = String.raw`
app "Broken"

screen Home
  title "Home"
end
`;

  assert.throws(
    () => parse(source),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics.length, 1);
      assert.equal(error.diagnostics[0]?.code, "E1004");
      return true;
    },
  );
});
