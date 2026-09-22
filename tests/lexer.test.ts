import assert from "node:assert/strict";
import test from "node:test";

import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";

test("tracks source positions across lines", () => {
  const tokens = lex('app "Demo"\nscreen Home {\n title "Hi"\n}');

  const screen = tokens.find((token) => token.kind === "screen");
  assert.equal(screen?.span.start.line, 2);
  assert.equal(screen?.span.start.column, 1);
});

test("comments are trivia and do not affect parsing", () => {
  const program = parse(`
app "Demo"
// comment
screen Home {
  title "Hello"
}
`);

  assert.equal(program.screens.length, 1);
  assert.equal(program.screens[0]?.name, "Home");
});
