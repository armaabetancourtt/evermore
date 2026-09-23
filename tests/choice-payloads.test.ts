import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Choice Payloads"

choice LoadState
  idle
  loaded(text)
  failed(text)
end

function makeLoaded
  takes value text
  returns LoadState
  return LoadState.loaded(value)
end

function describe
  takes state LoadState
  returns text
  return match state
    case idle then "Idle"
    case loaded value then value
    case failed message then message
  end
end

screen Home
  title "Choice Payloads"
`;

test("parses typed payloads on choice cases", () => {
  const program = parse(source);
  const choice = program.choices[0];

  assert.equal(choice?.name, "LoadState");
  assert.equal(choice?.cases[0]?.payloadType, undefined);
  assert.equal(choice?.cases[1]?.payloadType?.kind, "NamedTypeAnnotation");

  if (choice?.cases[1]?.payloadType?.kind === "NamedTypeAnnotation") {
    assert.equal(choice.cases[1].payloadType.name, "text");
  }
});

test("formats choice payload declarations canonically", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /choice LoadState/);
  assert.match(formatted, /  loaded\(text\)/);
  assert.match(formatted, /case loaded value then value/);
});

test("typechecks payload construction and match bindings", () => {
  const result = compile(source);
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(models);
  assert.ok(functions);
  assert.match(
    models.content,
    /"LoadState": "idle" \| \{ readonly kind: "loaded"; readonly payload: string \} \| \{ readonly kind: "failed"; readonly payload: string \};/,
  );
  assert.match(
    functions.content,
    /\(\{ kind: "loaded", payload: arg_0 \} as const\)/,
  );
  assert.match(functions.content, /case "loaded"/);
  assert.match(functions.content, /"payload" in matchValue/);
});

test("rejects missing payload construction", () => {
  const invalid = String.raw`
app "Broken"

choice LoadState
  loaded(text)
end

function broken
  returns LoadState
  return LoadState.loaded
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2345"),
      );
      return true;
    },
  );
});

test("rejects wrong choice payload types", () => {
  const invalid = String.raw`
app "Broken"

choice LoadState
  loaded(text)
end

function broken
  returns LoadState
  return LoadState.loaded(42)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2348"),
      );
      return true;
    },
  );
});

test("rejects binding a payload-less choice case", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  idle
end

function broken
  takes status Status
  returns text
  return match status
    case idle value then value
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

test("rejects unknown choice payload types", () => {
  const invalid = String.raw`
app "Broken"

choice Status
  loaded(MissingType)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2307"),
      );
      return true;
    },
  );
});
