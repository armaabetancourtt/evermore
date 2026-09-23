# M9 Performance and Native Compilation Research

## Status

M9 closes as a research milestone, not as a claim that Evermore has replaced mature native compilers.

The repository now has executable evidence for three directions: a semantics-preserving constant-folding IR pass, an instrumented incremental compilation cache, and a WebAssembly lowering experiment for pure numeric functions.

## WebAssembly

The research emitter lowers eligible Evermore functions with numeric parameters, a numeric return type and a single pure arithmetic return expression into a valid WebAssembly binary module. Tests instantiate that binary with the platform WebAssembly runtime and execute an exported function.

This proves the IR can support a native-like target without coupling ordinary Evermore syntax to a JavaScript framework.

## Incremental compilation

The M9 incremental compiler memoizes complete compilation results by target and exact source contents and exposes hit/miss/entry statistics. This is deliberately a baseline, not a claim of fine-grained incremental parsing.

A reproducible research script records cold repeated compilation and cache-backed repeated compilation timings without enforcing a speedup threshold across CI machines.

## IR optimization

The optimizer folds literal numeric arithmetic and comparisons and removes branches whose condition is a compile-time boolean. It is conservative: expressions that cannot be proven constant are preserved.

## LLVM decision

An LLVM backend is deferred. The WebAssembly experiment is enough to validate backend independence at this stage, while LLVM would add toolchain and ABI complexity before Evermore has evidence that native server workloads require it.

## Native server runtime decision

The Node target remains the operational server backend. A custom native runtime is deferred until profiling identifies runtime overhead that cannot be addressed through generated target optimization or WebAssembly.

## Ahead-of-time specialization

The numeric WebAssembly emitter is the first AOT specialization experiment: eligible pure functions are compiled ahead of execution into a typed binary target. Broader specialization remains future research.

## Evidence policy

M9 completion means the research questions have executable prototypes and explicit decisions. It does not mean every possible low-level backend is production-ready.
