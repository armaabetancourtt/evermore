import assert from "node:assert/strict";
import test from "node:test";

import { lex } from "../src/lexer.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
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


test("tracks positions through CRLF and standalone CR line endings", () => {
  const tokens = lex('app "Demo"\r\nscreen Home {\r title "Hi"\n}');
  const screen = tokens.find((token) => token.kind === "screen");
  const title = tokens.find((token) => token.kind === "title");
  assert.deepEqual([screen?.span.start.line, screen?.span.start.column], [2, 1]);
  assert.deepEqual([title?.span.start.line, title?.span.start.column], [3, 2]);
});

test("comments terminate on CR and CRLF without swallowing the next declaration", () => {
  for (const newline of ["\r", "\r\n"]) {
    const tokens = lex('app "Demo" // note' + newline + 'screen Home {}');
    assert.equal(tokens.find((token) => token.kind === "screen")?.span.start.line, 2);
  }
});

test("accepts a leading UTF-8 BOM without changing source offsets", () => {
  const tokens = lex('\uFEFFapp "Demo"');
  assert.equal(tokens[0]?.kind, "app");
  assert.equal(tokens[0]?.span.start.offset, 1);
});

test("rejects unknown escapes rather than silently altering string data", () => {
  assert.throws(
    () => lex('app "bad\\q"'),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.equal(error.diagnostics[0]?.code, "E0004");
      return true;
    },
  );
});

test("preserves supported escapes", () => {
  const tokens = lex('app "a\\nb\\t\\\"c\\\\d"');
  assert.equal(tokens[1]?.value, 'a\nb\t"c\\d');
});
