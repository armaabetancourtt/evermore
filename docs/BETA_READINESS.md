# Evermore beta readiness

This document defines release gates, not a declaration that the gates have passed.

## Included in the hardening candidate

- Lexical diagnostics preserve source locations on LF, CRLF and CR inputs.
- Unknown string escapes report E0004 rather than silently mutating data.
- Incremental compilation uses bounded, configurable LRU storage (default 64 entries).
- The language server bounds message frame sizes, rejects malformed JSON-RPC input, and catches request-level errors.
- Generated file names are lexically constrained to the build directory.
- Unsupported compilation targets fail explicitly at runtime.
- Regression tests cover line endings, escape sequences, cache eviction, output-path traversal and target validation.

## Required before publishing a beta tag

- [ ] The complete CI workflow passes on the candidate commit.
- [ ] All language examples parse, type-check, and produce the expected targets.
- [ ] Generated Vue and Node artifacts build and pass smoke tests.
- [ ] The LSP survives malformed and oversized frames in an integration test.
- [ ] Fuzz the lexer/parser with random and malformed source; verify no hangs or process crashes.
- [ ] Audit package and project imports for filesystem traversal and cycles.
- [ ] Audit generated-output symlink handling; lexical path validation alone does not prevent traversing pre-existing symlinks.
- [ ] Document breaking changes (including invalid escape rejection), target maturity, and known limitations.
- [ ] Publish only after a reproducible clean install, check, test and build.

Do not advertise a production stability or security guarantee based on this hardening patch.
