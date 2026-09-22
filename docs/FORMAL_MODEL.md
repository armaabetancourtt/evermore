
# Evermore Formal Model

## Status

**Research draft 0.1**

This document establishes the mathematical direction for Evermore's semantic model. It is not yet a complete proof system or formal specification.

---

## 1. Why formalism matters

Evermore intentionally makes high-level programming easier.

That increases the responsibility of the compiler.

If source code hides operational machinery, the compiler must be unusually clear about:

- types;
- side effects;
- permissions;
- information flow;
- resource consumption;
- generated behavior.

Formalism is therefore a usability feature.

---

## 2. Core typing judgment

We model expression typing with:

~~~text
Γ ; C ⊢ e : τ ! ε
~~~

where:

- **Γ** is the typing environment;
- **C** is the available capability set;
- **e** is an expression;
- **τ** is its type;
- **ε** is its effect set.

A pure expression:

~~~text
Γ ; C ⊢ 1 + 2 : Int ! ∅
~~~

A network computation:

~~~text
Γ ; {Network} ⊢ fetch(url) : Response ! {network}
~~~

The language should make pure code easy while keeping effects visible to tooling.

---

## 3. Effect algebra

Let effects be members of a finite set:

~~~text
E = {
  network,
  filesystem.read,
  filesystem.write,
  database.read,
  database.write,
  ai.infer,
  process.spawn,
  native,
  infrastructure.mutate
}
~~~

Composition uses set union:

~~~text
ε(program) = ε₁ ∪ ε₂ ∪ ... ∪ εₙ
~~~

A caller inherits the observable effects of callees unless an effect boundary explicitly transforms or contains them.

This gives static tooling a basis for queries such as:

~~~text
effects(checkout)
→ {network, database.read, database.write, payments}
~~~

---

## 4. Capabilities

Effects describe **what happens**.

Capabilities describe **what is allowed**.

Let:

~~~text
C ⊆ Capabilities
~~~

A rule for an operation requiring capability c:

~~~text
Γ ; C ⊢ e : τ ! ε     c ∈ C
────────────────────────────
Γ ; C ⊢ op_c(e) : τ' ! (ε ∪ {effect_c})
~~~

If the capability is absent, compilation or deployment planning must reject the operation.

This model can unify:

- camera permission;
- location permission;
- filesystem access;
- cloud mutation;
- AI tool access;
- administrative actions.

---

## 5. Confidentiality lattice

Evermore explores a confidentiality lattice:

~~~text
Public ⊑ Internal ⊑ Sensitive ⊑ Secret
~~~

Let label(x) denote the confidentiality class of x.

A basic noninterference-oriented constraint is:

~~~text
label(source) ⊑ label(destination)
~~~

unless an explicit trusted declassification operation exists.

Thus:

~~~text
Secret → Public
~~~

is rejected by default.

This is useful for catching accidental flows to:

- logs;
- UI;
- API responses;
- analytics;
- external AI providers.

---

## 6. Structured AI computation

An AI agent can be represented abstractly as:

~~~text
Agent<I, O, T, C, B>
~~~

where:

- **I** is the input type;
- **O** is the output type;
- **T** is the tool set;
- **C** is its capability set;
- **B** is a resource budget.

An invocation:

~~~text
run : Agent<I,O,T,C,B> × I → O
~~~

is effectful:

~~~text
ε(run) ⊇ {ai.infer}
~~~

and may additionally contain tool effects.

This means AI execution is never modeled as pure merely because it appears behind a function call.

---

## 7. Resource budgets

For an AI execution plan p, define a resource vector:

~~~text
R(p) = (
  tokens_in,
  tokens_out,
  latency,
  monetary_cost,
  memory,
  energy_estimate
)
~~~

A policy may impose upper bounds:

~~~text
R_i(p) ≤ B_i
~~~

Optimization can then choose among valid plans.

A simple scalar objective:

~~~text
J(p) =
  λ₁ L(p)
+ λ₂ C(p)
+ λ₃ T(p)
+ λ₄ E(p)
~~~

where:

- L = latency;
- C = monetary cost;
- T = token use;
- E = estimated energy.

The coefficients λ express deployment priorities.

The compiler should not pretend that one universal optimum exists.

---

## 8. Context selection

Suppose a context contains items:

~~~text
x₁, x₂, ... xₙ
~~~

with token cost tᵢ and utility uᵢ.

A simplified context-selection problem is:

~~~text
maximize   Σ uᵢ zᵢ
subject to Σ tᵢ zᵢ ≤ B
           zᵢ ∈ {0,1}
~~~

This resembles a constrained selection problem.

Real context systems also include:

- semantic dependency;
- ordering;
- privacy;
- freshness;
- compression quality;
- mandatory system instructions.

The mathematical model is useful because token budgeting becomes a planning problem rather than string concatenation.

---

## 9. Target lowering

Let S denote Evermore's semantic program and T a target.

A lowering function:

~~~text
L_T : S → A_T
~~~

produces target artifact A_T.

Correctness requires preservation of observable semantics for the subset supported by T.

Informally:

~~~text
observe(S) ≈ observe(L_T(S))
~~~

Platform-specific capabilities may intentionally refine behavior while preserving declared product intent.

---

## 10. IR invariants

The Evermore IR should satisfy invariants before code generation.

Examples:

1. all referenced symbols resolve;
2. type constraints hold;
3. required capabilities are declared;
4. prohibited information flows are absent;
5. effect metadata is complete;
6. target-required semantics are representable;
7. IDs are stable within a compilation unit.

Backends should consume validated IR rather than reimplement semantic analysis.

---

## 11. Determinism

Compilation should be deterministic:

~~~text
compile(source, config, compiler_version)
→ identical semantic artifacts
~~~

excluding explicitly identified non-semantic metadata.

AI may assist authoring, but **AI is not part of ordinary deterministic compilation**.

An AI authoring tool produces Evermore source or typed IR proposals that are subsequently validated by the compiler.

---

## 12. Verification roadmap

Formal confidence should grow in stages:

### Stage A
Executable unit and property tests.

### Stage B
Grammar fuzzing and parser differential tests.

### Stage C
Type/effect soundness arguments for the core calculus.

### Stage D
Information-flow property testing.

### Stage E
Backend semantic conformance suites.

### Stage F
Selected mechanized proofs if the core language stabilizes enough to justify them.

Evermore should earn formal claims incrementally.
