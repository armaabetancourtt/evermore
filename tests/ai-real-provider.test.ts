import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.js";
import { readFileSync } from "node:fs";

test("real provider, live evaluations and deterministic harness emitted side by side", () => {
  const source = readFileSync("examples/ai-native.ever", "utf8");
  const files = compile(source, { target: "ai" }).files;
  const file = (path: string) => {
    const found = files.find((candidate) => candidate.path === path);
    assert.ok(found, "Missing generated " + path);
    return found.content;
  };
  assert.match(file("src/generated/openai-provider.ts"), /createOpenAIProvider/);
  assert.match(file("src/generated/openai-provider.ts"), /Unapproved model-requested capability/);
  assert.match(file("src/generated/openai-provider.ts"), /Cost budget requires explicit provider prices/);
  assert.match(file("src/evaluations.live.ts"), /exactMatchRate/);
  assert.match(file("src/evaluations.live.ts"), /p95LatencyMs/);
  assert.match(file("src/evaluations.ts"), /createDeterministicModel/);
  assert.match(file("package.json"), /test:live/);
});
