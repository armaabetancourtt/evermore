# Evermore: beta hardening and remaining gates

This branch adds deterministic malformed-input smoke cases, content-addressed package integrity primitives, deny-by-default agent tool authorization tests, a VS Code client scaffold, and benchmark tooling. These are **not** a completed remote registry, a formally verified compiler, or a stable language release.

Security gates still required: process-isolated time-bounded fuzzing, symlink-safe atomic output writes, package archive extraction policy, integration LSP framing tests, signed release provenance, supported-target end-to-end conformance and multi-platform CI. The injection-string heuristic is only a coarse detector, **not a prompt-injection defense**. Agent execution must isolate tools and treat retrieved context as untrusted regardless of this result.

Before beta tag: perform the complete BETA_READINESS.md checklist and capture reproducible evidence.
