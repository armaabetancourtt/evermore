
# Evermore Roadmap

## Principle

Evermore has a very large vision and a deliberately narrow implementation strategy.

Each milestone must end in **executable evidence**.

Architecture documents do not count as feature completion.

---

## M0 — Compiler foundation

**Status: complete ✅**

Goals:

- [x] repository vision in English and Spanish;
- [x] source spans and diagnostics;
- [x] lexer;
- [x] parser for first explicit syntax;
- [x] AST;
- [x] semantic validation for screen references;
- [x] prototype Vue code generation;
- [x] compiler tests;
- [x] CI green on main;
- [x] example language program compiled to target artifacts in CI;
- [x] golden tests for generated output;
- [x] parser error-recovery strategy.

Exit condition:

> A small .ever program can be parsed, validated and deterministically transformed into compilable target artifacts.

---

## M1 — Human syntax + Web vertical slice

**Status: complete ✅**

Goals:

- [x] natural syntax without semantic indentation;
- [x] canonical formatter;
- [x] text and buttons;
- [x] stacks and layout;
- [x] state;
- [x] navigation;
- [x] reusable components;
- [x] first Vue/Vite application shell;
- [x] accessibility defaults;
- [x] generated target compile tests.

Research:

- [x] natural syntax ambiguity study (reproducible natural/explicit target-equivalence corpus);
- [x] source readability study (reproducible source-ergonomics proxies; no unsupported human-subject claim);
- [x] AST/IR equivalence between natural and explicit modes.

Exit condition:

> A non-trivial two-to-five-screen web application can be written primarily in Evermore and run through Vite.

---

## M2 — Core language

**Status: complete ✅ — executable typed domain core operational**

Goals:

- [x] variables and constants (immutable inferred `let`, explicitly mutable inferred `var`, and type-preserving `set` assignment);
- [x] expressions (literals, arithmetic, comparisons, calls, lists, conditionals and exhaustive matches);
- [x] pure typed functions;
- [x] nominal data structures (typed field contracts, nominal construction and member access);
- [x] enums / algebraic choices (nominal payload-free `choice` types);
- [x] optionals (`optional T`, `none`, optional lifting);
- [x] collections (`list of T`, `set of T`, `map of K to V`, typed literals, recursive composition and contextual empty-collection inference);
- [x] generics (function type parameters with argument/context inference);
- [x] interfaces / protocols (field and method contracts, `data` conformance, protocol-typed values, member/method access and protocol-constrained generics);
- [x] classes and encapsulation (nominal classes, public/private constructor fields, executable methods, protocol conformance, and enforced private-field access);
- [x] pattern matching (exhaustive matching over nominal choices and typed results with payload bindings);
- [x] error model (`result of T error E`, contextual `ok(...)`/`error(...)`, exhaustive result matching and typed payload bindings);
- [x] modules (app entrypoint + imported module files, recursive relative imports, cycle detection, deduplication and project-wide semantic composition);
- [x] package semantics (evermore.json identity/version/entry manifests, exact local dependencies, bare package/submodule imports, transitive graph validation and deterministic generated package graph);
- [x] type inference where unambiguous (literal/local inference, branch common types, contextual empty collections, bidirectional generic inference and compatible repeated generic evidence).

Research:

- [x] type system soundness notes backed by executable accepted/rejected counterexamples and generated-target checking;
- [x] effect inference ergonomics decision (no ambient effect inference in M2; explicit capabilities first when effects arrive);
- [x] nominal vs structural typing boundary decision (nominal domain types, explicit protocol conformance, recursive structural containers).

Exit condition:

> Evermore can express ordinary application domain logic without falling through to TypeScript.

---

## M3 — Full-stack semantics

**Status: complete ✅ — shared web/server contracts operational**

Goals:

- [x] server declarations;
- [x] typed endpoints;
- [x] shared request/response contracts;
- [x] Node.js target;
- [x] validation;
- [x] authentication abstractions (public/bearer boundary);
- [x] persistence interfaces;
- [x] PostgreSQL adapter;
- [x] background jobs;
- [x] realtime primitives.

Exit condition:

> One Evermore project can produce a typed web client and operational Node.js service without manually duplicating contracts.

---

## M4 — AI-native language runtime

**Status: complete ✅ — typed provider-neutral agent runtime operational**

Goals:

- [x] agent declarations;
- [x] typed inputs/outputs;
- [x] provider-neutral model requirements;
- [x] tools;
- [x] tool permissions;
- [x] structured output validation;
- [x] token budgets;
- [x] context declarations;
- [x] human approval;
- [x] tracing;
- [x] evaluation harness;
- [x] deterministic test doubles.

Research:

- [x] effect/capability typing for agents;
- [x] context optimization;
- [x] budget planning;
- [x] evaluation semantics;
- [x] prompt/code separation.

Exit condition:

> Agents can be implemented, tested and inspected without embedding critical behavior in unstructured prompt strings.

---

## M5 — Mobile

**Status: complete ✅ — shared mobile semantics operational**

Goals:

- [x] React Native backend;
- [x] common mobile runtime;
- [x] navigation;
- [x] native storage;
- [x] permissions;
- [x] network/offline model;
- [x] Swift/SwiftUI extension boundary;
- [x] Kotlin extension boundary;
- [x] Flutter backend experiment.

Exit condition:

> The same application semantics can produce useful iOS/Android builds while still allowing platform-native specialization.

---

## M6 — Data + scientific computing

Goals:

- typed Python boundary;
- dataframe/dataset primitives;
- reproducible pipeline metadata;
- numerical arrays;
- model train/evaluate contracts;
- experiment tracking interface;
- deterministic seeds and provenance.

Research:

- zero-copy/interprocess boundaries;
- numerical type representation;
- notebook interoperability vs source-first workflows.

Exit condition:

> A data workflow can use the Python ecosystem without becoming an opaque shell-command pipeline.

---

## M7 — Infrastructure

Goals:

- Docker packaging;
- health/readiness semantics;
- environment/secrets model;
- deployment IR;
- Kubernetes generation;
- policy checks;
- plan/apply separation;
- observability defaults;
- rollback metadata.

Research:

- portable infrastructure intent;
- safe defaults vs cloud specialization;
- static permission analysis.

Exit condition:

> Evermore can produce an inspectable deployment plan for a full-stack application and validate it before mutation.

---

## M8 — Tooling and ecosystem

Goals:

- Language Server Protocol;
- editor diagnostics;
- formatting;
- semantic highlighting;
- refactoring;
- package registry design;
- documentation generator;
- playground;
- Evermore Studio research prototype.

---

## M9 — Performance and native compilation research

Potential directions:

- WebAssembly;
- LLVM;
- native server runtime;
- incremental compilation;
- IR optimization;
- ahead-of-time specialization.

This milestone is intentionally late.

Evermore should prove its semantics and product value before building a custom low-level runtime.

---

# Evidence policy

A roadmap checkbox is complete only when supported by one or more of:

- tests;
- executable example;
- generated artifact;
- benchmark;
- specification;
- reproducible experiment.

Statements such as fast, secure, efficient or better require measurement and a declared comparison.

---

# Release philosophy

Expected early sequence:

~~~text
0.0.x  compiler experiments
0.1    first usable web vertical slice
0.2    core typed language
0.3    full-stack
0.4    AI-native runtime
0.5    mobile
~~~

Version numbers are provisional until compatibility policy is finalized.
