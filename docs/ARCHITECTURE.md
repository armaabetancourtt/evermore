
# Evermore Architecture

## Architectural thesis

Evermore is not a template generator.

The compiler is organized so that language semantics remain independent from Vue, React Native, Flutter, Node.js, Python, Swift, Kotlin or any other target technology.

~~~text
source
  ↓
lexer
  ↓
parser
  ↓
AST
  ↓
desugaring
  ↓
semantic analysis
  ↓
HIR
  ↓
Evermore IR
  ↓
planner / optimization
  ↓
target backends
~~~

---

## 1. Front end

### Lexer

Responsibilities:

- source positions;
- identifiers;
- keywords;
- literals;
- delimiters;
- trivia handling;
- lexical diagnostics.

The lexer must never infer product intent using AI.

### Parser

Responsibilities:

- deterministic grammar;
- syntax tree construction;
- recovery strategy;
- useful local errors.

### AST

The AST represents source structure.

It should retain source spans so every later diagnostic can point back to human-authored code.

---

## 2. Semantic analysis

The semantic layer will ultimately own:

- name resolution;
- type checking;
- generic constraints;
- effect inference;
- capability checks;
- information-flow checks;
- exhaustive matching;
- target-independent validation.

A target backend should never decide whether a program is semantically valid.

---

## 3. HIR

A future High-Level IR will remove surface-syntax differences.

For example, natural and explicit forms:

~~~evermore
button "Continue"
  opens Home
~~~

and:

~~~evermore
button "Continue" {
  opens Home
}
~~~

should become identical HIR.

This lets syntax evolve without destabilizing backends.

---

## 4. Evermore IR

The stable IR represents product/system semantics rather than framework syntax.

Example conceptual form:

~~~json
{
  "kind": "screen",
  "id": "Home",
  "children": [
    {
      "kind": "button",
      "label": "Continue",
      "action": {
        "kind": "navigate",
        "target": "Dashboard"
      }
    }
  ]
}
~~~

Future IR families may include:

- UI IR;
- domain/data IR;
- server IR;
- agent/workflow IR;
- infrastructure IR.

They can share a common symbol/type/effect model.

---

## 5. Target backends

### Web

Primary research target:

~~~text
Evermore IR
→ TypeScript
→ Vue 3
→ Vite
~~~

The current proof-of-concept generator emits Vue-oriented screen artifacts.

### Mobile

Planned:

~~~text
             ┌→ React Native + TypeScript
Evermore IR ─┼→ Flutter + Dart
             ├→ Swift / SwiftUI extension
             └→ Kotlin extension
~~~

React Native and Flutter are both targets.

Neither defines Evermore semantics.

### Server

Planned primary target:

~~~text
Evermore server IR
→ TypeScript
→ Node.js
~~~

Server semantics should share generated contracts with clients.

### Data

Planned Python interop:

~~~text
Evermore
↔ typed Python boundary
↔ NumPy / pandas / scikit-learn / scientific ecosystem
~~~

### JVM

Java is initially an interoperability target.

A full JVM backend remains a later research direction.

---

## 6. Runtime architecture

Some abstractions belong in generated code; others belong in reusable runtimes.

Potential runtime packages:

~~~text
@evermore/core
@evermore/web
@evermore/mobile
@evermore/server
@evermore/ai
@evermore/data
~~~

The compiler should prefer static generation when practical and runtime support when behavior genuinely requires it.

Avoid turning Evermore into a massive opaque runtime.

---

## 7. Native boundary

Native integrations should be explicit capabilities.

Example:

~~~text
Evermore Health capability
        ↓
   target adapter
   ↙          ↘
Swift         Kotlin
HealthKit     Health Connect
~~~

Generated bridges should remain inspectable.

---

## 8. Infrastructure planner

Infrastructure is not ordinary UI code generation.

A future deployment pipeline:

~~~text
deployment intent
      ↓
validated infra IR
      ↓
policy checks
      ↓
deployment plan
      ↓
Docker / Kubernetes / cloud adapters
~~~

Important design rule:

**Evermore should generate a plan before mutating infrastructure.**

Infrastructure actions must be observable, reviewable and permission-aware.

---

## 9. AI runtime

AI execution requires:

- provider adapters;
- model capability registry;
- tool registry;
- structured-output validation;
- context planner;
- token accounting;
- retries;
- tracing;
- human approval gates;
- evaluation hooks.

Provider-specific APIs should live behind adapters.

The language describes requirements and permissions.

The runtime chooses an allowed implementation.

---

## 10. Compiler quality strategy

Evermore should be tested at several layers:

- lexer tests;
- parser snapshots / structural tests;
- semantic diagnostics;
- IR invariants;
- codegen golden tests;
- target compile tests;
- end-to-end generated application tests;
- fuzzing;
- performance benchmarks.

No backend is considered supported merely because code can be emitted.

It becomes supported when generated artifacts compile and pass conformance tests.

---

## 11. Reproducibility

Every generated artifact should be traceable to:

- compiler version;
- source version;
- target backend version;
- configuration;
- IR schema version.

Generated manifests should eventually carry this provenance.

---

## 12. Repository evolution

The current single-package layout is deliberately small.

Expected future workspace:

~~~text
packages/
  lexer/
  parser/
  semantics/
  ir/
  diagnostics/
  compiler/
  target-vue/
  target-react-native/
  target-flutter/
  target-node/
  runtime-core/
  runtime-ai/
  interop-python/
  language-server/
~~~

The split should happen when module boundaries become real, not preemptively.
