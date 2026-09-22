# RFC 0000 — Title

- **Status:** Draft
- **Authors:** 
- **Created:** YYYY-MM-DD
- **Target milestone:** 
- **Discussion:** 

## Summary

Describe the proposal in one or two paragraphs.

## Motivation

What developer or system problem does this solve?

Why should the solution belong in the language/runtime instead of documentation, a library or a target-specific adapter?

## Goals

- Goal 1
- Goal 2

## Non-goals

- Non-goal 1
- Non-goal 2

## Examples

Show the smallest useful source examples.

~~~evermore
// example
~~~

Include both beginner-facing and advanced-facing forms if progressive disclosure is relevant.

## Grammar

Document grammar additions or changes.

~~~text
rule ::= ...
~~~

## Semantic model

Describe meaning independently from syntax.

If relevant, provide typing/effect/capability judgments.

~~~text
Γ ; C ⊢ e : τ ! ε
~~~

## AST / HIR / IR impact

Describe how the proposal is represented after parsing and lowering.

## Diagnostics

Show expected diagnostics for common invalid programs.

## Security and privacy

Discuss:

- permissions;
- capabilities;
- secret handling;
- information flow;
- external systems;
- AI/tool boundaries.

## Performance and resource model

Discuss runtime, compile-time, memory, token, cost or network impact when relevant.

Do not claim improvements without a benchmark plan.

## Target behavior

How should Web, Mobile, Server, Data and Infrastructure targets interpret the feature?

Which differences are intentional?

## Interoperability

How does the proposal interact with Python, JavaScript/TypeScript, Swift, Kotlin, Java, Dart or other foreign systems?

## Alternatives considered

Document credible alternatives and why they were not selected.

## Compatibility

Could this break existing source, IR or generated artifacts?

How would migration work?

## Test plan

Define executable evidence required before the RFC can be considered implemented.

## Open questions

List unresolved design decisions.

## Decision

Filled after review.

Explain not only what was chosen, but the trade-offs accepted.
