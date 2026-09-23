import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Infrastructure"

server Api
  port 4100

  database Primary postgres
    connection "DATABASE_URL"
  end
end

deploy Production
  server Api
  image "ghcr.io/example/api:0.7.0"
  replicas 3
  port 4100
  health "/health"
  readiness "/ready"
  env NODE_ENV "NODE_ENV"
  secret DATABASE_URL "prod/database-url"
  observability "open-telemetry"
  rollback 5
end

screen Home
  title "Infra"
`;

test("parses and formats deployment intent", () => {
  const program = parse(source);
  const deployment = program.deployments[0];
  assert.equal(deployment?.serverName, "Api");
  assert.equal(deployment?.replicas, 3);
  assert.equal(deployment?.observability, "open-telemetry");
  assert.equal(deployment?.rollbackRevisions, 5);

  const formatted = formatSource(source);
  assert.match(formatted, /deploy Production/);
  assert.match(formatted, /secret DATABASE_URL "prod\/database-url"/);
  assert.match(formatted, /observability "open-telemetry"/);
});

test("infra target emits inspectable plan and guarded mutation artifacts", () => {
  const result = compile(source, { target: "infra" });
  const paths = new Set(result.files.map((file) => file.path));

  for (const required of [
    "evermore.plan.json",
    "deploy/production/Dockerfile",
    "deploy/production/kubernetes.yaml",
    "deploy/production/plan.sh",
    "deploy/production/apply.sh",
    "deploy/production/rollback.sh",
  ]) {
    assert.ok(paths.has(required), "missing " + required);
  }

  const manifest = result.files.find((file) => file.path === "evermore.plan.json")!;
  const kubernetes = result.files.find((file) => file.path === "deploy/production/kubernetes.yaml")!;
  const dockerfile = result.files.find((file) => file.path === "deploy/production/Dockerfile")!;
  const apply = result.files.find((file) => file.path === "deploy/production/apply.sh")!;

  assert.match(manifest.content, /"mutationRequiresExplicitApply": true/);
  assert.match(manifest.content, /"externalSecretsOnly": true/);
  assert.match(kubernetes.content, /secretKeyRef:/);
  assert.match(kubernetes.content, /revisionHistoryLimit: 5/);
  assert.match(kubernetes.content, /path: "\/health"/);
  assert.match(kubernetes.content, /path: "\/ready"/);
  assert.match(dockerfile.content, /EXPOSE 4100/);
  assert.match(apply.content, /EVERMORE_APPLY/);
});

test("infra policy rejects mutable latest images", () => {
  const invalid = source.replace(
    'image "ghcr.io/example/api:0.7.0"',
    'image "ghcr.io/example/api:latest"',
  );

  assert.throws(
    () => compile(invalid, { target: "infra" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "E3105"));
      return true;
    },
  );
});

test("database credentials must be declared as external secrets", () => {
  const invalid = source.replace(
    '  secret DATABASE_URL "prod/database-url"\n',
    "",
  );

  assert.throws(
    () => compile(invalid, { target: "infra" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "E3117"));
      return true;
    },
  );
});
