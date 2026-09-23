# M8 Tooling Research Notes

M8 treats tooling as a first-class consumer of Evermore semantics.

The language service exposes parser/semantic diagnostics, canonical formatting, semantic-token data, identifier rename edits and generated Markdown documentation. The LSP server speaks JSON-RPC over stdio and deliberately has no editor-specific dependency.

The package-registry design keeps versions immutable, uses exact dependency versions and content digests, and forbids install scripts. Playground and Studio are research prototypes intended to validate information architecture before a heavier product implementation.

The important boundary is that editor behavior derives from the compiler and lexer rather than duplicating language rules in an extension.
