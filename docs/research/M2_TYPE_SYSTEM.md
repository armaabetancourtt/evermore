# M2 Type-System Closure

## Purpose

This note closes the remaining M2 type-system research questions with an intentionally narrow engineering claim.

It is **not a formal proof of type soundness**. Evermore does not yet have a mechanized metatheory. The evidence here is executable compiler behavior, generated-target checking, and explicit design boundaries.

Reproduce the counterexample corpus with:

~~~bash
npm run research:m2
~~~

CI runs the same command.

## 1. Type-system soundness — engineering evidence

For M2, the required safety property is:

> Programs that cross a declared Evermore type boundary must either satisfy that boundary or be rejected before target generation.

The executable corpus includes accepted programs plus counterexamples that must fail with stable diagnostics. It covers:

- nominal data identity;
- explicit protocol conformance;
- private class-state isolation;
- typed Result payloads;
- homogeneous collection element constraints;
- repeated generic-parameter consistency;
- bidirectional generic inference from expected result context.

Generated Vue/TypeScript targets are also type-checked and built in CI, providing a second boundary after Evermore semantic analysis.

This establishes regression evidence for the implemented M2 surface. It does not claim progress/preservation theorems for every possible future language extension.

## 2. Effect inference ergonomics — decision

M2 does **not** add an inferred effect system.

The reason is semantic rather than cosmetic: executable M2 function bodies currently contain pure expressions, immutable locals, lexically local mutable storage, construction, matching and calls to other M2 functions. They do not expose ambient filesystem, network, persistence, process, UI mutation or agent/tool effects through the core function language.

Local `var` / `set` is treated as implementation-local state, not as an externally observable capability in a function signature.

Decision for later milestones:

1. new externally observable effects must first enter the language through explicit capabilities/contracts;
2. effect inference may later reduce annotation ceremony;
3. inference must never silently grant capabilities or widen permissions.

This keeps the M2 type surface honest while leaving room for M3 server effects and M4 agent/tool permissions.

## 3. Nominal vs structural typing boundary — decision

Evermore M2 uses the following boundary:

- primitive types are intrinsic;
- `data`, `class`, and `choice` identities are **nominal**;
- collections, optionals and results are recursively typed containers;
- protocols are named contracts with **explicit declared conformance**;
- matching field shape alone does not imply protocol conformance;
- protocol-constrained generics accept only values whose nominal type explicitly conforms to the named protocol.

This rejects accidental substitutability between same-shaped domain types while preserving reusable behavior through declared protocols.

The research corpus proves the intended boundary with two paired cases:

- same-shaped nominal types are not interchangeable;
- a same-shaped value does not satisfy a protocol until its declaration explicitly says `conforms Protocol`.

## 4. Type inference boundary — completion decision

M2 inference is intentionally bidirectional where context is unambiguous.

Implemented sources of evidence include:

- literal inference;
- local `let` / `var` initializer inference;
- homogeneous list/set inference;
- map key/value inference;
- optional lifting through `none`;
- branch common-type inference;
- contextual empty list/set/map inference;
- generic inference from arguments;
- generic inference from expected result types;
- expected result context propagated back into generic arguments;
- compatible repeated generic evidence unified through the same common-type rules.

Ambiguous programs remain errors. For example, an unconstrained local `let values = []` still has no principled element type and is rejected rather than guessed.

## M2 closure criterion

With the above boundaries, M2 can express ordinary typed domain logic using values, functions, nominal models, protocols, methods, classes, collections, results, modules and packages without falling through to handwritten TypeScript.

Future additions such as payload-carrying general choices, generic nominal types, richer standard-library collections, inheritance, effect capabilities and server/agent operations are extensions beyond the M2 core rather than hidden requirements for this milestone.
