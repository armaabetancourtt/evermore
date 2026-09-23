# M1 Natural Syntax Study

## Purpose

M1 claims that Evermore can offer a human-first source surface without making
indentation semantic or introducing a second language with different meaning.

This study records executable evidence for the two remaining M1 research items:

1. natural syntax ambiguity;
2. source readability.

The study deliberately does **not** claim that automated metrics prove human
comprehension. Human readability is broader than source length. The metrics here
are reproducible proxies for surface complexity, while semantic equivalence and
whitespace invariance are compiler properties.

## Method

The executable corpus lives in `tests/m1-research.test.ts`.

It covers M1 features that create block-boundary pressure:

- multiple screens;
- navigation actions;
- reusable components;
- nested vertical and horizontal stacks;
- component use;
- screen state;
- state display;
- state mutation.

Every corpus program is checked in three ways.

### 1. Whitespace and indentation invariance

The natural source is compiled normally and again after indentation is removed
and non-semantic blank space is collapsed.

Expected result:

> Both forms produce identical generated artifacts.

This provides executable evidence that indentation is presentation, not syntax.

### 2. Natural / explicit semantic equivalence

The canonical formatter emits both natural and explicit forms from the same
program. Both outputs are compiled.

Expected result:

> Both forms produce identical generated artifacts.

This guards against ambiguity being resolved differently by the two surfaces.

### 3. Surface-complexity measurement

Across the same corpus, the test compares:

- source character count;
- lexer token count.

Expected result:

> Canonical natural syntax uses fewer characters and fewer syntax tokens than
> canonical explicit syntax for the M1 corpus.

This is a narrow, reproducible readability proxy. It measures ceremony, not
whether a human reader subjectively prefers one form.

## Boundary decisions

The study confirms the design rule already used by the grammar:

- top-level declarations terminate natural `screen` bodies deterministically;
- nested constructs whose end cannot be inferred use the explicit word `end`;
- indentation never owns a block;
- braces remain available as an explicit canonical surface.

This means Evermore does not depend on an LLM or indentation heuristics to infer
program structure.

## Result

M1's syntax research questions are considered closed for the current executable
surface because the repository now contains reproducible evidence for:

- deterministic parsing under indentation changes;
- semantic equivalence between natural and explicit syntax;
- lower source-surface ceremony in the natural form for the representative M1
  corpus.

Future language features must extend this corpus when they introduce new block
or boundary forms. A future human-subject usability study may add stronger
evidence, but it is not required to establish the compiler-level M1 exit
condition.