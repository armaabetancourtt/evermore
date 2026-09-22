import assert from "node:assert/strict";
import test from "node:test";

import { formatSource } from "../src/formatter.js";

const messy = 'app "Demo" screen Home { title "Hello" button "Go" { opens Next } } screen Next { title "Done" }';

const expectedNatural = `app "Demo"

screen Home

  title "Hello"

  button "Go"
    opens Next

screen Next

  title "Done"
`;

const expectedExplicit = `app "Demo"

screen Home {
  title "Hello"

  button "Go" {
    opens Next
  }
}

screen Next {
  title "Done"
}
`;

test("formats source into canonical natural syntax", () => {
  assert.equal(formatSource(messy), expectedNatural);
});

test("formats source into canonical explicit syntax", () => {
  assert.equal(formatSource(messy, "explicit"), expectedExplicit);
});

test("formatting is idempotent", () => {
  assert.equal(formatSource(expectedNatural), expectedNatural);
});
