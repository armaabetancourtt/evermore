import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Words"

screen Home

  title "Hello"

  text "Software should feel understandable."

  button "Continue"
    opens Next

screen Next

  text "Still Evermore."
`;

test("parses text as a first-class UI statement", () => {
  const program = parse(source);
  const home = program.screens[0];

  assert.equal(home?.body[1]?.kind, "TextStatement");

  if (home?.body[1]?.kind === "TextStatement") {
    assert.equal(home.body[1].text, "Software should feel understandable.");
  }
});

test("lowers and renders text in the Vue target", () => {
  const result = compile(source);
  const home = result.files.find(
    (file) => file.path === "src/generated/screens/HomeScreen.vue",
  );

  assert.ok(home);
  assert.match(home.content, /class="evermore-text"/);
  assert.match(home.content, /Software should feel understandable\./);
});
