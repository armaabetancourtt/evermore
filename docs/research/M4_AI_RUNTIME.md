# M4 AI Runtime Decisions

M4 treats AI execution as a typed capability-bearing computation rather than as an unstructured prompt string.

## Capability boundary

Every tool declares one permission string and one typed handler. An agent can call only tools explicitly listed in its declaration. Approval-required tools are a subset of that capability set and are rejected statically otherwise.

The generated runtime enforces the same boundary dynamically before tool execution.

## Provider neutrality

Agents declare model requirements as descriptive strings rather than provider-specific SDK identifiers. Generated runtimes depend on the EvermoreModelProvider interface. Concrete providers translate the requirement into their own model routing.

## Structured output

Agent input and output use ordinary Evermore types. The AI target emits runtime schemas and validates model output before returning it to application code.

## Context planning

Context declarations identify named context sources, a token budget, and an overflow policy. The generated runtime resolves sources deterministically, estimates token pressure, and either rejects overflow or applies a bounded summary/truncation representation.

This is deliberately inspectable. Future planners may replace the estimator while preserving the same declaration-level contract.

## Budget planning

Each agent has a token ceiling and may have a cost ceiling. Provider responses report usage. The runtime rejects executions exceeding either declared budget.

## Evaluation semantics

An evaluation references:
- one agent;
- a zero-argument function returning the exact agent input type;
- a zero-argument function returning the exact agent output type.

The AI target generates a deterministic harness whose model double returns the expected fixture, exercising input/output validation and runtime execution without a network provider.

## Prompt/code separation

Critical permissions, approvals, budgets, tool identities, context sources, tracing and output contracts are represented in the language and generated runtime. A provider may still construct prompts internally, but prompts do not carry these security or type semantics.
