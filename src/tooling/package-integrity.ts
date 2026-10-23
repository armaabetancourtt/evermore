import { createHash, timingSafeEqual } from "node:crypto";

export type ImmutablePackageRecord = {
  readonly name: string;
  readonly version: string;
  readonly sha256: string;
};

/** Fail-closed integrity check for downloaded immutable registry blobs. */
export function verifyPackageBlob(record: ImmutablePackageRecord, bytes: Uint8Array): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(record.name)) throw new Error("Invalid package name");
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(record.version)) throw new Error("Invalid package version");
  if (!/^[0-9a-f]{64}$/.test(record.sha256)) throw new Error("Invalid SHA-256 digest");
  const expected = Buffer.from(record.sha256, "hex");
  const actual = createHash("sha256").update(bytes).digest();
  if (!timingSafeEqual(expected, actual)) throw new Error("Package integrity mismatch");
}

export function makeLockEntry(name: string, version: string, bytes: Uint8Array): ImmutablePackageRecord {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const record = { name, version, sha256 };
  verifyPackageBlob(record, bytes);
  return record;
}
