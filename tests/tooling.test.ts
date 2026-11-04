import assert from "node:assert/strict";
import test from "node:test";

import {
  diagnosticsForSource,
  formatDocument,
  generateMarkdownDocumentation,
  documentEnd,
  renameIdentifier,
  semanticTokensForSource,
} from "../src/tooling/language-service.js";

const valid = String.raw`
app "Tooling"

data User
  name text
end

function identity
  takes value User
  returns User
  return value
end

screen Home
  title "Tooling"
`;

test("editor diagnostics expose parser and semantic failures", () => {
  const diagnostics = diagnosticsForSource('app "Broken"\nscreen Home\n  title');
  assert.ok(diagnostics.length > 0);
  assert.equal(diagnostics[0]?.source, "evermore");
  assert.ok(diagnostics[0]?.range.start.line >= 0);
});

test("editor formatter returns canonical Evermore source", () => {
  const formatted = formatDocument(valid);
  assert.match(formatted, /data User/);
  assert.match(formatted, /function identity/);
});

test("semantic token stream is LSP delta encoded", () => {
  const data = semanticTokensForSource(valid);
  assert.ok(data.length > 0);
  assert.equal(data.length % 5, 0);
});

test("rename operates on identifier tokens without touching strings", () => {
  const position = { line: 3, character: 6 };
  const edits = renameIdentifier(valid, position, "Account");
  assert.ok(edits.length >= 2);
  assert.ok(edits.every((edit) => edit.newText === "Account"));
});

test("documentation generator summarizes language declarations", () => {
  const markdown = generateMarkdownDocumentation(valid);
  assert.match(markdown, /# Tooling/);
  assert.match(markdown, /## Data/);
  assert.match(markdown, /`User`/);
  assert.match(markdown, /## Functions/);
  assert.match(markdown, /`identity`/);
});


test("rename rejects reserved words and invalid names while allowing hyphenated identifiers", () => {
  const position = { line: 3, character: 6 };
  for (const invalid of ["screen", "if", "data", "9Account", "two words", ""]) {
    assert.deepEqual(renameIdentifier(valid, position, invalid), []);
  }
  const edits = renameIdentifier(valid, position, "User-profile");
  assert.ok(edits.length >= 2);
  assert.ok(edits.every((edit) => edit.newText === "User-profile"));
});

test("rename uses end-exclusive identifier ranges and validates editor positions", () => {
  assert.deepEqual(renameIdentifier(valid, { line: 3, character: 9 }, "Account"), []);
  assert.deepEqual(renameIdentifier(valid, { line: 999, character: 0 }, "Account"), []);
  assert.deepEqual(renameIdentifier(valid, { line: 3, character: 999 }, "Account"), []);
});

test("rename handles CRLF and CR line endings", () => {
  const source = 'app "Demo"\r\ndata User\r  name text\nend';
  const edits = renameIdentifier(source, { line: 1, character: 6 }, "Account");
  assert.equal(edits.length, 1);
  assert.deepEqual(edits[0]?.range.start, { line: 1, character: 5 });
});

test("document end positions ignore CRLF and standalone CR separators", () => {
  assert.deepEqual(documentEnd('app "Demo"\r\nscreen Home\r'), { line: 2, character: 0 });
  assert.deepEqual(documentEnd("abc\rdef"), { line: 1, character: 3 });
});

test("multiline string semantic tokens remain inside individual lines", () => {
  const data = semanticTokensForSource('app "one\nsecond"');
  assert.deepEqual(data.slice(-5), [1, 0, 7, 1, 0]);
});
