# M1 Natural Syntax Study

## Purpose

M1 claims that Evermore can offer a human-first natural surface without making indentation semantic or changing program meaning.

This document closes the two M1 research follow-ups with a **reproducible source-form study**. It does **not** claim a human-subject usability result.

## Questions

1. **Ambiguity:** can canonical natural and explicit forms represent the same implemented programs without changing generated behavior?
2. **Source readability proxy:** how much structural notation does each canonical form require on representative M1 programs?

## Corpus

The study uses executable repository examples rather than synthetic snippets:

- `examples/natural.ever`
- `examples/counter.ever`
- `examples/layout.ever`
- `examples/components.ever`
- `examples/showcase.ever`

These cover screens, navigation, reactive state, layout and reusable components.

## Reproduction

Run:

~~~bash
npm run research:m1
~~~

The script:

1. parses each corpus program;
2. canonicalizes it to natural syntax;
3. canonicalizes it to explicit syntax;
4. compiles both forms;
5. requires generated target artifacts to be byte-for-byte equivalent by path/content;
6. reports character count, line count, brace count and `end` terminators for both surfaces.

CI runs the same command.

## Findings and interpretation

### Natural syntax ambiguity

For the executable M1 corpus, ambiguity is rejected operationally rather than argued stylistically: canonical natural and explicit sources must compile into identical target artifacts.

Natural indentation remains trivia. Nested natural constructs whose boundary cannot be inferred use the explicit `end` token. This gives the parser a deterministic boundary without making whitespace semantic.

The study fails CI if either canonical surface diverges from the other.

### Source readability

The automated report records source-shape proxies: characters, lines, braces and natural `end` terminators. These metrics are useful for tracking structural ceremony, but they are **not evidence that humans read one syntax faster or prefer it more**.

For M1, the engineering conclusion is therefore intentionally narrow:

> Natural syntax reduces delimiter punctuation while preserving deterministic parsing and target equivalence on the implemented web surface.

A future human-subject study may evaluate comprehension time, error rate and preference. That is product research, not a blocker for the M1 compiler milestone.

## Decision

M1 keeps both surfaces:

- **natural** is the canonical human-first authoring direction;
- **explicit** remains available for tooling, generated editing and users who prefer visible delimiters;
- both lower through the same semantic pipeline.

This satisfies the M1 research requirement without turning subjective readability claims into unsupported facts.
