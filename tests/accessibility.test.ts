import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";

const source = String.raw`
app "Accessible"

screen Home

  state count starts 0

  show count

  button "Add"
    increases count
`;

test("generated state output announces reactive changes politely", () => {
  const result = compile(source);
  const home = result.files.find(
    (file) => file.path === "src/generated/screens/HomeScreen.vue",
  );

  assert.ok(home);
  assert.match(home.content, /<output[^>]+aria-live="polite"/);
});

test("generated design system includes keyboard and motion defaults", () => {
  const result = compile(source);
  const css = result.files.find((file) => file.path === "src/style.css");

  assert.ok(css);
  assert.match(css.content, /\.evermore-button:focus-visible/);
  assert.match(css.content, /prefers-reduced-motion: reduce/);
  assert.match(css.content, /min-height: 3rem/);
});
