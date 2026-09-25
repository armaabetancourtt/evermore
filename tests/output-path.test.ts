import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveGeneratedPath } from "../src/output-path.js";

test("generated outputs remain within the chosen build directory", () => {
  const root = path.resolve("beta-build");
  assert.equal(resolveGeneratedPath(root, "src/generated/app.ts"), path.join(root, "src/generated/app.ts"));
});

test("generated output paths reject traversal, absolute paths and malformed segments", () => {
  for (const unsafe of [
    "../escape.ts",
    "src/../../escape.ts",
    "/tmp/escape.ts",
    "C:\\escape.ts",
    "src\\escape.ts",
    "./src/file.ts",
    "src//file.ts",
    "src/./file.ts",
    "src/../file.ts",
    "",
    "bad\u0000file.ts",
  ]) {
    assert.throws(() => resolveGeneratedPath("beta-build", unsafe), /Unsafe generated output path/);
  }
});
