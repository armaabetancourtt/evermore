import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Generics"

function identity
  generic T
  takes value T
  returns T
  return value
end

function wrap
  generic T
  takes value T
  returns list of T
  return [value]
end

function empty
  generic T
  returns list of T
  return []
end

function numberIdentity
  returns number
  return identity(42)
end

function textIdentity
  returns text
  return identity("Evermore")
end

function emptyNumbers
  returns list of number
  return empty()
end

screen Home
  title "Generics"
`;

test("parses natural generic type parameters", () => {
  const program = parse(source);

  assert.equal(program.functions[0]?.typeParameters[0]?.name, "T");
  assert.equal(program.functions[1]?.typeParameters[0]?.name, "T");
});

test("formatter emits generic declarations canonically", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /function identity\n\n  generic T/);
  assert.match(formatted, /takes value T/);
  assert.match(formatted, /returns list of T/);
});

test("infers generic calls from arguments and expected result context", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates real TypeScript generic functions", () => {
  const result = compile(source);
  const generated = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(generated);
  assert.match(generated.content, /function fn_0<T0>\(arg_0: T0\): T0/);
  assert.match(
    generated.content,
    /function fn_1<T0>\(arg_0: T0\): ReadonlyArray<T0>/,
  );
  assert.match(
    generated.content,
    /function fn_2<T0>\(\): ReadonlyArray<T0>/,
  );
  assert.match(generated.content, /return fn_0\(42\);/);
  assert.match(generated.content, /return fn_0\("Evermore"\);/);
  assert.match(generated.content, /return fn_2\(\);/);
});

test("rejects duplicate generic type parameters", () => {
  const invalid = String.raw`
app "Broken"

function identity
  generic T
  generic T
  takes value T
  returns T
  return value
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2220"),
      );
      return true;
    },
  );
});

test("rejects generic type names that shadow existing types", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text
end

function identity
  generic User
  takes value User
  returns User
  return value
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2221"),
      );
      return true;
    },
  );
});

test("rejects calls whose generic type cannot be inferred", () => {
  const invalid = String.raw`
app "Broken"

function empty
  generic T
  returns list of T
  return []
end

function ambiguous
  returns number
  let values = empty()
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2222"),
      );
      return true;
    },
  );
});

test("generic calls remain type-safe across repeated parameters", () => {
  const invalid = String.raw`
app "Broken"

function same
  generic T
  takes left T
  takes right T
  returns T
  return left
end

function wrong
  returns number
  return same(1, "two")
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2209"),
      );
      return true;
    },
  );
});
