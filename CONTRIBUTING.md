<p align="center"><img src="brand/evermore-banner.svg" alt="Evermore official botanical wordmark" width="680" /></p>

# Contributing to Evermore

Evermore is an experimental programming-language project and proprietary technology wholly owned by **Armando Betancourt**.

Discussion, issues, research feedback and proposals are welcome. **External code contributions require prior written approval and appropriate contributor/IP terms before they can be accepted.** Opening a pull request does not grant a license to Evermore and does not, by itself, transfer a contributor's copyright or other IP rights. Do not submit third-party or employer-owned code unless you have authority to do so.

Language changes require a higher standard than ordinary application changes because syntax and semantics create long-lived compatibility obligations.

For commercial licensing questions, contact **contacto@kaisei.com.mx**.

## Principles

Before proposing a change, keep these constraints in mind:

1. **Human-first does not mean ambiguous.**
2. **AI assistance does not replace deterministic semantics.**
3. **Frameworks are targets, not language semantics.**
4. **New syntax must justify its cognitive cost.**
5. **Security-sensitive behavior should become analyzable where practical.**
6. **Claims require executable evidence.**
7. **Generated artifacts must remain inspectable.**

## Development

Requirements:

- Node.js 22+
- npm

Install:

~~~bash
npm install
~~~

Type check:

~~~bash
npm run check
~~~

Test:

~~~bash
npm test
~~~

Build:

~~~bash
npm run build
~~~

Validate the example language program:

~~~bash
npm run evermore -- check examples/hello.ever
~~~

Generate the current Vue-oriented target:

~~~bash
npm run evermore -- build examples/hello.ever --out evermore-build
~~~

## Change categories

### Compiler implementation

Lexer, parser, AST, semantic analysis, IR, diagnostics and code generation should include tests that fail before the change and pass afterward.

### Language syntax

Syntax changes should include:

- motivation;
- alternatives considered;
- grammar impact;
- AST/HIR impact;
- interaction with existing syntax;
- at least three representative examples;
- diagnostic behavior;
- compatibility considerations.

Substantial syntax changes should begin as an RFC.

### Type system / effects / capabilities

Changes should document the typing or semantic rule being introduced.

Where useful, use judgments or inference rules rather than only prose.

### Target backend

A backend is not considered supported merely because it emits files.

Evidence should eventually include:

- generated artifacts;
- target compilation;
- runtime behavior tests;
- semantic conformance cases;
- version/provenance metadata.

### AI runtime

AI features require explicit consideration of:

- typed inputs and outputs;
- model/provider independence;
- tool permissions;
- context construction;
- token/cost budgets;
- human approval boundaries;
- traceability;
- deterministic test doubles.

## RFC process

Use the template at:

~~~text
docs/rfcs/0000-template.md
~~~

An RFC is appropriate when a proposal changes:

- surface syntax;
- type semantics;
- effect semantics;
- capability semantics;
- information-flow rules;
- IR compatibility;
- package/module behavior;
- backend guarantees;
- runtime contracts.

RFCs should optimize for durable decisions, not volume.

## Tests

Prefer small semantic tests over broad snapshots when possible.

Important categories:

- source position accuracy;
- lexer edge cases;
- parser behavior;
- diagnostics;
- symbol resolution;
- invalid navigation / references;
- IR invariants;
- code generation;
- security rules;
- target conformance.

Future milestones will add fuzzing and property-based tests.

## Commit style

Prefer scoped, descriptive commits:

~~~text
feat(parser): support ...
fix(semantic): reject ...
refactor(ir): separate ...
test(codegen): cover ...
docs(rfc): propose ...
~~~

## Evidence before claims

Do not describe a feature as supported until it is executable and tested.

Preferred wording:

~~~text
planned
research direction
prototype
experimental
implemented
validated
~~~

These words should mean different things.

## Design standard

Evermore aims for a calm, precise developer experience.

That standard applies to:

- APIs;
- diagnostics;
- docs;
- CLI output;
- generated code;
- naming;
- examples.

A feature that is powerful but difficult to explain is not finished.
