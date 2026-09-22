import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Results"

data User
  name text
end

function loadUser
  takes found boolean
  returns result of User error text
  return if found then ok(User("Ada")) else error("not-found")
end

function userName
  takes outcome result of User error text
  returns text
  return match outcome
    case ok user then user.name
    case error reason then reason
  end
end

function genericSuccess
  generic T
  takes value T
  returns result of T error text
  return ok(value)
end

function numberResult
  returns result of number error text
  return genericSuccess(42)
end

screen Home
  title "Explicit results"
`;

test("parses typed result annotations and payload match bindings", () => {
  const program = parse(source);
  const load = program.functions[0];
  const unwrap = program.functions[1];

  assert.equal(load?.returnType.kind, "ResultTypeAnnotation");

  const statement = unwrap?.body[0];
  assert.equal(statement?.kind, "ReturnStatement");

  if (
    statement?.kind === "ReturnStatement" &&
    statement.expression.kind === "MatchExpression"
  ) {
    assert.deepEqual(
      statement.expression.cases.map((branch) => [
        branch.caseName,
        branch.bindingName,
      ]),
      [
        ["ok", "user"],
        ["error", "reason"],
      ],
    );
  }
});

test("formatter preserves result and payload-match syntax", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /returns result of User error text/);
  assert.match(formatted, /return ok\(User\("Ada"\)\)/);
  assert.match(formatted, /else error\("not-found"\)/);
  assert.match(formatted, /case ok user then user\.name/);
  assert.match(formatted, /case error reason then reason/);
});

test("typechecks explicit success/failure flows and generic results", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates discriminated TypeScript Result values and narrowing", () => {
  const result = compile(source);
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(functions);
  assert.match(
    functions.content,
    /readonly kind: "ok"; readonly value: EvermoreModels\["User"\]/,
  );
  assert.match(
    functions.content,
    /readonly kind: "error"; readonly error: string/,
  );
  assert.match(functions.content, /kind: "ok", value:/);
  assert.match(functions.content, /kind: "error", error: "not-found"/);
  assert.match(functions.content, /switch \(matchValue\.kind\)/);
  assert.match(functions.content, /const match_binding_0 = matchValue\.value/);
  assert.match(functions.content, /const match_binding_1 = matchValue\.error/);
});

test("rejects non-exhaustive result matches", () => {
  const invalid = String.raw`
app "Broken"

function unwrap
  takes outcome result of number error text
  returns number
  return match outcome
    case ok value then value
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

test("rejects unknown result cases", () => {
  const invalid = String.raw`
app "Broken"

function unwrap
  takes outcome result of number error text
  returns number
  return match outcome
    case success value then value
    case error reason then 0
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2343"),
      );
      return true;
    },
  );
});

test("rejects incompatible result payloads", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns result of number error text
  return ok("wrong")
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2342"),
      );
      return true;
    },
  );
});

test("requires contextual typing for standalone result constructors", () => {
  const invalid = String.raw`
app "Broken"

function broken
  returns number
  let value = ok(1)
  return 0
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2340"),
      );
      return true;
    },
  );
});

test("rejects payload bindings on payload-free choice cases", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  active
end

function label
  takes status Status
  returns text
  return match status
    case active value then "active"
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2344"),
      );
      return true;
    },
  );
});
