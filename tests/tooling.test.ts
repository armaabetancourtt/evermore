import assert from "node:assert/strict";
import test from "node:test";

import {
  diagnosticsForSource,
  formatDocument,
  generateMarkdownDocumentation,
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
