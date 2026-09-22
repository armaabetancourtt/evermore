
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

Goals:

- natural syntax without semantic indentation;
- canonical formatter;
- text, buttons, stacks and layout;
- state;
- navigation;
- reusable components;
- first Vue/Vite application shell;
- accessibility defaults;
- [x] generated target compile tests.

Research:

- natural syntax ambiguity;
- source readability study;
- AST equivalence between natural and explicit modes.

Exit condition:

> A non-trivial two-to-five-screen web application can be written primarily in Evermore and run through Vite.

---

## M2 — Core language

Goals:

- variables and constants;
- expressions;
- functions;
- structures;
- enums / algebraic choices;
- optionals;
- collections;
- generics;
- interfaces;
- classes and encapsulation;
- pattern matching;
- error model;
- modules;
- package semantics;
- type inference where unambiguous.

Research:

- type system soundness;
- effect inference ergonomics;
- nominal vs structural typing boundaries.

Exit condition:

> Evermore can express ordinary application domain logic without falling through to TypeScript.

---

## M3 — Full-stack semantics

Goals:

- server declarations;
- typed endpoints;
- shared request/response contracts;
- Node.js target;
- validation;
- authentication abstractions;
- persistence interfaces;
- PostgreSQL adapter;
- background jobs;
- realtime primitives.

Exit condition:

> One Evermore project can produce a typed web client and operational Node.js service without manually duplicating contracts.

---

## M4 — AI-native language runtime

Goals:

- agent declarations;
- typed inputs/outputs;
- provider-neutral model requirements;
- tools;
- tool permissions;
- structured output validation;
- token budgets;
- context declarations;
- human approval;
- tracing;
- evaluation harness;
- deterministic test doubles.

Research:

- effect/capability typing for agents;
- context optimization;
- budget planning;
- evaluation semantics;
- prompt/code separation.

Exit condition:

> Agents can be implemented, tested and inspected without embedding critical behavior in unstructured prompt strings.

---

## M5 — Mobile

Goals:

- React Native backend;
- common mobile runtime;
- navigation;
- native storage;
- permissions;
- network/offline model;
- Swift/SwiftUI extension boundary;
- Kotlin extension boundary;
- Flutter backend experiment.

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
