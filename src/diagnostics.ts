import type { SourceSpan } from "./ast.js";

export type DiagnosticSeverity = "error" | "warning";

export type Diagnostic = {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly help?: string;
};

export class EvermoreDiagnosticError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    super(diagnostics.map((item) => item.message).join("\n"));
    this.name = "EvermoreDiagnosticError";
    this.diagnostics = diagnostics;
  }
}

export function formatDiagnostic(
  diagnostic: Diagnostic,
  sourceName = "<input>",
): string {
  const where =
    sourceName +
    ":" +
    diagnostic.span.start.line +
    ":" +
    diagnostic.span.start.column;

  const help = diagnostic.help ? "\n  help: " + diagnostic.help : "";
  return (
    diagnostic.severity.toUpperCase() +
    " " +
    diagnostic.code +
    " at " +
    where +
    "\n  " +
    diagnostic.message +
    help
  );
}
