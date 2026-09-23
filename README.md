# EVERMORE

### Human-first. AI-native. Built to outlast frameworks.

[English](README.md) · [Español](README.es.md)

![Status](https://img.shields.io/badge/status-pre--alpha-111111)
![Compiler](https://img.shields.io/badge/compiler-TypeScript-111111?logo=typescript&logoColor=white)
![Language](https://img.shields.io/badge/language-Evermore-111111)
[![CI](https://github.com/armaabetancourtt/evermore/actions/workflows/ci.yml/badge.svg)](https://github.com/armaabetancourtt/evermore/actions/workflows/ci.yml)

> **Evermore is an experimental programming language and software-construction platform for building products, intelligence and infrastructure with dramatically less accidental complexity.**

Evermore explores a simple question:

> **What if building serious software felt closer to describing the product than operating the machinery behind it?**

The language is inspired by the clarity of **Swift**, the cross-platform product mindset of **Flutter**, and the approachability of **Python**—while being designed for a world where applications span web, mobile, servers, data, AI agents, native code and cloud infrastructure.

Evermore is currently **pre-alpha**. The repository is being built in public-facing, research-grade increments: language design first, executable compiler foundations second, then increasingly capable targets. Features described as **design targets** are intentionally distinguished from features already implemented.

---

## The thesis

Software engineering has accumulated enormous capability—and enormous incidental complexity.

A modern product may require TypeScript, a web framework, a mobile framework, backend code, schemas, authentication, Dockerfiles, CI configuration, Kubernetes manifests, cloud primitives, Python notebooks, AI SDKs, prompt plumbing, vector infrastructure and several different mental models before the product itself is visible.

Evermore does not assume that complexity is inevitable.

Its goal is to preserve **essential engineering power** while removing as much **accidental engineering friction** as possible.

~~~text
Human intent
    ↓
Evermore source
    ↓
Parser + semantic analysis
    ↓
Typed Evermore IR
    ↓
┌──────────┬─────────────┬──────────┬──────────┬──────────────┐
│ Web      │ Mobile      │ Server   │ Data/AI  │ Infrastructure│
│ Vue/Vite │ RN/Flutter  │ Node.js  │ Python   │ Docker / K8s │
│ TS       │ Swift/Kotlin│ TS       │ JVM      │ Cloud         │
└──────────┴─────────────┴──────────┴──────────┴──────────────┘
~~~

Frameworks are **targets**, not the language.

If a better mobile or web runtime appears in the future, Evermore should be able to gain a new backend without forcing applications to abandon the language.

---

## Design target: software in human terms

The long-term syntax is intended to be readable before it is impressive.

~~~evermore
app "Atlas"

data Note
  title text
  body text
  owner User private

screen Home

  title "Your ideas"

  show notes

  button "New note"
    opens NewNote

agent Summarizer

  goal
    summarize a note without changing its meaning

  can
    read Note

  cannot
    delete Note
    publish Note

  output Summary

  budget
    4000 tokens
    prefer low latency

workflow NightlyInsights

  every day at 21:00

  find today's notes
  summarize them with Summarizer
  save the result

production

  web
    edge cache

  server
    autoscale from 2 to 10

  database postgres
    backup daily
~~~

This is a **design target**, not a claim that every construct above is implemented today.

The language should begin simple, but it must not end simple.

---

## Progressive power

Evermore is designed around progressive disclosure.

### Natural mode

The default should read close to product intent:

~~~evermore
button "Continue"
  opens Dashboard
~~~

### Explicit mode

The implemented subset can express the same semantics with explicit delimiters:

~~~evermore
screen Home {
  button "Continue" {
    opens Dashboard
  }
}
~~~

Both forms should lower into the same semantic representation.

Indentation is for readability. **Indentation is not intended to determine program meaning.**

---

# Eight pillars

### 01 — Human-first language

The first abstraction is the developer's intent, not a framework API.

Common work should be obvious. Advanced work should remain possible.

### 02 — AI-native programming

AI is not planned as a bolt-on SDK. Agents, tools, context, budgets, approvals, structured outputs and model capabilities are intended to become typed language concepts.

~~~evermore
agent Researcher

  accepts ResearchQuestion
  returns ResearchReport

  can
    search web
    read project files
    use python

  requires approval to
    send email

  context
    budget 24000 tokens
    summarize overflow
~~~

### 03 — Obsessive product and design defaults

Evermore aims for calm, coherent, accessible interfaces by default.

The design philosophy is influenced by Apple's emphasis on clarity, hierarchy, consistency, motion with purpose, accessibility and excellent defaults—not by visual imitation.

A button should not require dozens of properties before it is usable, responsive and accessible.

### 04 — One language across the product

The same source model should be able to describe:

- web interfaces;
- mobile interfaces;
- APIs and server behavior;
- domain models;
- workflows;
- agents;
- data pipelines;
- infrastructure intent.

### 05 — Data science without an ecosystem wall

Python remains one of the strongest ecosystems for scientific computing and machine learning. Evermore intends to interoperate with it rather than replace it.

~~~evermore
dataset Housing from "housing.csv"

predict price from
  area
  bedrooms
  neighborhood

using python sklearn

validate with time split
show error distribution
~~~

Advanced users should still be able to cross the boundary into Python directly.

### 06 — Infrastructure as product intent

Deployment should not require learning five configuration languages before an application can be operated responsibly.

~~~evermore
production

  server
    replicas 3
    health "/health"
    autoscale to 20

  database postgres
    encrypted
    backup daily

  cache redis
~~~

Evermore may lower infrastructure intent into Docker, Kubernetes and cloud-specific configuration while keeping generated artifacts inspectable.

### 07 — Interoperability over isolation

A new language should not discard the software world that already exists.

Planned interop boundaries include:

- TypeScript / JavaScript
- Python
- Swift / SwiftUI
- Kotlin
- Java / JVM
- Dart / Flutter
- Rust and WebAssembly where appropriate

### 08 — Security by construction

Security-sensitive information should be represented semantically.

~~~evermore
data User
  email email
  password secret
~~~

A value typed as **secret** should not be casually printable, serializable or returned by an API. The compiler and runtime should participate in preventing unsafe data flow instead of relying only on developer discipline.

---

# AI as a language primitive

Most AI applications currently represent important behavior as strings plus SDK calls.

Evermore's research direction is different.

An agent can be modeled as a typed computation:

~~~text
Agent<I, O, T, C, B>
~~~

where:

- **I** = input type
- **O** = output type
- **T** = available tools
- **C** = capability / permission set
- **B** = resource budget

A budget may include tokens, latency, monetary cost or execution time.

This makes it possible for the compiler, runtime and tooling to reason about AI behavior before execution.

### Typed structured output

~~~evermore
structure RiskAssessment
  score percent
  reasons list of text
  confidence percent

agent RiskAnalyst
  accepts Transaction
  returns RiskAssessment
~~~

The output contract is a type, not a suggestion hidden inside a prompt.

### Human approval

~~~evermore
agent Support

  can
    read tickets
    draft responses

  requires approval to
    issue refund
    send response
~~~

Human oversight becomes part of the program.

### Context and tokenization

~~~evermore
context CustomerContext

  include
    current conversation
    customer profile
    last 5 orders

  budget 12000 tokens
  prioritize recent conversation
  summarize overflow
~~~

Context construction should be explicit, inspectable and testable.

---

# Formal foundation

Approachability must not come at the cost of semantic rigor.

Evermore's type-and-effect research is organized around judgments of the form:

~~~text
Γ ; C ⊢ e : τ ! ε
~~~

Interpretation:

- **Γ** — typing environment
- **C** — capabilities available to the computation
- **e** — expression
- **τ** — resulting type
- **ε** — observable effect set

A pure transformation could have:

~~~text
ε = ∅
~~~

while another computation may have:

~~~text
ε = { network, ai, database.write }
~~~

This allows tooling to answer questions such as:

- Can this function access the network?
- Can this agent transmit sensitive information?
- Can this workflow mutate production data?
- Can this mobile capability run offline?
- Is this function deterministic?
- Which actions require human approval?

## Information-flow direction

Evermore also explores a security lattice:

~~~text
public ⊑ internal ⊑ sensitive ⊑ secret
~~~

Data should not implicitly flow from a stronger confidentiality level to a weaker one.

## AI resource model

AI execution introduces another optimization surface. A future planner may minimize an objective such as:

~~~text
J = λ₁·latency + λ₂·cost + λ₃·token_usage + λ₄·energy
~~~

subject to semantic, quality and security constraints.

The purpose is not mathematical decoration. It provides a framework for making model routing, context construction and deployment decisions explicit and measurable.

---

# Compiler architecture

Evermore is designed around a stable semantic core rather than direct source-to-framework translation.

~~~text
.ever source
    ↓
lexer
    ↓
parser
    ↓
AST
    ↓
desugaring
    ↓
name resolution
    ↓
type + effect + capability analysis
    ↓
HIR
    ↓
Evermore IR
    ↓
optimization / planning
    ↓
target backends
~~~

### Why an IR matters

Without an intermediate representation:

~~~text
Evermore → React Native
~~~

Evermore becomes a syntax wrapper around React Native.

With a stable IR:

~~~text
                 ┌→ Vue + Vite
Evermore → IR ───┼→ React Native
                 ├→ Flutter
                 ├→ Swift / SwiftUI
                 ├→ Kotlin
                 ├→ Node.js
                 ├→ Python / JVM interop
                 └→ infrastructure planners
~~~

The language can survive changes in frameworks.

---

# Target architecture

| Domain | Primary direction | Native / alternate direction |
|---|---|---|
| Web | TypeScript + Vue 3 + Vite | future additional web backend |
| Mobile | React Native + TypeScript | Flutter + Dart |
| iOS | React Native common layer | Swift + SwiftUI extensions |
| Android | React Native common layer | Kotlin extensions |
| Server | Node.js + TypeScript | future native/WASM runtimes |
| Data science | Python interoperability | native numerical work where justified |
| JVM | Java interoperability | future JVM backend |
| Infrastructure | Docker + Kubernetes planning | cloud adapters |
| AI | provider-neutral agent runtime | local / hosted model adapters |

---

# Native extensions

Evermore should provide escape hatches instead of trapping advanced developers inside its abstractions.

~~~evermore
capability health

  ios uses HealthKit with Swift
  android uses HealthConnect with Kotlin
~~~

The application can then depend on the capability rather than duplicating platform intent.

The same principle applies to Python models, Java libraries and future native runtimes.

---

# Design system

Evermore UI should optimize for coherence before customization.

Design targets include:

- semantic typography;
- spacing based on a consistent scale;
- accessible contrast;
- platform-appropriate touch targets;
- keyboard and assistive-technology support;
- dark mode;
- motion with reduced-motion behavior;
- responsive layout;
- native platform conventions where they improve usability.

~~~evermore
design
  quiet
  spacious
  precise

motion
  subtle
  purposeful

accessibility
  strict
~~~

Advanced styling remains possible, but beautiful and usable should be the default rather than a reward for configuring everything manually.

---

# Current implementation

Evermore's current research roadmap, **M0 through M9**, is implemented with executable evidence. The project remains pre-alpha: milestone completion means the planned semantics, targets and research prototypes exist and are tested; it does not mean production stability.

Implemented today:

- natural and explicit syntax with equivalent semantics;
- indentation-independent parsing;
- canonical formatter with natural/explicit output;
- title, text and buttons;
- navigation between screens;
- reactive integer state with `state`, `show` and `increases`;
- nested vertical and horizontal stacks;
- reusable stateless components with `component` and `use`;
- semantic checks for screens, state, components and component cycles;
- parser multi-error recovery;
- framework-neutral Evermore IR;
- complete Vue 3 + Vite application generation;
- accessibility defaults including visible focus, reduced-motion behavior, touch sizing and polite live state output;
- generated-target builds in CI, including a three-screen M1 showcase;
- nominal `data` declarations with primitive and user-defined types;
- pure typed functions with parameters, declared returns, inferred local `let`, arithmetic precedence and typed calls;
- strict TypeScript generation for models and functions, validated by `vue-tsc`;
- typed full-stack semantics with a generated Node.js server runtime;
- provider-neutral AI agents, tools, context/budget controls, approval boundaries and deterministic evaluations;
- shared mobile semantics with React Native generation, Swift/Kotlin native boundaries and a Flutter experiment;
- typed datasets, arrays, Python bridges and reproducible scientific pipelines;
- inspectable Docker/Kubernetes deployment planning with health/readiness, external secrets, rollback metadata and guarded apply;
- compiler-backed LSP/editor tooling, documentation generation, registry design and Playground/Studio research prototypes;
- conservative IR optimization, instrumented incremental compilation and executable WebAssembly research for pure numeric functions.

A complete executable example now looks like:

~~~evermore
app "Evermore Showcase"

component Navigation

  stack horizontal

    button "Home"
      opens Home

    button "Counter"
      opens Counter

  end

end

screen Home

  title "Build software like you think."

  text "Human-first syntax. Typed semantics. Framework-independent intent."

  use Navigation

screen Counter

  title "State without ceremony"

  state count starts 0

  stack horizontal

    show count

    button "Add"
      increases count

  end

  use Navigation
~~~

The compiler pipeline exercised by CI is:

~~~text
Evermore source
   ↓
lexer
   ↓
parser
   ↓
AST
   ↓
semantic analysis
   ↓
Evermore IR
   ↓
Vue/Vite backend
   ↓
npm install + production target build
~~~

CI now exercises the implemented web, server, AI, mobile, data, infrastructure, tooling and WebAssembly-research surfaces. These remain pre-alpha capabilities and are not a production-readiness claim.

See [examples/showcase.ever](examples/showcase.ever) and [docs/ROADMAP.md](docs/ROADMAP.md).

---

# Engineering principles

**Effortless is an engineering constraint, not a slogan.**

Evermore follows these principles:

1. **Zero-config first success.**
2. **Convention before configuration.**
3. **One semantic source of truth.**
4. **Progressive disclosure of complexity.**
5. **Human-readable diagnostics.**
6. **Secure defaults.**
7. **Beautiful defaults.**
8. **Native escape hatches.**
9. **AI assists; semantics decide.**
10. **Generated artifacts remain inspectable.**
11. **No benchmark claims without reproducible evidence.**
12. **No AI capability claims without executable tests.**

---

# Research questions

Evermore is also a programming-languages research project.

Questions worth testing include:

- Can natural-looking syntax remain deterministic and formally analyzable?
- Can effect and capability systems make AI agents safer without making the language intimidating?
- Can one semantic product model target multiple UI runtimes without collapsing to the lowest common denominator?
- Can infrastructure intent be compiled while keeping operational decisions understandable?
- Can AI context budgets become first-class resource constraints?
- Can secure information-flow defaults remain ergonomic for beginners?
- Can generated code remain debuggable enough for professional teams?
- How much framework-specific optimization can be preserved behind a portable IR?

Answers should come from prototypes, benchmarks, user studies and reproducible experiments—not branding.

---

# Repository direction

~~~text
evermore/
├── src/                    # compiler foundation
├── tests/                  # executable language tests
├── examples/               # small programs
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FORMAL_MODEL.md
│   ├── LANGUAGE_DESIGN.md
│   └── ROADMAP.md
└── .github/workflows/      # continuous integration
~~~

As the implementation grows, compiler stages and target backends will be split into dedicated packages.

---

# Roadmap

### M0 — Foundation
Language principles, bilingual documentation, grammar experiments, lexer, parser, diagnostics and AST.

### M1 — Human syntax + web vertical slice
Natural/explicit syntax, state, nested layout, reusable components, accessible defaults and a Vue/Vite target that builds in CI.

### M2 — Type system
Data declarations, functions, collections, optionals, generics, interfaces, classes and effect tracking.

### M3 — Full-stack semantics
Typed server actions, shared contracts, Node.js target and persistence abstractions.

### M4 — AI-native runtime
Typed agents, tools, structured outputs, budgets, context, approval boundaries and observable execution.

### M5 — Mobile
React Native target, native Swift/Kotlin capability extensions and Flutter backend experiments.

### M6 — Data
Python bridge, datasets, reproducible pipelines, numerical semantics and model evaluation primitives.

### M7 — Infrastructure
Docker packaging, deployment planning, Kubernetes generation, health, observability and secrets.

### M8 — Tooling and ecosystem
Language Server Protocol, diagnostics, formatting, semantic tokens, rename refactoring, documentation generation, registry design and Playground/Studio research prototypes.

### M9 — Performance and native compilation research
IR optimization, incremental compilation evidence, executable WebAssembly specialization and explicit LLVM/native-runtime research decisions.

---

# What Evermore is not

Evermore is not intended to be:

- English text sent to an LLM and executed blindly;
- a no-code system disguised as a language;
- a replacement for every existing ecosystem;
- a framework-specific DSL;
- an excuse to hide unsafe infrastructure decisions;
- a repository full of architecture diagrams with no executable compiler.

The ambition is high. The implementation standard should be higher.

---

## Name

**Evermore** reflects the core architectural goal:

> Applications should outlive today's frameworks.

The source should describe enduring product and system intent. Targets can evolve beneath it.

---

## Status

**Experimental · Pre-alpha · roadmap M0–M9 complete with executable evidence**

Do not use Evermore for production systems yet.

The project currently prioritizes correctness, semantics, research quality and executable evidence over feature count.

---

<div align="center">

### Build software the way you think.

**Effortless to begin. Powerful enough to grow. Designed to endure.**

</div>
