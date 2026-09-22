import type { Diagnostic } from "./diagnostics.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";
import { emitVue, type GeneratedFile } from "./codegen/vue.js";
import { lowerToIR } from "./ir.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";

export type CompileTarget = "vue";

export type CompileResult = {
  readonly appName: string;
  readonly target: CompileTarget;
  readonly diagnostics: readonly Diagnostic[];
  readonly files: readonly GeneratedFile[];
};

export function compile(
  source: string,
  options: { readonly target?: CompileTarget } = {},
): CompileResult {
  const target = options.target ?? "vue";
  const program = parse(source);
  const analysis = analyze(program);

  const errors = analysis.diagnostics.filter(
    (item) => item.severity === "error",
  );

  if (errors.length > 0 || !analysis.model) {
    throw new EvermoreDiagnosticError(errors);
  }

  const ir = lowerToIR(analysis.model);

  switch (target) {
    case "vue":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitVue(ir),
      };
  }
}
