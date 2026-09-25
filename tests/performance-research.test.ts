import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { IncrementalCompiler } from "../src/incremental.js";
import { lowerToIR } from "../src/ir.js";
import { optimizeIR } from "../src/optimizer.js";
import { parse } from "../src/parser.js";
import { emitNumericWasm } from "../src/research/wasm.js";
import { analyze } from "../src/semantic.js";

const source = String.raw`
app "Performance"

function add
  takes left number
  takes right number
  returns number
  return left + right
end

function folded
  returns number
  return 2 + 3 * 4
end

screen Home
  title "Performance"
`;

test("IR optimizer folds pure numeric constants", () => {
  const analysis = analyze(parse(source));
  assert.ok(analysis.model);
  const result = optimizeIR(lowerToIR(analysis.model));
  const folded = result.program.functions.find(
    (fn) => fn.name === "folded",
  );
  const statement = folded?.body[0];

  assert.equal(statement?.kind, "Return");
  if (statement?.kind !== "Return") return;
  assert.deepEqual(statement.expression, {
    kind: "Number",
    value: 14,
  });
  assert.ok(result.stats.foldedConstants >= 2);
});

test("incremental compiler records deterministic cache hits", () => {
  const compiler = new IncrementalCompiler();
  const first = compiler.compile(source, { target: "wasm" });
  const second = compiler.compile(source, { target: "wasm" });

  assert.equal(first, second);
  assert.deepEqual(compiler.stats(), {
    hits: 1,
    misses: 1,
    entries: 1,
  });

  compiler.invalidate();
  assert.equal(compiler.stats().entries, 0);
});

test("numeric research subset emits executable WebAssembly", async () => {
  const analysis = analyze(parse(source));
  assert.ok(analysis.model);
  const optimized = optimizeIR(lowerToIR(analysis.model)).program;
  const module = emitNumericWasm(optimized);

  const instantiated = await WebAssembly.instantiate(module.bytes);
  const instance =
    "instance" in (instantiated as object)
      ? (instantiated as unknown as WebAssembly.WebAssemblyInstantiatedSource).instance
      : (instantiated as WebAssembly.Instance);
  const add = instance.exports["add"];

  assert.equal(typeof add, "function");
  if (typeof add !== "function") return;
  assert.equal((add as (left: number, right: number) => number)(2, 5), 7);
});

test("wasm compiler target exposes inspectable byte manifest", () => {
  const result = compile(source, { target: "wasm" });
  const manifest = result.files.find(
    (file) => file.path === "evermore.wasm.json",
  );
  const runner = result.files.find(
    (file) => file.path === "run.mjs",
  );

  assert.ok(manifest);
  assert.ok(runner);
  const parsed = JSON.parse(manifest.content) as {
    readonly exports: readonly string[];
    readonly bytes: readonly number[];
  };
  assert.ok(parsed.exports.includes("add"));
  assert.deepEqual(parsed.bytes.slice(0, 4), [0, 97, 115, 109]);
});


test("incremental cache evicts least recently used results", () => {
  const compiler = new IncrementalCompiler({ maxEntries: 2 });
  const a = source;
  const b = source.replace('"Performance"', '"Performance B"');
  const c = source.replace('"Performance"', '"Performance C"');
  const first = compiler.compile(a, { target: "wasm" });
  compiler.compile(b, { target: "wasm" });
  assert.equal(compiler.compile(a, { target: "wasm" }), first);
  compiler.compile(c, { target: "wasm" });
  assert.equal(compiler.stats().entries, 2);
  compiler.compile(b, { target: "wasm" });
  assert.equal(compiler.stats().misses, 4);
  assert.equal(compiler.stats().entries, 2);
});

test("incremental cache rejects invalid limits and never caches failures", () => {
  for (const maxEntries of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.throws(() => new IncrementalCompiler({ maxEntries }), RangeError);
  }
  const compiler = new IncrementalCompiler({ maxEntries: 1 });
  assert.throws(() => compiler.compile('app "Broken" screen'), Error);
  assert.equal(compiler.stats().entries, 0);
});
