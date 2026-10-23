import assert from "node:assert/strict";
import test from "node:test";
import { makeLockEntry, verifyPackageBlob } from "../src/tooling/package-integrity.js";
test("package digest is deterministic and verified", () => {
  const bytes = Buffer.from("hello evermore");
  const entry = makeLockEntry("evermore-core", "1.2.3", bytes);
  assert.equal(entry.sha256.length, 64);
  assert.doesNotThrow(() => verifyPackageBlob(entry, bytes));
  assert.throws(() => verifyPackageBlob(entry, Buffer.from("tampered")), /integrity mismatch/);
});
test("malformed identities and digest are rejected", () => {
  const bytes = Buffer.from("ok");
  assert.throws(() => verifyPackageBlob({name:"../bad",version:"1.0.0",sha256:"0".repeat(64)},bytes));
  assert.throws(() => verifyPackageBlob({name:"good",version:"latest",sha256:"0".repeat(64)},bytes));
});
