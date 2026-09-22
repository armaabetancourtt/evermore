import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Pattern Matching"

choice Status
  draft
  active
  archived
end

function statusLabel
  takes status Status
  returns text
  return match status
    case draft then "Draft"
    case active then "Active"
    case archived then "Archived"
  end
end

screen Home
  title "Match"
`;

test("parses exhaustive match expressions", () => {
  const program = parse(source);
  const statement = program.functions[0]?.body[0];

  assert.equal(statement?.kind, "ReturnStatement");

  if (statement?.kind === "ReturnStatement") {
    assert.equal(statement.expression.kind, "MatchExpression");

    if (statement.expression.kind === "MatchExpression") {
      assert.equal(statement.expression.cases.length, 3);
    }
  }
});

test("formatter preserves readable nested match syntax", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /return match status/);
  assert.match(formatted, /    case draft then "Draft"/);
  assert.match(formatted, /    case active then "Active"/);
  assert.match(formatted, /  end\nend/);
});

test("generates a single-evaluation switch expression", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /const matchValue = arg_0/);
  assert.match(generated.content, /case "draft": return "Draft"/);
  assert.match(generated.content, /case "active": return "Active"/);
  assert.match(generated.content, /Unreachable Evermore match/);
});

test("rejects non-exhaustive matches", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  draft
  active
end

function label
  takes status Status
  returns text
  return match status
    case draft then "Draft"
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2314"),
      );
      return true;
    },
  );
});

test("rejects duplicate match branches", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  draft
end

function label
  takes status Status
  returns text
  return match status
    case draft then "One"
    case draft then "Two"
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2312"),
      );
      return true;
    },
  );
});

test("rejects unknown match cases", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  draft
end

function label
  takes status Status
  returns text
  return match status
    case missing then "Missing"
    case draft then "Draft"
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2311"),
      );
      return true;
    },
  );
});

test("rejects matches over non-choice values", () => {
  const invalid = String.raw`
app "Broken"

function label
  takes value number
  returns text
  return match value
    case one then "One"
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2310"),
      );
      return true;
    },
  );
});

test("rejects incompatible match branch types", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  draft
  active
end

function label
  takes status Status
  returns text
  return match status
    case draft then "Draft"
    case active then 1
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2313"),
      );
      return true;
    },
  );
});
