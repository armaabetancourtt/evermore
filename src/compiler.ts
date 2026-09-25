import type { Program } from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";
import { emitAI } from "./codegen/ai.js";
import { emitInfrastructure } from "./codegen/infrastructure.js";
import {
  emitFlutter,
  emitReactNative,
} from "./codegen/mobile.js";
import { emitNode } from "./codegen/node.js";
import { emitPython } from "./codegen/python.js";
import { emitVue, type GeneratedFile } from "./codegen/vue.js";
import { emitWasmResearch } from "./codegen/wasm.js";
import { lowerToIR } from "./ir.js";
import { optimizeIR } from "./optimizer.js";
import { parse } from "./parser.js";
import { loadPackageProject, packageGraph } from "./package.js";
import {
  loadProject,
  type ProjectSourceReader,
} from "./project.js";
import { analyze } from "./semantic.js";

export type CompileTarget =
  | "vue"
  | "node"
  | "ai"
  | "react-native"
  | "flutter"
  | "python"
  | "infra"
  | "wasm";

export type CompileResult = {
  readonly appName: string;
  readonly target: CompileTarget;
  readonly package?: {
    readonly name: string;
    readonly version: string;
  };
  readonly diagnostics: readonly Diagnostic[];
  readonly files: readonly GeneratedFile[];
};

export function compile(
  source: string,
  options: { readonly target?: CompileTarget } = {},
): CompileResult {
  const program = parse(source);

  if (program.unitKind !== "app") {
    throw new EvermoreDiagnosticError([
      {
        code: "E2600",
        severity: "error",
        message: "A standalone compilation must start with app.",
        span: program.span,
        help:
          "Compile a project entry file for modules, or change this source to an app entrypoint.",
      },
    ]);
  }

  if (program.imports.length > 0) {
    throw new EvermoreDiagnosticError([
      {
        code: "E2606",
        severity: "error",
        message:
          "Standalone compile(source) cannot resolve module imports.",
        span: program.imports[0]!.span,
        help:
          "Use compileProject(...) or the Evermore CLI with an entry .ever file.",
      },
    ]);
  }

  return compileProgram(program, options);
}

export async function compileProject(
  entryPath: string,
  readSource: ProjectSourceReader,
  options: { readonly target?: CompileTarget } = {},
): Promise<CompileResult> {
  const project = await loadProject(entryPath, readSource);
  return compileProgram(project.program, options);
}

export async function compilePackage(
  manifestPath: string,
  readSource: ProjectSourceReader,
  options: { readonly target?: CompileTarget } = {},
): Promise<CompileResult> {
  const project = await loadPackageProject(
    manifestPath,
    readSource,
  );
  const result = compileProgram(project.program, options);
  const graph = packageGraph(project);

  return {
    ...result,
    package: {
      name: graph.name,
      version: graph.version,
    },
    files: [
      ...result.files,
      {
        path: "src/generated/evermore.package.json",
        content: JSON.stringify(graph, null, 2) + "\n",
      },
    ],
  };
}

export function compileProgram(
  program: Program,
  options: { readonly target?: CompileTarget } = {},
): CompileResult {
  const target = options.target ?? "vue";
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
    case "node":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitNode(ir),
      };
    case "ai":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitAI(ir),
      };
    case "react-native":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitReactNative(ir),
      };
    case "flutter":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitFlutter(ir),
      };
    case "python":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitPython(ir),
      };
    case "infra":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitInfrastructure(ir),
      };
    case "wasm":
      return {
        appName: ir.appName,
        target,
        diagnostics: analysis.diagnostics,
        files: emitWasmResearch(optimizeIR(ir).program),
      };
    default:
      throw new RangeError("Unsupported Evermore compilation target: " + String(target));
  }
}
