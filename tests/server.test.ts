import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Full Stack"

data User
  id id
  name text
end

data CreateUser
  name text
end

function listUsers
  returns list of User
  return []
end

function createUser
  takes input CreateUser
  returns User
  return User("generated", input.name)
end

function nightly
  returns text
  return "done"
end

server Api
  port 4100

  endpoint GET "/users"
    returns list of User
    uses listUsers
    auth public
  end

  endpoint POST "/users"
    takes CreateUser
    returns User
    uses createUser
    auth bearer
  end

  database Primary postgres
    connection "DATABASE_URL"
  end

  repository Users
    model User
    using Primary
  end

  job Nightly
    every "0 2 * * *"
    uses nightly
  end

  realtime UserEvents
    message User
  end
end

screen Home
  title "Full stack"
`;

test("parses full-stack server declarations", () => {
  const program = parse(source);
  const server = program.servers[0];

  assert.equal(server?.name, "Api");
  assert.equal(server?.port, 4100);
  assert.equal(server?.endpoints.length, 2);
  assert.equal(server?.endpoints[1]?.auth, "bearer");
  assert.equal(server?.databases[0]?.connectionEnv, "DATABASE_URL");
  assert.equal(server?.repositories[0]?.modelName, "User");
  assert.equal(server?.jobs[0]?.schedule, "0 2 * * *");
  assert.equal(server?.realtime[0]?.name, "UserEvents");
});

test("formatter preserves server contracts", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /server Api/);
  assert.match(formatted, /endpoint POST "\/users"/);
  assert.match(formatted, /takes CreateUser/);
  assert.match(formatted, /auth bearer/);
  assert.match(formatted, /database Primary postgres/);
  assert.match(formatted, /repository Users/);
  assert.match(formatted, /job Nightly/);
  assert.match(formatted, /realtime UserEvents/);
});

test("node target emits operational server artifacts", () => {
  const result = compile(source, { target: "node" });
  const paths = new Set(result.files.map((file) => file.path));

  for (const required of [
    "src/index.ts",
    "src/generated/server.ts",
    "src/generated/contracts.ts",
    "src/generated/validation.ts",
    "src/generated/repositories.ts",
    "src/generated/jobs.ts",
    "src/generated/realtime.ts",
    "src/generated/evermore.server.json",
  ]) {
    assert.ok(paths.has(required), "missing " + required);
  }

  const server = result.files.find(
    (file) => file.path === "src/generated/server.ts",
  )!;
  const contracts = result.files.find(
    (file) => file.path === "src/generated/contracts.ts",
  )!;
  const repositories = result.files.find(
    (file) => file.path === "src/generated/repositories.ts",
  )!;

  assert.match(server.content, /createServer/);
  assert.match(server.content, /authorization/);
  assert.match(server.content, /validateEvermoreValue/);
  assert.match(contracts.content, /Api POST \/users/);
  assert.match(repositories.content, /UsersPostgresRepository/);
  assert.match(repositories.content, /DATABASE_URL/);
});

test("endpoint handler signatures must match shared contracts", () => {
  const invalid = String.raw`
app "Broken"

data Request
  name text
end

function wrong
  returns text
  return "wrong"
end

server Api
  endpoint POST "/create"
    takes Request
    returns text
    uses wrong
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "node" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2705"),
      );
      return true;
    },
  );
});

test("repositories require declared models and databases", () => {
  const invalid = String.raw`
app "Broken"

server Api
  repository Users
    model Missing
    using MissingDb
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "node" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2712"),
      );
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2713"),
      );
      return true;
    },
  );
});

test("jobs require zero-argument handlers", () => {
  const invalid = String.raw`
app "Broken"

function scheduled
  takes value text
  returns text
  return value
end

server Api
  job Scheduled
    every "* * * * *"
    uses scheduled
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "node" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2722"),
      );
      return true;
    },
  );
});
