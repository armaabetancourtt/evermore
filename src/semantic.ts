import type {
  ChoiceDeclaration,
  ComponentDeclaration,
  DataDeclaration,
  Program,
  ProtocolDeclaration,
  ScreenDeclaration,
  StateDeclaration,
  TypeAnnotation,
  UseStatement,
  VisualStatement,
} from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";
import {
  validateFunctions,
  type FunctionSignature,
} from "./typecheck.js";
import {
  isPrimitiveTypeName,
  typeRefFromAnnotation,
} from "./types.js";

export type SemanticModel = {
  readonly program: Program;
  readonly dataByName: ReadonlyMap<string, DataDeclaration>;
  readonly protocolsByName: ReadonlyMap<string, ProtocolDeclaration>;
  readonly choicesByName: ReadonlyMap<string, ChoiceDeclaration>;
  readonly functionsByName: ReadonlyMap<string, Program["functions"][number]>;
  readonly functionSignaturesByName: ReadonlyMap<string, FunctionSignature>;
  readonly screensByName: ReadonlyMap<string, ScreenDeclaration>;
  readonly componentsByName: ReadonlyMap<string, ComponentDeclaration>;
};

export function analyze(program: Program): {
  readonly model?: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const dataByName = new Map<string, DataDeclaration>();
  const protocolsByName = new Map<string, ProtocolDeclaration>();
  const choicesByName = new Map<string, ChoiceDeclaration>();
  const screens = new Map<string, ScreenDeclaration>();
  const components = new Map<string, ComponentDeclaration>();

  for (const declaration of program.data) {
    if (isPrimitiveTypeName(declaration.name)) {
      diagnostics.push({
        code: "E2103",
        severity: "error",
        message:
          'Data type "' +
          declaration.name +
          '" conflicts with a primitive type.',
        span: declaration.span,
        help: "Choose a non-primitive name for the data type.",
      });
      continue;
    }

    if (dataByName.has(declaration.name)) {
      diagnostics.push({
        code: "E2100",
        severity: "error",
        message:
          'Data type "' +
          declaration.name +
          '" is declared more than once.',
        span: declaration.span,
        help: "Give each data type a unique name.",
      });
      continue;
    }

    dataByName.set(declaration.name, declaration);
  }

  for (const protocol of program.protocols) {
    if (isPrimitiveTypeName(protocol.name)) {
      diagnostics.push({
        code: "E2403",
        severity: "error",
        message:
          'Protocol "' +
          protocol.name +
          '" conflicts with a primitive type.',
        span: protocol.span,
        help: "Choose a non-primitive protocol name.",
      });
      continue;
    }

    if (dataByName.has(protocol.name)) {
      diagnostics.push({
        code: "E2402",
        severity: "error",
        message:
          'Protocol "' +
          protocol.name +
          '" conflicts with an existing data type.',
        span: protocol.span,
        help: "Every top-level type contract must have a unique name.",
      });
      continue;
    }

    if (protocolsByName.has(protocol.name)) {
      diagnostics.push({
        code: "E2400",
        severity: "error",
        message:
          'Protocol "' +
          protocol.name +
          '" is declared more than once.',
        span: protocol.span,
        help: "Give each protocol a unique name.",
      });
      continue;
    }

    protocolsByName.set(protocol.name, protocol);
  }

  for (const choice of program.choices) {
    if (isPrimitiveTypeName(choice.name)) {
      diagnostics.push({
        code: "E2303",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" conflicts with a primitive type.',
        span: choice.span,
        help: "Choose a non-primitive name for the choice type.",
      });
      continue;
    }

    if (dataByName.has(choice.name)) {
      diagnostics.push({
        code: "E2302",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" conflicts with an existing data type.',
        span: choice.span,
        help: "Every nominal type must have a unique name.",
      });
      continue;
    }

    if (protocolsByName.has(choice.name)) {
      diagnostics.push({
        code: "E2302",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" conflicts with an existing protocol.',
        span: choice.span,
        help: "Every nominal type must have a unique name.",
      });
      continue;
    }

    if (choicesByName.has(choice.name)) {
      diagnostics.push({
        code: "E2300",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" is declared more than once.',
        span: choice.span,
        help: "Give each choice type a unique name.",
      });
      continue;
    }

    const caseNames = new Set<string>();

    for (const item of choice.cases) {
      if (caseNames.has(item.name)) {
        diagnostics.push({
          code: "E2301",
          severity: "error",
          message:
            'Choice case "' +
            choice.name +
            "." +
            item.name +
            '" is declared more than once.',
          span: item.span,
          help: "Give each case within a choice a unique name.",
        });
      } else {
        caseNames.add(item.name);
      }
    }

    if (choice.cases.length === 0) {
      diagnostics.push({
        code: "E2306",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" must declare at least one case.',
        span: choice.span,
        help: "Add at least one case before end.",
      });
    }

    choicesByName.set(choice.name, choice);
  }

  for (const protocol of program.protocols) {
    const fieldNames = new Set<string>();

    for (const field of protocol.fields) {
      if (fieldNames.has(field.name)) {
        diagnostics.push({
          code: "E2401",
          severity: "error",
          message:
            'Protocol field "' +
            protocol.name +
            "." +
            field.name +
            '" is declared more than once.',
          span: field.span,
          help: "Give each required protocol field a unique name.",
        });
      } else {
        fieldNames.add(field.name);
      }

      const unknownType = findUnknownType(
        field.type,
        dataByName,
        choicesByName,
      );

      if (unknownType) {
        diagnostics.push({
          code: "E2408",
          severity: "error",
          message:
            'Protocol field "' +
            protocol.name +
            "." +
            field.name +
            '" references unknown type "' +
            unknownType +
            '".',
          span: field.type.span,
          help:
            "Protocol field requirements may use primitives, data types, choices, lists and optionals.",
        });
      }
    }
  }

  for (const protocol of program.protocols) {
    const methodNames = new Set<string>();
    const fieldNames = new Set(
      protocol.fields.map((field) => field.name),
    );

    for (const method of protocol.methods) {
      if (methodNames.has(method.name) || fieldNames.has(method.name)) {
        diagnostics.push({
          code: "E2411",
          severity: "error",
          message:
            'Protocol member "' +
            protocol.name +
            "." +
            method.name +
            '" is declared more than once or conflicts with a field.',
          span: method.span,
          help:
            "Give every protocol field and method a unique member name.",
        });
      } else {
        methodNames.add(method.name);
      }

      if (method.body.length > 0) {
        diagnostics.push({
          code: "E2412",
          severity: "error",
          message:
            'Protocol method "' +
            protocol.name +
            "." +
            method.name +
            '" is a requirement and cannot contain a body.',
          span: method.span,
          help:
            "Keep only generic/takes/returns declarations inside a protocol method.",
        });
      }

      if (method.typeParameters.length > 0) {
        diagnostics.push({
          code: "E2413",
          severity: "error",
          message:
            'Protocol method "' +
            protocol.name +
            "." +
            method.name +
            '" cannot declare generic parameters yet.',
          span: method.span,
          help:
            "Move generic behavior to a protocol-constrained top-level function for now.",
        });
      }
    }
  }

  for (const declaration of program.data) {
    const fieldNames = new Set<string>();

    for (const field of declaration.fields) {
      if (fieldNames.has(field.name)) {
        diagnostics.push({
          code: "E2101",
          severity: "error",
          message:
            'Field "' +
            field.name +
            '" is declared more than once in data type "' +
            declaration.name +
            '".',
          span: field.span,
          help: "Give every field in a data type a unique name.",
        });
      } else {
        fieldNames.add(field.name);
      }

      const unknownType = findUnknownType(
        field.type,
        dataByName,
        choicesByName,
      );

      if (unknownType) {
        diagnostics.push({
          code: "E2102",
          severity: "error",
          message:
            'Field "' +
            declaration.name +
            "." +
            field.name +
            '" references unknown type "' +
            unknownType +
            '".',
          span: field.type.span,
          help:
            "Use a primitive type (text, number, boolean, id) or declare data " +
            unknownType +
            ".",
        });
      }
    }
  }

  for (const declaration of program.data) {
    const methodNames = new Set<string>();
    const fieldNames = new Set(
      declaration.fields.map((field) => field.name),
    );

    for (const method of declaration.methods) {
      if (methodNames.has(method.name) || fieldNames.has(method.name)) {
        diagnostics.push({
          code: "E2411",
          severity: "error",
          message:
            'Data member "' +
            declaration.name +
            "." +
            method.name +
            '" is declared more than once or conflicts with a field.',
          span: method.span,
          help:
            "Give every data field and method a unique member name.",
        });
      } else {
        methodNames.add(method.name);
      }

      if (method.typeParameters.length > 0) {
        diagnostics.push({
          code: "E2413",
          severity: "error",
          message:
            'Data method "' +
            declaration.name +
            "." +
            method.name +
            '" cannot declare generic parameters yet.',
          span: method.span,
          help:
            "Move generic behavior to a protocol-constrained top-level function for now.",
        });
      }

      for (const parameter of method.parameters) {
        if (fieldNames.has(parameter.name)) {
          diagnostics.push({
            code: "E2414",
            severity: "error",
            message:
              'Method parameter "' +
              parameter.name +
              '" conflicts with field "' +
              declaration.name +
              "." +
              parameter.name +
              '".',
            span: parameter.span,
            help:
              "Rename the parameter so field reads remain unambiguous.",
          });
        }
      }
    }
  }

  for (const declaration of program.data) {
    const seen = new Set<string>();
    const fields = new Map(
      declaration.fields.map((field) => [field.name, field] as const),
    );

    for (const conformance of declaration.conformances) {
      if (seen.has(conformance.name)) {
        diagnostics.push({
          code: "E2404",
          severity: "error",
          message:
            'Data type "' +
            declaration.name +
            '" declares protocol "' +
            conformance.name +
            '" more than once.',
          span: conformance.span,
          help: "Keep each protocol conformance once.",
        });
        continue;
      }

      seen.add(conformance.name);
      const protocol = protocolsByName.get(conformance.name);

      if (!protocol) {
        diagnostics.push({
          code: "E2405",
          severity: "error",
          message:
            'Data type "' +
            declaration.name +
            '" conforms to unknown protocol "' +
            conformance.name +
            '".',
          span: conformance.span,
          help: "Declare the protocol before relying on its contract.",
        });
        continue;
      }

      for (const required of protocol.fields) {
        const actual = fields.get(required.name);

        if (!actual) {
          diagnostics.push({
            code: "E2406",
            severity: "error",
            message:
              'Data type "' +
              declaration.name +
              '" is missing field "' +
              required.name +
              '" required by protocol "' +
              protocol.name +
              '".',
            span: conformance.span,
            help:
              "Add " +
              required.name +
              " with the protocol-required type.",
          });
          continue;
        }

        if (!sameTypeAnnotation(actual.type, required.type)) {
          diagnostics.push({
            code: "E2407",
            severity: "error",
            message:
              'Field "' +
              declaration.name +
              "." +
              required.name +
              '" does not match protocol "' +
              protocol.name +
              '".',
            span: actual.type.span,
            help:
              "Use the same field type required by the protocol contract.",
          });
        }
      }

      const methods = new Map(
        declaration.methods.map((method) => [method.name, method] as const),
      );

      for (const required of protocol.methods) {
        const actual = methods.get(required.name);

        if (!actual) {
          diagnostics.push({
            code: "E2409",
            severity: "error",
            message:
              'Data type "' +
              declaration.name +
              '" is missing method "' +
              required.name +
              '" required by protocol "' +
              protocol.name +
              '".',
            span: conformance.span,
            help:
              "Implement the required method with the protocol-declared signature.",
          });
          continue;
        }

        if (!sameMethodContract(actual, required)) {
          diagnostics.push({
            code: "E2410",
            severity: "error",
            message:
              'Method "' +
              declaration.name +
              "." +
              required.name +
              '" does not match protocol "' +
              protocol.name +
              '".',
            span: actual.span,
            help:
              "Use the same parameter and return types required by the protocol method.",
          });
        }
      }
    }
  }

  const functionTypes = validateFunctions(
    program.functions,
    { dataByName, protocolsByName, choicesByName },
    diagnostics,
  );

  for (const protocol of program.protocols) {
    validateFunctions(
      protocol.methods,
      { dataByName, protocolsByName, choicesByName },
      diagnostics,
      { validateBodies: false },
    );
  }

  for (const declaration of program.data) {
    const initialValues = new Map(
      declaration.fields.map(
        (field) =>
          [
            field.name,
            typeRefFromAnnotation(
              field.type,
              new Set(),
              new Set(protocolsByName.keys()),
            ),
          ] as const,
      ),
    );

    validateFunctions(
      declaration.methods,
      { dataByName, protocolsByName, choicesByName },
      diagnostics,
      {
        initialValues,
        bodyCallSignatures: functionTypes.signaturesByName,
      },
    );
  }

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
            dataByName,
            protocolsByName,
            choicesByName,
            functionsByName: functionTypes.functionsByName,
            functionSignaturesByName: functionTypes.signaturesByName,
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

function sameMethodContract(
  actual: Program["functions"][number],
  required: Program["functions"][number],
): boolean {
  if (actual.parameters.length !== required.parameters.length) {
    return false;
  }

  if (!sameTypeAnnotation(actual.returnType, required.returnType)) {
    return false;
  }

  return actual.parameters.every((parameter, index) => {
    const requiredParameter = required.parameters[index];
    return (
      requiredParameter !== undefined &&
      sameTypeAnnotation(parameter.type, requiredParameter.type)
    );
  });
}

function sameTypeAnnotation(
  left: TypeAnnotation,
  right: TypeAnnotation,
): boolean {
  if (left.kind !== right.kind) return false;

  switch (left.kind) {
    case "NamedTypeAnnotation":
      return (
        right.kind === "NamedTypeAnnotation" &&
        left.name === right.name
      );

    case "ListTypeAnnotation":
      return (
        right.kind === "ListTypeAnnotation" &&
        sameTypeAnnotation(left.elementType, right.elementType)
      );

    case "SetTypeAnnotation":
      return (
        right.kind === "SetTypeAnnotation" &&
        sameTypeAnnotation(left.elementType, right.elementType)
      );

    case "MapTypeAnnotation":
      return (
        right.kind === "MapTypeAnnotation" &&
        sameTypeAnnotation(left.keyType, right.keyType) &&
        sameTypeAnnotation(left.valueType, right.valueType)
      );

    case "OptionalTypeAnnotation":
      return (
        right.kind === "OptionalTypeAnnotation" &&
        sameTypeAnnotation(left.valueType, right.valueType)
      );
  }
}

function findUnknownType(
  annotation: TypeAnnotation,
  dataByName: ReadonlyMap<string, DataDeclaration>,
  choicesByName: ReadonlyMap<string, ChoiceDeclaration>,
): string | undefined {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      return !isPrimitiveTypeName(annotation.name) &&
        !dataByName.has(annotation.name) &&
        !choicesByName.has(annotation.name)
        ? annotation.name
        : undefined;

    case "ListTypeAnnotation":
    case "SetTypeAnnotation":
      return findUnknownType(
        annotation.elementType,
        dataByName,
        choicesByName,
      );

    case "MapTypeAnnotation":
      return (
        findUnknownType(
          annotation.keyType,
          dataByName,
          choicesByName,
        ) ??
        findUnknownType(
          annotation.valueType,
          dataByName,
          choicesByName,
        )
      );

    case "OptionalTypeAnnotation":
      return findUnknownType(
        annotation.valueType,
        dataByName,
        choicesByName,
      );
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
