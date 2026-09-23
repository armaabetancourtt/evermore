import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

import { compile } from "../../src/compiler.js";
import { IncrementalCompiler } from "../../src/incremental.js";

const source = await readFile(
  path.resolve("examples/showcase.ever"),
  "utf8",
);
const iterations = 20;

const coldStart = performance.now();
for (let index = 0; index < iterations; index += 1) {
  compile(source, { target: "vue" });
}
const coldMs = performance.now() - coldStart;

const incremental = new IncrementalCompiler();
const cachedStart = performance.now();
for (let index = 0; index < iterations; index += 1) {
  incremental.compile(source, { target: "vue" });
}
const cachedMs = performance.now() - cachedStart;

process.stdout.write(
  JSON.stringify(
    {
      benchmark: "m9-incremental-compilation",
      iterations,
      coldMs,
      cachedMs,
      cache: incremental.stats(),
      note:
        "Exploratory local timing only; no cross-machine performance claim is made.",
    },
    null,
    2,
  ) + "\n",
);
