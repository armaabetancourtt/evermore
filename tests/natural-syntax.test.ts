import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { parse } from "../src/parser.js";

const explicit = String.raw`
app "Demo"

screen Home {
  title "Build what you imagine"

  button "Continue" {
    opens Future
  }
}

screen Future {
  title "Software in human terms"
}
`;

const natural = String.raw`
app "Demo"

screen Home

  title "Build what you imagine"

  button "Continue"
    opens Future

screen Future

  title "Software in human terms"
`;

test("natural syntax parses without braces", () => {
  const program = parse(natural);

  assert.equal(program.screens.length, 2);
  assert.equal(program.screens[0]?.name, "Home");
  assert.equal(program.screens[1]?.name, "Future");
});

test("indentation is not semantically significant", () => {
  const flat = String.raw`
app "Demo"
screen Home
title "Build what you imagine"
button "Continue"
opens Future
screen Future
title "Software in human terms"
`;

  const naturalFiles = compile(natural).files;
  const flatFiles = compile(flat).files;

  assert.deepEqual(flatFiles, naturalFiles);
});

test("natural and explicit forms lower to identical generated artifacts", () => {
  assert.deepEqual(compile(natural).files, compile(explicit).files);
});
