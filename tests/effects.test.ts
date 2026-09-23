import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Effects"

function fetchName
  async
  effects network, database.read
  using Network, DatabaseRead
  returns text
  return "Ada"
end

function loadName
  async
  effects network, database.read
  using Network, DatabaseRead
  returns text
  return fetchName()
end

screen Home
  title "Effects"
`;

test("parses explicit async effect and capability signatures", () => {
  const program = parse(source);
  const fetchName = program.functions[0];

  assert.equal(fetchName?.isAsync, true);
  assert.deepEqual(fetchName?.effects, ["network", "database.read"]);
  assert.deepEqual(fetchName?.capabilities, ["Network", "DatabaseRead"]);
});

test("formats effect boundaries canonically", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /function fetchName\n\n  async/);
  assert.match(formatted, /  effects network, database\.read/);
  assert.match(formatted, /  using Network, DatabaseRead/);
});

test("accepts explicit transitive async/effect/capability propagation", () => {
  assert.doesNotThrow(() => compile(source));
});

test("emits async TypeScript functions and awaits async calls", () => {
  const result = compile(source);
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(functions);
  assert.match(
    functions.content,
    /async function fn_0\(\): Promise<string>/,
  );
  assert.match(
    functions.content,
    /async function fn_1\(\): Promise<string>/,
  );
  assert.match(functions.content, /return await fn_0\(\);/);
});

test("rejects missing transitive effects", () => {
  const invalid = String.raw`
app "Missing Effect"

function networkValue
  effects network
  using Network
  returns text
  return "ok"
end

function wrapper
  using Network
  returns text
  return networkValue()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2250"),
      );
      return true;
    },
  );
});

test("rejects missing transitive capabilities", () => {
  const invalid = String.raw`
app "Missing Capability"

function networkValue
  effects network
  using Network
  returns text
  return "ok"
end

function wrapper
  effects network
  returns text
  return networkValue()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2251"),
      );
      return true;
    },
  );
});

test("rejects async calls from synchronous functions", () => {
  const invalid = String.raw`
app "Missing Async"

function asyncValue
  async
  effects network
  using Network
  returns text
  return "ok"
end

function wrapper
  effects network
  using Network
  returns text
  return asyncValue()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2252"),
      );
      return true;
    },
  );
});

test("rejects duplicate effect and capability declarations", () => {
  const invalid = String.raw`
app "Duplicates"

function broken
  effects network, network
  using Network, Network
  returns text
  return "no"
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2253"),
      );
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2254"),
      );
      return true;
    },
  );
});

test("keeps methods pure until effectful method dispatch is modeled", () => {
  const invalid = String.raw`
app "Method Boundary"

data Box
  value text

  function load
    async
    effects network
    using Network
    returns text
    return value
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
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2415"),
      );
      return true;
    },
  );
});
