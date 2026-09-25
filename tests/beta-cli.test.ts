import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverTestEntries, initializeProject, prepareGeneratedDestination, runGeneratedWeb } from "../src/beta-cli.js";
import { compilePackage } from "../src/compiler.js";
import { formatSource } from "../src/formatter.js";

async function tempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "evermore-beta-"));
}

function cli(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", path.resolve("src/cli.ts"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("init creates a compilable package with canonical formatting and refuses overwrites", async () => {
  const root = path.join(await tempDirectory(), "first-app");
  await initializeProject(root);
  const manifest = JSON.parse(await readFile(path.join(root, "evermore.json"), "utf8"));
  const source = await readFile(path.join(root, "main.ever"), "utf8");
  assert.deepEqual(manifest, {
    name: "first-app",
    version: "0.1.0",
    entry: "main.ever",
    dependencies: {},
  });
  assert.equal(formatSource(source), source);
  const compiled = await compilePackage(path.join(root, "evermore.json"), (file) => readFile(file, "utf8"));
  assert.deepEqual(compiled.package, { name: "first-app", version: "0.1.0" });
  assert.ok(compiled.files.some((file) => file.path === "src/generated/routes.ts"));
  await assert.rejects(() => initializeProject(root), /not empty/);
  assert.deepEqual((await readdir(root)).sort(), [".gitignore", "evermore.json", "main.ever"]);
});

test("test discovery ignores generated folders and symlinks and prefers package manifests", async () => {
  const root = await tempDirectory();
  await writeFile(path.join(root, "standalone.ever"), 'app "Standalone"\nscreen Home\n  title "Home"\n');
  await initializeProject(path.join(root, "app"));
  await writeFile(path.join(root, "app", "extra.ever"), 'module Extra\n');
  await initializeProject(path.join(root, "node_modules", "vendor"));
  const entries = await discoverTestEntries(root);
  assert.deepEqual([...entries].sort(), [
    path.join(root, "app", "evermore.json"),
    path.join(root, "standalone.ever"),
  ].sort());
  await symlink(path.join(root, "app"), path.join(root, "linked-app"), "dir");
  assert.deepEqual([...(await discoverTestEntries(root))].sort(), [...entries].sort());
});

test("generated outputs reject pre-existing symlinks and directories", async () => {
  const root = await tempDirectory();
  const output = path.join(root, "out");
  const outside = path.join(root, "outside");
  await initializeProject(outside);
  await prepareGeneratedDestination(output, path.join(output, "src", "file.ts"));
  await symlink(outside, path.join(output, "linked"), "dir");
  await assert.rejects(
    () => prepareGeneratedDestination(output, path.join(output, "linked", "escape.ts")),
    /Unsafe generated output parent/,
  );
  await assert.rejects(
    () => prepareGeneratedDestination(output, path.join(root, "escape.ts")),
    /escapes the build directory/,
  );
  await symlink(path.join(outside, "main.ever"), path.join(output, "bad.ts"));
  await assert.rejects(
    () => prepareGeneratedDestination(output, path.join(output, "bad.ts")),
    /Unsafe generated output file/,
  );
});

test("the beta CLI init/check/test/format/build path works end-to-end", async () => {
  const root = await tempDirectory();
  const made = cli(root, "init", "SampleApp");
  assert.equal(made.status, 0, made.stderr);
  const manifest = path.join(root, "SampleApp", "evermore.json");
  const source = path.join(root, "SampleApp", "main.ever");
  const check = cli(root, "check", manifest);
  assert.equal(check.status, 0, check.stderr);
  const formatCheck = cli(root, "format", source, "--check");
  assert.equal(formatCheck.status, 0, formatCheck.stderr);
  const suite = cli(root, "test", manifest);
  assert.equal(suite.status, 0, suite.stderr);
  assert.match(suite.stdout, /1 passed, 0 failed/);
  const build = cli(root, "build", manifest, "--out", "web");
  assert.equal(build.status, 0, build.stderr);
  assert.ok((await readdir(path.join(root, "web"))).includes("package.json"));
  const runWithoutInstall = cli(root, "run", manifest, "--no-install");
  assert.equal(runWithoutInstall.status, 1);
  assert.match(runWithoutInstall.stderr, /Generated dependencies are missing/);
});

test("CLI test and format --check fail on invalid or unformatted programs", async () => {
  const root = await tempDirectory();
  const broken = path.join(root, "broken.ever");
  await writeFile(broken, 'app "Broken"\nscreen Home {\n  button "Wrong" {\n    opens Missing\n  }\n}\n');
  const failure = cli(root, "test", broken);
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /E2002/);
  const unformatted = path.join(root, "messy.ever");
  await writeFile(unformatted, 'app "Messy" screen Home { title "Hello" }');
  assert.equal(cli(root, "format", unformatted, "--check").status, 1);
  const fixed = cli(root, "format", unformatted, "--write");
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.equal(cli(root, "format", unformatted, "--check").status, 0);
  assert.equal(cli(root, "build", unformatted, "--target").status, 1);
});

test("run does not install dependencies when explicitly disabled", async () => {
  const root = await tempDirectory();
  await assert.rejects(() => runGeneratedWeb(root, false), /dependencies are missing/);
});
