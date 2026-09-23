# M6 Data Boundary Decisions

## Typed Python boundary

Python interop is declared with `python` bridges. Each bridge has an Evermore input/output contract plus a Python module and callable name. Generated code resolves the callable with `importlib` and exposes a typed Python function rather than invoking shell commands.

## Dataframes and provenance

A `dataset` names one Evermore row contract and one source. The Python target loads CSV sources with pandas and records:
- source path;
- SHA-256 content hash;
- row count;
- column names.

This metadata is attached to every pipeline tracking event.

## Numerical representation

Evermore's core `number` remains a language scalar. Numerical array declarations are separate data-science contracts with explicit NumPy-compatible dtypes (`float32`, `float64`, `int64`) and shapes. This avoids silently changing core numeric semantics to match one scientific backend.

## Zero-copy / interprocess boundary

M6 deliberately does not promise zero-copy transport. The generated Python backend executes bridges in the Python process and therefore avoids unnecessary serialization inside the generated pipeline. Cross-process and cross-language zero-copy transport is deferred to a later optimization layer where Arrow-compatible memory can be measured and specified rather than assumed.

## Reproducibility

Every pipeline has an explicit integer seed. The generated runner seeds Python's random module and NumPy. Experiment tracking is represented by an interface and a default JSONL implementation.

## Notebook interoperability

Evermore remains source-first: the `.ever` program is the authoritative pipeline contract. Generated Python modules are ordinary importable modules, so notebooks may call them for exploration without becoming the canonical source of pipeline semantics.

## Train/evaluate contract

For a pipeline:
- training input must be exactly `list of <dataset row type>`;
- evaluation input must exactly match training output;
- metrics/output remain an ordinary Evermore type.

These constraints are checked before Python generation.
