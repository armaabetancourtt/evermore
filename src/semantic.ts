import type {
  ComponentDeclaration,
  Program,
  ScreenDeclaration,
  StateDeclaration,
  UseStatement,
  VisualStatement,
} from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";

export type SemanticModel = {
  readonly program: Program;
  readonly screensByName: ReadonlyMap<string, ScreenDeclaration>;
  readonly componentsByName: ReadonlyMap<string, ComponentDeclaration>;
};

export function analyze(program: Program): {
  readonly model?: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const screens = new Map<string, ScreenDeclaration>();
  const components = new Map<string, ComponentDeclaration>();

  for (const component of program.components) {
    if (components.has(component.name)) {
      diagnostics.push({
        code: "E2010",
        severity: "error",
        message:
          'Component "' +
          component.name +
          '" is declared more than once.',
        span: component.span,
        help: "Give each component a unique name.",
      });
      continue;
    }

    components.set(component.name, component);
  }

  for (const screen of program.screens) {
    if (screens.has(screen.name)) {
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

  validateComponents(components, screens, diagnostics);

  for (const screen of program.screens) {
    const states = collectStates(screen, diagnostics);

    for (const statement of screen.body) {
      if (
        statement.kind === "StateDeclaration" ||
        statement.kind === "TitleStatement"
      ) {
        continue;
      }

      validateScreenVisual(
        statement,
        screen,
        states,
        screens,
        components,
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
            componentsByName: components,
          },
        }),
    diagnostics,
  };
}

function validateComponents(
  components: ReadonlyMap<string, ComponentDeclaration>,
  screens: ReadonlyMap<string, ScreenDeclaration>,
  diagnostics: Diagnostic[],
): void {
  const validated = new Set<string>();
  const visiting = new Set<string>();

  const validate = (name: string): void => {
    if (validated.has(name)) return;

    const component = components.get(name);
    if (!component) return;

    visiting.add(name);

    for (const statement of component.body) {
      validateComponentVisual(
        statement,
        component,
        components,
        screens,
        visiting,
        validate,
        diagnostics,
      );
    }

    visiting.delete(name);
    validated.add(name);
  };

  for (const name of components.keys()) {
    validate(name);
  }
}

function validateComponentVisual(
  statement: VisualStatement,
  owner: ComponentDeclaration,
  components: ReadonlyMap<string, ComponentDeclaration>,
  screens: ReadonlyMap<string, ScreenDeclaration>,
  visiting: ReadonlySet<string>,
  validateComponent: (name: string) => void,
  diagnostics: Diagnostic[],
): void {
  if (statement.kind === "ShowStatement") {
    diagnostics.push({
      code: "E2013",
      severity: "error",
      message:
        'Component "' +
        owner.name +
        '" cannot read screen-local state "' +
        statement.stateName +
        '" yet.',
      span: statement.span,
      help:
        "Keep M1 components stateless. Typed component inputs are planned for a later milestone.",
    });
    return;
  }

  if (statement.kind === "ButtonStatement") {
    if (
      statement.action?.kind === "IncrementAction"
    ) {
      diagnostics.push({
        code: "E2013",
        severity: "error",
        message:
          'Component "' +
          owner.name +
          '" cannot mutate screen-local state "' +
          statement.action.stateName +
          '" yet.',
        span: statement.action.span,
        help:
          "Keep M1 components stateless. Typed component inputs are planned for a later milestone.",
      });
    }

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

    return;
  }

  if (statement.kind === "UseStatement") {
    validateComponentUse(
      statement,
      components,
      visiting,
      validateComponent,
      diagnostics,
    );
    return;
  }

  if (statement.kind === "StackStatement") {
    for (const child of statement.body) {
      validateComponentVisual(
        child,
        owner,
        components,
        screens,
        visiting,
        validateComponent,
        diagnostics,
      );
    }
  }
}

function validateComponentUse(
  statement: UseStatement,
  components: ReadonlyMap<string, ComponentDeclaration>,
  visiting: ReadonlySet<string>,
  validateComponent: (name: string) => void,
  diagnostics: Diagnostic[],
): void {
  if (!components.has(statement.componentName)) {
    diagnostics.push({
      code: "E2011",
      severity: "error",
      message:
        'Unknown component "' + statement.componentName + '".',
      span: statement.span,
      help: "Declare the component before using it.",
    });
    return;
  }

  if (visiting.has(statement.componentName)) {
    diagnostics.push({
      code: "E2012",
      severity: "error",
      message:
        'Component cycle detected through "' +
        statement.componentName +
        '".',
      span: statement.span,
      help: "Break the component use cycle.",
    });
    return;
  }

  validateComponent(statement.componentName);
}

function validateScreenVisual(
  statement: VisualStatement,
  screen: ScreenDeclaration,
  states: ReadonlyMap<string, StateDeclaration>,
  screens: ReadonlyMap<string, ScreenDeclaration>,
  components: ReadonlyMap<string, ComponentDeclaration>,
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

  if (statement.kind === "UseStatement") {
    if (!components.has(statement.componentName)) {
      diagnostics.push({
        code: "E2011",
        severity: "error",
        message:
          'Unknown component "' + statement.componentName + '".',
        span: statement.span,
        help: "Declare the component before using it.",
      });
    }
    return;
  }

  if (statement.kind === "StackStatement") {
    for (const child of statement.body) {
      validateScreenVisual(
        child,
        screen,
        states,
        screens,
        components,
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

    if (states.has(statement.name)) {
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
