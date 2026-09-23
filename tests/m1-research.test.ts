import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { formatSource } from "../src/formatter.js";
import { lex } from "../src/lexer.js";

const corpus = [
  String.raw`
app "Navigation"

screen Home
  title "Start"
  button "Continue"
    opens Details

screen Details
  title "Details"
`,
  String.raw`
app "Layout"

component Header
  stack horizontal
    text "Evermore"
    button "Home"
      opens Home
  end
end

screen Home
  title "Human syntax"
  stack vertical
    use Header
    text "Readable structure"
  end
`,
  String.raw`
app "State"

screen Counter
  title "Counter"
  state count starts 0
  show count
  button "Add"
    increases count
`,
] as const;

test("M1 ambiguity corpus is invariant to indentation and extra whitespace", () => {
  for (const source of corpus) {
    const canonical = compile(source).files;
    const flattened = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line, index, lines) => line.length > 0 || index === 0 || index === lines.length - 1)
      .join("\n");

    assert.deepEqual(
      compile(flattened).files,
      canonical,
      "Whitespace or indentation changed program meaning.",
    );
  }
});

test("M1 natural and explicit canonical surfaces compile identically", () => {
  for (const source of corpus) {
    const natural = formatSource(source, "natural");
    const explicit = formatSource(source, "explicit");

    assert.deepEqual(
      compile(natural).files,
      compile(explicit).files,
      "Natural and explicit syntax diverged semantically.",
    );
  }
});

test("M1 natural surface uses fewer syntax tokens and characters than explicit form", () => {
  let naturalCharacters = 0;
  let explicitCharacters = 0;
  let naturalTokens = 0;
  let explicitTokens = 0;

  for (const source of corpus) {
    const natural = formatSource(source, "natural");
    const explicit = formatSource(source, "explicit");

    naturalCharacters += natural.length;
    explicitCharacters += explicit.length;
    naturalTokens += lex(natural).length - 1;
    explicitTokens += lex(explicit).length - 1;
  }

  assert.ok(
    naturalCharacters < explicitCharacters,
    `Expected natural syntax to use fewer characters, got ${naturalCharacters} vs ${explicitCharacters}.`,
  );
  assert.ok(
    naturalTokens < explicitTokens,
    `Expected natural syntax to use fewer tokens, got ${naturalTokens} vs ${explicitTokens}.`,
  );
});
