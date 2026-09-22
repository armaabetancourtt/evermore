import type { Program, ScreenDeclaration } from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";

export type SemanticModel = {
  readonly program: Program;
  readonly screensByName: ReadonlyMap<string, ScreenDeclaration>;
};

export function analyze(program: Program): {
  readonly model?: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const screens = new Map<string, ScreenDeclaration>();

  for (const screen of program.screens) {
    const previous = screens.get(screen.name);

    if (previous) {
      diagnostics.push({
        code: "E2001",
        severity: "error",
        message: 'Screen "' + screen.name + '" is declared more than once.',
        span: screen.span,
        help: "Give each screen a unique name.",
      });
      continue;
    }

    screens.set(screen.name, screen);
  }

  for (const screen of program.screens) {
    for (const statement of screen.body) {
      if (
        statement.kind === "ButtonStatement" &&
        statement.action &&
        !screens.has(statement.action.target)
      ) {
        diagnostics.push({
          code: "E2002",
          severity: "error",
          message:
            'Button "' +
            statement.label +
            '" opens unknown screen "' +
            statement.action.target +
            '".',
          span: statement.action.span,
          help:
            'Declare screen ' +
            statement.action.target +
            " or change the navigation target.",
        });
      }
    }
  }

  if (program.screens.length === 0) {
    diagnostics.push({
      code: "W2001",
      severity: "warning",
      message: "The application declares no screens.",
      span: program.span,
      help: "Add at least one screen to produce a visible application.",
    });
  }

  const hasError = diagnostics.some((item) => item.severity === "error");

  return {
    ...(hasError
      ? {}
      : {
          model: {
            program,
            screensByName: screens,
          },
        }),
    diagnostics,
  };
}
