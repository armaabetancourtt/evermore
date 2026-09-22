import type {
  Program,
  ScreenDeclaration,
  StateDeclaration,
  VisualStatement,
} from "./ast.js";
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
    const states = collectStates(screen, diagnostics);

    for (const statement of screen.body) {
      if (
        statement.kind === "StateDeclaration" ||
        statement.kind === "TitleStatement"
      ) {
        continue;
      }

      validateVisualStatement(
        statement,
        screen,
        states,
        screens,
        diagnostics,
      );
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

function validateVisualStatement(
  statement: VisualStatement,
  screen: ScreenDeclaration,
  states: ReadonlyMap<string, StateDeclaration>,
  screens: ReadonlyMap<string, ScreenDeclaration>,
  diagnostics: Diagnostic[],
): void {
  if (
    statement.kind === "ShowStatement" &&
    !states.has(statement.stateName)
  ) {
    diagnostics.push({
      code: "E2004",
      severity: "error",
      message:
        'Screen "' +
        screen.name +
        '" shows unknown state "' +
        statement.stateName +
        '".',
      span: statement.span,
      help:
        "Declare state " +
        statement.stateName +
        " starts 0 in the same screen.",
    });
    return;
  }

  if (statement.kind === "ButtonStatement") {
    if (
      statement.action?.kind === "NavigationAction" &&
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
          "Declare screen " +
          statement.action.target +
          " or change the navigation target.",
      });
    }

    if (
      statement.action?.kind === "IncrementAction" &&
      !states.has(statement.action.stateName)
    ) {
      diagnostics.push({
        code: "E2005",
        severity: "error",
        message:
          'Button "' +
          statement.label +
          '" increases unknown state "' +
          statement.action.stateName +
          '".',
        span: statement.action.span,
        help:
          "Declare state " +
          statement.action.stateName +
          " starts 0 in the same screen.",
      });
    }

    return;
  }

  if (statement.kind === "StackStatement") {
    for (const child of statement.body) {
      validateVisualStatement(
        child,
        screen,
        states,
        screens,
        diagnostics,
      );
    }
  }
}

function collectStates(
  screen: ScreenDeclaration,
  diagnostics: Diagnostic[],
): ReadonlyMap<string, StateDeclaration> {
  const states = new Map<string, StateDeclaration>();

  for (const statement of screen.body) {
    if (statement.kind !== "StateDeclaration") continue;

    const previous = states.get(statement.name);

    if (previous) {
      diagnostics.push({
        code: "E2003",
        severity: "error",
        message:
          'State "' +
          statement.name +
          '" is declared more than once in screen "' +
          screen.name +
          '".',
        span: statement.span,
        help: "Give each state in a screen a unique name.",
      });
      continue;
    }

    states.set(statement.name, statement);
  }

  return states;
}
