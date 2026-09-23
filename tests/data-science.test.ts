import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Data"

data HousingRow
  area number
  bedrooms number
  price number
end

data ModelArtifact
  path text
end

data Metrics
  mae number
end

dataset Housing
  row HousingRow
  source "housing.csv"
end

array Features
  dtype "float64"
  shape "*,3"
end

python TrainHousing
  takes list of HousingRow
  returns ModelArtifact
  module "model_impl"
  callable "train"
end

python EvaluateHousing
  takes ModelArtifact
  returns Metrics
  module "model_impl"
  callable "evaluate"
end

pipeline HousingPipeline
  dataset Housing
  train TrainHousing
  evaluate EvaluateHousing
  seed 42
  tracking "experiments/housing.jsonl"
end

screen Home
  title "Data"
`;

test("parses datasets, arrays, Python bridges and pipelines", () => {
  const program = parse(source);
  assert.equal(program.datasets[0]?.rowType, "HousingRow");
  assert.equal(program.arrays[0]?.dtype, "float64");
  assert.equal(program.arrays[0]?.shape, "*,3");
  assert.equal(program.pythonBridges[0]?.moduleName, "model_impl");
  assert.equal(program.pipelines[0]?.seed, 42);
});

test("formatter preserves data workflow contracts", () => {
  const formatted = formatSource(source);
  assert.match(formatted, /dataset Housing/);
  assert.match(formatted, /row HousingRow/);
  assert.match(formatted, /array Features/);
  assert.match(formatted, /dtype "float64"/);
  assert.match(formatted, /python TrainHousing/);
  assert.match(formatted, /module "model_impl"/);
  assert.match(formatted, /pipeline HousingPipeline/);
  assert.match(formatted, /tracking "experiments\/housing\.jsonl"/);
});

test("python target emits typed reproducible data artifacts", () => {
  const result = compile(source, { target: "python" });
  const paths = new Set(result.files.map((file) => file.path));
  const datasets = result.files.find((file) => file.path === "evermore_generated/datasets.py")!;
  const arrays = result.files.find((file) => file.path === "evermore_generated/arrays.py")!;
  const pipelines = result.files.find((file) => file.path === "evermore_generated/pipelines.py")!;
  const manifest = result.files.find((file) => file.path === "evermore.data.json")!;

  for (const required of [
    "requirements.txt",
    "evermore_generated/contracts.py",
    "evermore_generated/datasets.py",
    "evermore_generated/arrays.py",
    "evermore_generated/bridges.py",
    "evermore_generated/tracking.py",
    "evermore_generated/pipelines.py",
    "run.py",
    "evermore.data.json",
  ]) {
    assert.ok(paths.has(required), "missing " + required);
  }

  assert.match(datasets.content, /pandas as pd/);
  assert.match(datasets.content, /sha256/);
  assert.match(arrays.content, /numpy as np/);
  assert.match(arrays.content, /float64/);
  assert.match(pipelines.content, /random\.seed\(42\)/);
  assert.match(pipelines.content, /np\.random\.seed\(42\)/);
  assert.match(pipelines.content, /JsonlTracker/);
  assert.match(manifest.content, /deterministicSeeds/);
});

test("pipeline training input must match dataset rows", () => {
  const invalid = String.raw`
app "Broken"

data Row
  value number
end

data Other
  value number
end

data Artifact
  path text
end

data Metrics
  score number
end

dataset Rows
  row Row
  source "rows.csv"
end

python Train
  takes list of Other
  returns Artifact
  module "m"
  callable "train"
end

python Evaluate
  takes Artifact
  returns Metrics
  module "m"
  callable "evaluate"
end

pipeline P
  dataset Rows
  train Train
  evaluate Evaluate
  seed 1
  tracking "runs.jsonl"
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "python" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "E3034"));
      return true;
    },
  );
});

test("evaluation input must match training output", () => {
  const invalid = String.raw`
app "Broken"

data Row
  value number
end

data Artifact
  path text
end

data WrongArtifact
  path text
end

data Metrics
  score number
end

dataset Rows
  row Row
  source "rows.csv"
end

python Train
  takes list of Row
  returns Artifact
  module "m"
  callable "train"
end

python Evaluate
  takes WrongArtifact
  returns Metrics
  module "m"
  callable "evaluate"
end

pipeline P
  dataset Rows
  train Train
  evaluate Evaluate
  seed 1
  tracking "runs.jsonl"
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "python" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "E3035"));
      return true;
    },
  );
});

test("array shapes are validated statically", () => {
  const invalid = String.raw`
app "Broken"

array Bad
  dtype "float32"
  shape "x,3"
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "E3011"));
      return true;
    },
  );
});
