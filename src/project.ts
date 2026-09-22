import path from "node:path";

import type { ImportDeclaration, Program } from "./ast.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";
import { parse } from "./parser.js";

export type ProjectSourceReader = (
  absolutePath: string,
) => Promise<string>;

export type ProjectUnit = {
  readonly path: string;
  readonly program: Program;
};

export type LoadedProject = {
  readonly entryPath: string;
  readonly program: Program;
  readonly units: readonly ProjectUnit[];
};

export async function loadProject(
  entryPath: string,
  readSource: ProjectSourceReader,
): Promise<LoadedProject> {
  const absoluteEntry = path.resolve(entryPath);
  const loaded = new Map<string, ProjectUnit>();
  const loading: string[] = [];
  const moduleNames = new Map<string, string>();
  const ordered: ProjectUnit[] = [];

  const visit = async (
    absolutePath: string,
    importedBy?: ImportDeclaration,
  ): Promise<ProjectUnit> => {
    const existing = loaded.get(absolutePath);
    if (existing) return existing;

    const cycleIndex = loading.indexOf(absolutePath);
    if (cycleIndex !== -1) {
      const cycle = [...loading.slice(cycleIndex), absolutePath]
        .map((item) => path.basename(item))
        .join(" -> ");

      throw new EvermoreDiagnosticError([
        {
          code: "E2603",
          severity: "error",
          message: "Module import cycle detected: " + cycle + ".",
          span: importedBy?.span ?? emptySpan(),
          help: "Remove one import so the module dependency graph is acyclic.",
        },
      ]);
    }

    let source: string;

    try {
      source = await readSource(absolutePath);
    } catch {
      throw new EvermoreDiagnosticError([
        {
          code: "E2605",
          severity: "error",
          message:
            'Cannot read imported Evermore source "' +
            absolutePath +
            '".',
          span: importedBy?.span ?? emptySpan(),
          help: "Check the import path and make sure the file exists.",
        },
      ]);
    }

    const program = parse(source);
    const isEntry = absolutePath === absoluteEntry;

    if (isEntry && program.unitKind !== "app") {
      throw new EvermoreDiagnosticError([
        {
          code: "E2600",
          severity: "error",
          message: "A project entrypoint must start with app.",
          span: program.span,
          help: 'Use app "Name" in the entry file; imported files use module Name.',
        },
      ]);
    }

    if (!isEntry && program.unitKind !== "module") {
      throw new EvermoreDiagnosticError([
        {
          code: "E2601",
          severity: "error",
          message:
            'Imported file "' +
            absolutePath +
            '" declares an app instead of a module.',
          span: importedBy?.span ?? program.span,
          help: "Imported Evermore files must start with module <Name>.",
        },
      ]);
    }

    if (program.unitKind === "module") {
      const moduleName = program.moduleName ?? program.appName;
      const previousPath = moduleNames.get(moduleName);

      if (previousPath && previousPath !== absolutePath) {
        throw new EvermoreDiagnosticError([
          {
            code: "E2604",
            severity: "error",
            message:
              'Module name "' +
              moduleName +
              '" is declared by both "' +
              previousPath +
              '" and "' +
              absolutePath +
              '".',
            span: program.span,
            help: "Give every imported module a unique module name.",
          },
        ]);
      }

      moduleNames.set(moduleName, absolutePath);
    }

    loading.push(absolutePath);

    for (const declaration of program.imports) {
      const target = resolveImportPath(
        absolutePath,
        declaration,
      );
      await visit(target, declaration);
    }

    loading.pop();

    const unit = { path: absolutePath, program };
    loaded.set(absolutePath, unit);
    ordered.push(unit);
    return unit;
  };

  const entry = await visit(absoluteEntry);
  const root = entry.program;

  const merged: Program = {
    kind: "Program",
    unitKind: "app",
    appName: root.appName,
    imports: [],
    data: ordered.flatMap((unit) => unit.program.data),
    classes: ordered.flatMap((unit) => unit.program.classes),
    protocols: ordered.flatMap((unit) => unit.program.protocols),
    choices: ordered.flatMap((unit) => unit.program.choices),
    functions: ordered.flatMap((unit) => unit.program.functions),
    components: ordered.flatMap((unit) => unit.program.components),
    screens: ordered.flatMap((unit) => unit.program.screens),
    span: root.span,
  };

  return {
    entryPath: absoluteEntry,
    program: merged,
    units: ordered,
  };
}

function resolveImportPath(
  importerPath: string,
  declaration: ImportDeclaration,
): string {
  if (
    declaration.path !== "." &&
    !declaration.path.startsWith("./") &&
    !declaration.path.startsWith("../")
  ) {
    throw new EvermoreDiagnosticError([
      {
        code: "E2602",
        severity: "error",
        message:
          'Import "' +
          declaration.path +
          '" is not a relative module import.',
        span: declaration.span,
        help:
          'Use "./module.ever" or "../module.ever". Package imports are reserved for package semantics.',
      },
    ]);
  }

  const withExtension = declaration.path.endsWith(".ever")
    ? declaration.path
    : declaration.path + ".ever";

  return path.resolve(path.dirname(importerPath), withExtension);
}

function emptySpan(): Program["span"] {
  return {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
}
