import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "AI Native"

data ResearchQuestion
  query text
end

data SearchResult
  summary text
end

data ResearchReport
  answer text
end

function searchWeb
  takes input ResearchQuestion
  returns SearchResult
  return SearchResult(input.query)
end

function evaluationInput
  returns ResearchQuestion
  return ResearchQuestion("Evermore")
end

function evaluationExpected
  returns ResearchReport
  return ResearchReport("Typed agents")
end

tool WebSearch
  takes ResearchQuestion
  returns SearchResult
  permission "network.search"
  uses searchWeb
end

context ResearchContext
  include "project-files"
  include "current-conversation"
  budget 12000
  overflow summarize
end

agent Researcher
  accepts ResearchQuestion
  returns ResearchReport
  model "reasoning"
  context ResearchContext
  tool WebSearch
  approval WebSearch
  budget tokens 4000
  budget cost 2
  trace
end

evaluation ResearchSmoke
  agent Researcher
  input evaluationInput
  expected evaluationExpected
end

screen Home
  title "AI native"
`;

test("parses AI-native declarations", () => {
  const program = parse(source);

  assert.equal(program.tools[0]?.permission, "network.search");
  assert.equal(program.contexts[0]?.tokenBudget, 12000);
  assert.deepEqual(program.agents[0]?.tools, ["WebSearch"]);
  assert.deepEqual(program.agents[0]?.approvalTools, ["WebSearch"]);
  assert.equal(program.agents[0]?.modelRequirement, "reasoning");
  assert.equal(program.agents[0]?.tracing, true);
  assert.equal(program.evaluations[0]?.agentName, "Researcher");
});

test("formatter preserves AI contracts", () => {
  const formatted = formatSource(source);

  assert.match(formatted, /tool WebSearch/);
  assert.match(formatted, /permission "network\.search"/);
  assert.match(formatted, /context ResearchContext/);
  assert.match(formatted, /budget 12000/);
  assert.match(formatted, /agent Researcher/);
  assert.match(formatted, /approval WebSearch/);
  assert.match(formatted, /budget tokens 4000/);
  assert.match(formatted, /evaluation ResearchSmoke/);
});

test("ai target emits runtime, schemas, tracing and evaluation harness", () => {
  const result = compile(source, { target: "ai" });
  const runtime = result.files.find(
    (file) => file.path === "src/generated/runtime.ts",
  );
  const evaluations = result.files.find(
    (file) => file.path === "src/evaluations.ts",
  );
  const manifest = result.files.find(
    (file) => file.path === "src/generated/evermore.ai.json",
  );

  assert.ok(runtime);
  assert.ok(evaluations);
  assert.ok(manifest);

  assert.match(runtime.content, /EvermoreModelProvider/);
  assert.match(runtime.content, /executeEvermoreTool/);
  assert.match(runtime.content, /Human approval denied or missing/);
  assert.match(runtime.content, /exceeded token budget/);
  assert.match(runtime.content, /exceeded cost budget/);
  assert.match(runtime.content, /agent\.start/);
  assert.match(runtime.content, /createDeterministicModel/);
  assert.match(evaluations.content, /ResearchSmoke/);
});

test("tools require handlers matching their typed contracts", () => {
  const invalid = String.raw`
app "Broken"

data Input
  value text
end

function wrong
  returns text
  return "wrong"
end

tool BrokenTool
  takes Input
  returns text
  permission "network"
  uses wrong
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2803"),
      );
      return true;
    },
  );
});

test("approval boundaries can only reference granted tools", () => {
  const invalid = String.raw`
app "Broken"

data Input
  value text
end

data Output
  value text
end

agent BrokenAgent
  accepts Input
  returns Output
  model "reasoning"
  approval MissingTool
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2825"),
      );
      return true;
    },
  );
});

test("evaluation fixtures must match the agent contract", () => {
  const invalid = String.raw`
app "Broken"

data Input
  value text
end

data Output
  value text
end

function badInput
  returns text
  return "wrong"
end

function expected
  returns Output
  return Output("ok")
end

agent Worker
  accepts Input
  returns Output
  model "reasoning"
end

evaluation Smoke
  agent Worker
  input badInput
  expected expected
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2833"),
      );
      return true;
    },
  );
});
