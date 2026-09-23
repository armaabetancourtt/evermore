import type {
  AgentDeclaration,
  ArrayDeclaration,
  ChoiceDeclaration,
  ClassDeclaration,
  ComponentDeclaration,
  ContextDeclaration,
  DataDeclaration,
  DatasetDeclaration,
  EvaluationDeclaration,
  MobileDeclaration,
  PipelineDeclaration,
  Program,
  PythonDeclaration,
  ProtocolDeclaration,
  ScreenDeclaration,
  ServerDeclaration,
  StateDeclaration,
  ToolDeclaration,
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
  readonly classesByName: ReadonlyMap<string, ClassDeclaration>;
  readonly protocolsByName: ReadonlyMap<string, ProtocolDeclaration>;
  readonly choicesByName: ReadonlyMap<string, ChoiceDeclaration>;
  readonly functionsByName: ReadonlyMap<string, Program["functions"][number]>;
  readonly functionSignaturesByName: ReadonlyMap<string, FunctionSignature>;
  readonly screensByName: ReadonlyMap<string, ScreenDeclaration>;
  readonly serversByName: ReadonlyMap<string, ServerDeclaration>;
  readonly toolsByName: ReadonlyMap<string, ToolDeclaration>;
  readonly contextsByName: ReadonlyMap<string, ContextDeclaration>;
  readonly agentsByName: ReadonlyMap<string, AgentDeclaration>;
  readonly evaluationsByName: ReadonlyMap<string, EvaluationDeclaration>;
  readonly mobilesByName: ReadonlyMap<string, MobileDeclaration>;
  readonly datasetsByName: ReadonlyMap<string, DatasetDeclaration>;
  readonly arraysByName: ReadonlyMap<string, ArrayDeclaration>;
  readonly pythonBridgesByName: ReadonlyMap<string, PythonDeclaration>;
  readonly pipelinesByName: ReadonlyMap<string, PipelineDeclaration>;
  readonly componentsByName: ReadonlyMap<string, ComponentDeclaration>;
};

export function analyze(program: Program): {
  readonly model?: SemanticModel;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const dataByName = new Map<string, DataDeclaration>();
  const classesByName = new Map<string, ClassDeclaration>();
  const protocolsByName = new Map<string, ProtocolDeclaration>();
  const choicesByName = new Map<string, ChoiceDeclaration>();
  const screens = new Map<string, ScreenDeclaration>();
  const servers = new Map<string, ServerDeclaration>();
  const tools = new Map<string, ToolDeclaration>();
  const contexts = new Map<string, ContextDeclaration>();
  const agents = new Map<string, AgentDeclaration>();
  const evaluations = new Map<string, EvaluationDeclaration>();
  const mobiles = new Map<string, MobileDeclaration>();
  const datasets = new Map<string, DatasetDeclaration>();
  const arrays = new Map<string, ArrayDeclaration>();
  const pythonBridges = new Map<string, PythonDeclaration>();
  const pipelines = new Map<string, PipelineDeclaration>();
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

  for (const declaration of program.classes) {
    if (isPrimitiveTypeName(declaration.name)) {
      diagnostics.push({
        code: "E2503",
        severity: "error",
        message:
          'Class "' +
          declaration.name +
          '" conflicts with a primitive type.',
        span: declaration.span,
        help: "Choose a non-primitive name for the class.",
      });
      continue;
    }

    if (
      dataByName.has(declaration.name) ||
      classesByName.has(declaration.name)
    ) {
      diagnostics.push({
        code: "E2500",
        severity: "error",
        message:
          'Class "' +
          declaration.name +
          '" conflicts with an existing nominal type.',
        span: declaration.span,
        help: "Give every data type and class a unique name.",
      });
      continue;
    }

    classesByName.set(declaration.name, declaration);
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

    if (dataByName.has(protocol.name) || classesByName.has(protocol.name)) {
      diagnostics.push({
        code: "E2402",
        severity: "error",
        message:
          'Protocol "' +
          protocol.name +
          '" conflicts with an existing nominal type.',
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

    if (
      dataByName.has(choice.name) ||
      classesByName.has(choice.name)
    ) {
      diagnostics.push({
        code: "E2302",
        severity: "error",
        message:
          'Choice type "' +
          choice.name +
          '" conflicts with an existing nominal type.',
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
        classesByName,
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
        classesByName,
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

  for (const declaration of program.classes) {
    const fieldNames = new Set<string>();

    for (const field of declaration.fields) {
      if (fieldNames.has(field.name)) {
        diagnostics.push({
          code: "E2501",
          severity: "error",
          message:
            'Class field "' +
            declaration.name +
            "." +
            field.name +
            '" is declared more than once.',
          span: field.span,
          help: "Give every class field a unique name.",
        });
      } else {
        fieldNames.add(field.name);
      }

      const unknownType = findUnknownType(
        field.type,
        dataByName,
        classesByName,
        choicesByName,
      );

      if (unknownType) {
        diagnostics.push({
          code: "E2502",
          severity: "error",
          message:
            'Class field "' +
            declaration.name +
            "." +
            field.name +
            '" references unknown type "' +
            unknownType +
            '".',
          span: field.type.span,
          help:
            "Use a primitive type or a declared data, class, or choice type.",
        });
      }
    }

    const methodNames = new Set<string>();

    for (const method of declaration.methods) {
      if (methodNames.has(method.name) || fieldNames.has(method.name)) {
        diagnostics.push({
          code: "E2411",
          severity: "error",
          message:
            'Class member "' +
            declaration.name +
            "." +
            method.name +
            '" is declared more than once or conflicts with a field.',
          span: method.span,
          help:
            "Give every class field and method a unique member name.",
        });
      } else {
        methodNames.add(method.name);
      }

      if (method.typeParameters.length > 0) {
        diagnostics.push({
          code: "E2413",
          severity: "error",
          message:
            'Class method "' +
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
              '" conflicts with class field "' +
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

  for (const declaration of program.classes) {
    const seen = new Set<string>();
    const fields = new Map(
      declaration.fields.map((field) => [field.name, field] as const),
    );
    const methods = new Map(
      declaration.methods.map((method) => [method.name, method] as const),
    );

    for (const conformance of declaration.conformances) {
      if (seen.has(conformance.name)) {
        diagnostics.push({
          code: "E2404",
          severity: "error",
          message:
            'Class "' +
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
            'Class "' +
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
              'Class "' +
              declaration.name +
              '" is missing field "' +
              required.name +
              '" required by protocol "' +
              protocol.name +
              '".',
            span: conformance.span,
            help: "Add the required public field.",
          });
          continue;
        }

        if (actual.visibility !== "public") {
          diagnostics.push({
            code: "E2506",
            severity: "error",
            message:
              'Class field "' +
              declaration.name +
              "." +
              required.name +
              '" is private but protocol "' +
              protocol.name +
              '" requires it publicly.',
            span: actual.span,
            help: "Make the field public or remove the conformance.",
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

      for (const required of protocol.methods) {
        const actual = methods.get(required.name);

        if (!actual) {
          diagnostics.push({
            code: "E2409",
            severity: "error",
            message:
              'Class "' +
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
    { dataByName, classesByName, protocolsByName, choicesByName },
    diagnostics,
  );

  for (const protocol of program.protocols) {
    validateFunctions(
      protocol.methods,
      { dataByName, classesByName, protocolsByName, choicesByName },
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
      { dataByName, classesByName, protocolsByName, choicesByName },
      diagnostics,
      {
        initialValues,
        bodyCallSignatures: functionTypes.signaturesByName,
      },
    );
  }

  for (const declaration of program.classes) {
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
      { dataByName, classesByName, protocolsByName, choicesByName },
      diagnostics,
      {
        initialValues,
        bodyCallSignatures: functionTypes.signaturesByName,
      },
    );
  }

  for (const server of program.servers) {
    if (servers.has(server.name)) {
      diagnostics.push({
        code: "E2700",
        severity: "error",
        message: 'Server "' + server.name + '" is declared more than once.',
        span: server.span,
        help: "Give each server a unique name.",
      });
      continue;
    }

    servers.set(server.name, server);

    if (
      !Number.isInteger(server.port) ||
      server.port < 1 ||
      server.port > 65535
    ) {
      diagnostics.push({
        code: "E2701",
        severity: "error",
        message:
          'Server "' +
          server.name +
          '" uses invalid port ' +
          server.port +
          ".",
        span: server.span,
        help: "Use an integer port between 1 and 65535.",
      });
    }

    const endpointKeys = new Set<string>();

    for (const endpoint of server.endpoints) {
      const key = endpoint.method + " " + endpoint.path;

      if (endpointKeys.has(key)) {
        diagnostics.push({
          code: "E2702",
          severity: "error",
          message: 'Endpoint "' + key + '" is declared more than once.',
          span: endpoint.span,
          help: "Keep each HTTP method/path pair unique per server.",
        });
      } else {
        endpointKeys.add(key);
      }

      const requestUnknown = endpoint.requestType
        ? findUnknownType(
            endpoint.requestType,
            dataByName,
            classesByName,
            choicesByName,
          )
        : undefined;
      const responseUnknown = findUnknownType(
        endpoint.responseType,
        dataByName,
        classesByName,
        choicesByName,
      );

      if (requestUnknown || responseUnknown) {
        diagnostics.push({
          code: "E2703",
          severity: "error",
          message:
            'Endpoint "' +
            key +
            '" references unknown contract type "' +
            (requestUnknown ?? responseUnknown) +
            '".',
          span: endpoint.span,
          help: "Declare the request/response type in Evermore first.",
        });
      }

      const handler = functionTypes.functionsByName.get(endpoint.handler);

      if (!handler) {
        diagnostics.push({
          code: "E2704",
          severity: "error",
          message:
            'Endpoint "' +
            key +
            '" uses unknown function "' +
            endpoint.handler +
            '".',
          span: endpoint.span,
          help: "Declare the handler as a top-level function.",
        });
        continue;
      }

      const expectedParameters = endpoint.requestType ? 1 : 0;

      if (handler.parameters.length !== expectedParameters) {
        diagnostics.push({
          code: "E2705",
          severity: "error",
          message:
            'Endpoint handler "' +
            handler.name +
            '" must take ' +
            expectedParameters +
            " request argument(s).",
          span: endpoint.span,
          help:
            "No-body endpoints use a zero-argument function; endpoints with takes <Type> use exactly one argument.",
        });
      } else if (
        endpoint.requestType &&
        handler.parameters[0] &&
        !sameTypeAnnotation(
          handler.parameters[0].type,
          endpoint.requestType,
        )
      ) {
        diagnostics.push({
          code: "E2706",
          severity: "error",
          message:
            'Endpoint handler "' +
            handler.name +
            '" request type does not match its takes contract.',
          span: endpoint.span,
          help: "Use the same Evermore type in the endpoint and handler.",
        });
      }

      if (!sameTypeAnnotation(handler.returnType, endpoint.responseType)) {
        diagnostics.push({
          code: "E2707",
          severity: "error",
          message:
            'Endpoint handler "' +
            handler.name +
            '" return type does not match the endpoint response contract.',
          span: endpoint.span,
          help: "Use the same returns type in the endpoint and handler.",
        });
      }
    }

    const databaseNames = new Set<string>();

    for (const database of server.databases) {
      if (databaseNames.has(database.name)) {
        diagnostics.push({
          code: "E2710",
          severity: "error",
          message:
            'Database "' +
            database.name +
            '" is declared more than once in server "' +
            server.name +
            '".',
          span: database.span,
          help: "Give each database a unique name.",
        });
      }
      databaseNames.add(database.name);
    }

    const repositoryNames = new Set<string>();

    for (const repository of server.repositories) {
      if (repositoryNames.has(repository.name)) {
        diagnostics.push({
          code: "E2711",
          severity: "error",
          message:
            'Repository "' +
            repository.name +
            '" is declared more than once.',
          span: repository.span,
          help: "Give each repository a unique name.",
        });
      }
      repositoryNames.add(repository.name);

      if (
        !dataByName.has(repository.modelName) &&
        !classesByName.has(repository.modelName)
      ) {
        diagnostics.push({
          code: "E2712",
          severity: "error",
          message:
            'Repository "' +
            repository.name +
            '" references unknown model "' +
            repository.modelName +
            '".',
          span: repository.span,
          help: "Repositories must target a declared data or class type.",
        });
      }

      if (!databaseNames.has(repository.databaseName)) {
        diagnostics.push({
          code: "E2713",
          severity: "error",
          message:
            'Repository "' +
            repository.name +
            '" references unknown database "' +
            repository.databaseName +
            '".',
          span: repository.span,
          help: "Declare the database before the repository.",
        });
      }
    }

    const jobNames = new Set<string>();

    for (const job of server.jobs) {
      if (jobNames.has(job.name)) {
        diagnostics.push({
          code: "E2720",
          severity: "error",
          message: 'Job "' + job.name + '" is declared more than once.',
          span: job.span,
          help: "Give each background job a unique name.",
        });
      }
      jobNames.add(job.name);

      const handler = functionTypes.functionsByName.get(job.handler);
      if (!handler) {
        diagnostics.push({
          code: "E2721",
          severity: "error",
          message:
            'Job "' +
            job.name +
            '" uses unknown function "' +
            job.handler +
            '".',
          span: job.span,
          help: "Declare the job handler as a top-level function.",
        });
      } else if (handler.parameters.length !== 0) {
        diagnostics.push({
          code: "E2722",
          severity: "error",
          message:
            'Job handler "' +
            job.handler +
            '" must take zero arguments.',
          span: job.span,
          help: "Background jobs are scheduled without request parameters.",
        });
      }
    }

    const realtimeNames = new Set<string>();

    for (const channel of server.realtime) {
      if (realtimeNames.has(channel.name)) {
        diagnostics.push({
          code: "E2730",
          severity: "error",
          message:
            'Realtime channel "' +
            channel.name +
            '" is declared more than once.',
          span: channel.span,
          help: "Give each realtime channel a unique name.",
        });
      }
      realtimeNames.add(channel.name);

      const unknown = findUnknownType(
        channel.messageType,
        dataByName,
        classesByName,
        choicesByName,
      );
      if (unknown) {
        diagnostics.push({
          code: "E2731",
          severity: "error",
          message:
            'Realtime channel "' +
            channel.name +
            '" references unknown message type "' +
            unknown +
            '".',
          span: channel.span,
          help: "Declare the realtime message contract first.",
        });
      }
    }
  }

  for (const tool of program.tools) {
    if (tools.has(tool.name)) {
      diagnostics.push({
        code: "E2800",
        severity: "error",
        message: 'Tool "' + tool.name + '" is declared more than once.',
        span: tool.span,
        help: "Give each tool a unique name.",
      });
      continue;
    }

    tools.set(tool.name, tool);

    const inputUnknown = tool.inputType
      ? findUnknownType(
          tool.inputType,
          dataByName,
          classesByName,
          choicesByName,
        )
      : undefined;
    const outputUnknown = findUnknownType(
      tool.outputType,
      dataByName,
      classesByName,
      choicesByName,
    );

    if (inputUnknown || outputUnknown) {
      diagnostics.push({
        code: "E2801",
        severity: "error",
        message:
          'Tool "' +
          tool.name +
          '" references unknown contract type "' +
          (inputUnknown ?? outputUnknown) +
          '".',
        span: tool.span,
        help: "Declare the tool input/output type first.",
      });
    }

    const handler = functionTypes.functionsByName.get(tool.handler);
    if (!handler) {
      diagnostics.push({
        code: "E2802",
        severity: "error",
        message:
          'Tool "' +
          tool.name +
          '" uses unknown function "' +
          tool.handler +
          '".',
        span: tool.span,
        help: "Declare the tool handler as a top-level function.",
      });
      continue;
    }

    const expectedParameters = tool.inputType ? 1 : 0;
    if (handler.parameters.length !== expectedParameters) {
      diagnostics.push({
        code: "E2803",
        severity: "error",
        message:
          'Tool handler "' +
          handler.name +
          '" must take ' +
          expectedParameters +
          " argument(s).",
        span: tool.span,
        help: "Match the tool takes contract exactly.",
      });
    } else if (
      tool.inputType &&
      handler.parameters[0] &&
      !sameTypeAnnotation(handler.parameters[0].type, tool.inputType)
    ) {
      diagnostics.push({
        code: "E2804",
        severity: "error",
        message:
          'Tool handler "' +
          handler.name +
          '" input type does not match tool "' +
          tool.name +
          '".',
        span: tool.span,
        help: "Use the same Evermore type in the tool and handler.",
      });
    }

    if (!sameTypeAnnotation(handler.returnType, tool.outputType)) {
      diagnostics.push({
        code: "E2805",
        severity: "error",
        message:
          'Tool handler "' +
          handler.name +
          '" return type does not match tool "' +
          tool.name +
          '".',
        span: tool.span,
        help: "Use the same returns type in the tool and handler.",
      });
    }
  }

  for (const context of program.contexts) {
    if (contexts.has(context.name)) {
      diagnostics.push({
        code: "E2810",
        severity: "error",
        message: 'Context "' + context.name + '" is declared more than once.',
        span: context.span,
        help: "Give each context declaration a unique name.",
      });
      continue;
    }

    contexts.set(context.name, context);

    if (!Number.isInteger(context.tokenBudget) || context.tokenBudget < 1) {
      diagnostics.push({
        code: "E2811",
        severity: "error",
        message:
          'Context "' +
          context.name +
          '" must use a positive integer token budget.',
        span: context.span,
        help: "Use budget <positive integer>.",
      });
    }

    const seenSources = new Set<string>();
    for (const source of context.includes) {
      if (seenSources.has(source)) {
        diagnostics.push({
          code: "E2812",
          severity: "error",
          message:
            'Context "' +
            context.name +
            '" includes source "' +
            source +
            '" more than once.',
          span: context.span,
          help: "Keep each context source once.",
        });
      }
      seenSources.add(source);
    }
  }

  for (const agent of program.agents) {
    if (agents.has(agent.name)) {
      diagnostics.push({
        code: "E2820",
        severity: "error",
        message: 'Agent "' + agent.name + '" is declared more than once.',
        span: agent.span,
        help: "Give each agent a unique name.",
      });
      continue;
    }

    agents.set(agent.name, agent);

    const inputUnknown = findUnknownType(
      agent.inputType,
      dataByName,
      classesByName,
      choicesByName,
    );
    const outputUnknown = findUnknownType(
      agent.outputType,
      dataByName,
      classesByName,
      choicesByName,
    );

    if (inputUnknown || outputUnknown) {
      diagnostics.push({
        code: "E2821",
        severity: "error",
        message:
          'Agent "' +
          agent.name +
          '" references unknown contract type "' +
          (inputUnknown ?? outputUnknown) +
          '".',
        span: agent.span,
        help: "Declare the agent input/output contract first.",
      });
    }

    if (agent.contextName && !contexts.has(agent.contextName)) {
      diagnostics.push({
        code: "E2822",
        severity: "error",
        message:
          'Agent "' +
          agent.name +
          '" references unknown context "' +
          agent.contextName +
          '".',
        span: agent.span,
        help: "Declare the context before the agent.",
      });
    }

    const seenTools = new Set<string>();
    for (const toolName of agent.tools) {
      if (!tools.has(toolName)) {
        diagnostics.push({
          code: "E2823",
          severity: "error",
          message:
            'Agent "' +
            agent.name +
            '" references unknown tool "' +
            toolName +
            '".',
          span: agent.span,
          help: "Declare the tool before using it from an agent.",
        });
      }

      if (seenTools.has(toolName)) {
        diagnostics.push({
          code: "E2824",
          severity: "error",
          message:
            'Agent "' +
            agent.name +
            '" includes tool "' +
            toolName +
            '" more than once.',
          span: agent.span,
          help: "Keep each tool capability once.",
        });
      }
      seenTools.add(toolName);
    }

    for (const toolName of agent.approvalTools) {
      if (!seenTools.has(toolName)) {
        diagnostics.push({
          code: "E2825",
          severity: "error",
          message:
            'Agent "' +
            agent.name +
            '" requires approval for tool "' +
            toolName +
            '" but does not have that tool.',
          span: agent.span,
          help: "List the tool with tool <Name> before adding approval.",
        });
      }
    }

    if (!Number.isInteger(agent.tokenBudget) || agent.tokenBudget < 1) {
      diagnostics.push({
        code: "E2826",
        severity: "error",
        message:
          'Agent "' +
          agent.name +
          '" must use a positive integer token budget.',
        span: agent.span,
        help: "Use budget tokens <positive integer>.",
      });
    }

    if (
      agent.costBudget !== undefined &&
      (!Number.isFinite(agent.costBudget) || agent.costBudget < 0)
    ) {
      diagnostics.push({
        code: "E2827",
        severity: "error",
        message:
          'Agent "' +
          agent.name +
          '" uses an invalid cost budget.',
        span: agent.span,
        help: "Use a non-negative numeric cost budget.",
      });
    }
  }

  for (const evaluation of program.evaluations) {
    if (evaluations.has(evaluation.name)) {
      diagnostics.push({
        code: "E2830",
        severity: "error",
        message:
          'Evaluation "' +
          evaluation.name +
          '" is declared more than once.',
        span: evaluation.span,
        help: "Give each evaluation a unique name.",
      });
      continue;
    }

    evaluations.set(evaluation.name, evaluation);

    const agent = agents.get(evaluation.agentName);
    if (!agent) {
      diagnostics.push({
        code: "E2831",
        severity: "error",
        message:
          'Evaluation "' +
          evaluation.name +
          '" references unknown agent "' +
          evaluation.agentName +
          '".',
        span: evaluation.span,
        help: "Declare the agent before its evaluation.",
      });
      continue;
    }

    const inputFixture = functionTypes.functionsByName.get(
      evaluation.inputFunction,
    );
    const expectedFixture = functionTypes.functionsByName.get(
      evaluation.expectedFunction,
    );

    if (!inputFixture) {
      diagnostics.push({
        code: "E2832",
        severity: "error",
        message:
          'Evaluation input fixture "' +
          evaluation.inputFunction +
          '" does not exist.',
        span: evaluation.span,
        help: "Use a zero-argument top-level function returning the agent input type.",
      });
    } else if (
      inputFixture.parameters.length !== 0 ||
      !sameTypeAnnotation(inputFixture.returnType, agent.inputType)
    ) {
      diagnostics.push({
        code: "E2833",
        severity: "error",
        message:
          'Evaluation input fixture "' +
          inputFixture.name +
          '" must take zero arguments and return the agent input type.',
        span: evaluation.span,
      });
    }

    if (!expectedFixture) {
      diagnostics.push({
        code: "E2834",
        severity: "error",
        message:
          'Evaluation expected fixture "' +
          evaluation.expectedFunction +
          '" does not exist.',
        span: evaluation.span,
        help: "Use a zero-argument top-level function returning the agent output type.",
      });
    } else if (
      expectedFixture.parameters.length !== 0 ||
      !sameTypeAnnotation(expectedFixture.returnType, agent.outputType)
    ) {
      diagnostics.push({
        code: "E2835",
        severity: "error",
        message:
          'Evaluation expected fixture "' +
          expectedFixture.name +
          '" must take zero arguments and return the agent output type.',
        span: evaluation.span,
      });
    }
  }

  for (const mobile of program.mobiles) {
    if (mobiles.has(mobile.name)) {
      diagnostics.push({
        code: "E2900",
        severity: "error",
        message: 'Mobile target "' + mobile.name + '" is declared more than once.',
        span: mobile.span,
        help: "Give each mobile declaration a unique name.",
      });
      continue;
    }

    mobiles.set(mobile.name, mobile);

    const permissions = new Set<string>();
    for (const permission of mobile.permissions) {
      if (permissions.has(permission)) {
        diagnostics.push({
          code: "E2901",
          severity: "error",
          message:
            'Mobile target "' +
            mobile.name +
            '" declares permission "' +
            permission +
            '" more than once.',
          span: mobile.span,
          help: "Keep each mobile permission once.",
        });
      }
      permissions.add(permission);
    }

    const boundaries = new Set<string>();
    for (const platform of mobile.nativeExtensions) {
      if (boundaries.has(platform)) {
        diagnostics.push({
          code: "E2902",
          severity: "error",
          message:
            'Mobile target "' +
            mobile.name +
            '" declares native boundary "' +
            platform +
            '" more than once.',
          span: mobile.span,
          help: "Keep each native specialization boundary once.",
        });
      }
      boundaries.add(platform);
    }

    if (program.screens.length === 0) {
      diagnostics.push({
        code: "E2903",
        severity: "error",
        message:
          'Mobile target "' +
          mobile.name +
          '" requires at least one screen.',
        span: mobile.span,
        help: "Declare a screen shared by the web/mobile semantic model.",
      });
    }
  }

  for (const dataset of program.datasets) {
    if (datasets.has(dataset.name)) {
      diagnostics.push({
        code: "E3000",
        severity: "error",
        message: 'Dataset "' + dataset.name + '" is declared more than once.',
        span: dataset.span,
        help: "Give each dataset a unique name.",
      });
      continue;
    }

    datasets.set(dataset.name, dataset);

    if (
      !dataByName.has(dataset.rowType) &&
      !classesByName.has(dataset.rowType)
    ) {
      diagnostics.push({
        code: "E3001",
        severity: "error",
        message:
          'Dataset "' +
          dataset.name +
          '" references unknown row type "' +
          dataset.rowType +
          '".',
        span: dataset.span,
        help: "Dataset rows must use a declared data or class type.",
      });
    }

    if (dataset.source.trim().length === 0) {
      diagnostics.push({
        code: "E3002",
        severity: "error",
        message: 'Dataset "' + dataset.name + '" has an empty source.',
        span: dataset.span,
        help: "Declare a reproducible source path or URI.",
      });
    }
  }

  for (const array of program.arrays) {
    if (arrays.has(array.name)) {
      diagnostics.push({
        code: "E3010",
        severity: "error",
        message: 'Array "' + array.name + '" is declared more than once.',
        span: array.span,
        help: "Give each numerical array declaration a unique name.",
      });
      continue;
    }

    arrays.set(array.name, array);

    if (!/^(?:\*|[1-9][0-9]*)(?:,(?:\*|[1-9][0-9]*))*$/.test(array.shape)) {
      diagnostics.push({
        code: "E3011",
        severity: "error",
        message:
          'Array "' +
          array.name +
          '" uses invalid shape "' +
          array.shape +
          '".',
        span: array.span,
        help: 'Use comma-separated positive dimensions and at most symbolic "*" dimensions, for example "*,3".',
      });
    }
  }

  for (const bridge of program.pythonBridges) {
    if (pythonBridges.has(bridge.name)) {
      diagnostics.push({
        code: "E3020",
        severity: "error",
        message:
          'Python bridge "' +
          bridge.name +
          '" is declared more than once.',
        span: bridge.span,
        help: "Give each Python bridge a unique name.",
      });
      continue;
    }

    pythonBridges.set(bridge.name, bridge);

    const inputUnknown = bridge.inputType
      ? findUnknownType(
          bridge.inputType,
          dataByName,
          classesByName,
          choicesByName,
        )
      : undefined;
    const outputUnknown = findUnknownType(
      bridge.outputType,
      dataByName,
      classesByName,
      choicesByName,
    );

    if (inputUnknown || outputUnknown) {
      diagnostics.push({
        code: "E3021",
        severity: "error",
        message:
          'Python bridge "' +
          bridge.name +
          '" references unknown contract type "' +
          (inputUnknown ?? outputUnknown) +
          '".',
        span: bridge.span,
        help: "Use ordinary declared Evermore types at the Python boundary.",
      });
    }

    if (
      bridge.moduleName.trim().length === 0 ||
      bridge.callableName.trim().length === 0
    ) {
      diagnostics.push({
        code: "E3022",
        severity: "error",
        message:
          'Python bridge "' +
          bridge.name +
          '" requires non-empty module and callable names.',
        span: bridge.span,
      });
    }
  }

  for (const pipeline of program.pipelines) {
    if (pipelines.has(pipeline.name)) {
      diagnostics.push({
        code: "E3030",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" is declared more than once.',
        span: pipeline.span,
        help: "Give each pipeline a unique name.",
      });
      continue;
    }

    pipelines.set(pipeline.name, pipeline);

    const dataset = datasets.get(pipeline.datasetName);
    if (!dataset) {
      diagnostics.push({
        code: "E3031",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" references unknown dataset "' +
          pipeline.datasetName +
          '".',
        span: pipeline.span,
        help: "Declare the dataset before the pipeline.",
      });
    }

    const train = pythonBridges.get(pipeline.trainBridge);
    if (!train) {
      diagnostics.push({
        code: "E3032",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" references unknown training bridge "' +
          pipeline.trainBridge +
          '".',
        span: pipeline.span,
      });
    }

    const evaluate = pythonBridges.get(pipeline.evaluateBridge);
    if (!evaluate) {
      diagnostics.push({
        code: "E3033",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" references unknown evaluation bridge "' +
          pipeline.evaluateBridge +
          '".',
        span: pipeline.span,
      });
    }

    if (dataset && train) {
      const input = train.inputType;
      const validInput =
        input?.kind === "ListTypeAnnotation" &&
        input.elementType.kind === "NamedTypeAnnotation" &&
        input.elementType.name === dataset.rowType;

      if (!validInput) {
        diagnostics.push({
          code: "E3034",
          severity: "error",
          message:
            'Training bridge "' +
            train.name +
            '" must take list of ' +
            dataset.rowType +
            ' for pipeline "' +
            pipeline.name +
            '".',
          span: pipeline.span,
          help: "Make the training bridge input match the dataset row contract.",
        });
      }
    }

    if (train && evaluate) {
      if (
        !evaluate.inputType ||
        !sameTypeAnnotation(
          evaluate.inputType,
          train.outputType,
        )
      ) {
        diagnostics.push({
          code: "E3035",
          severity: "error",
          message:
            'Evaluation bridge "' +
            evaluate.name +
            '" must take the training output type produced by "' +
            train.name +
            '".',
          span: pipeline.span,
          help: "Connect train/evaluate through one exact Evermore type.",
        });
      }
    }

    if (
      !Number.isInteger(pipeline.seed) ||
      pipeline.seed < 0
    ) {
      diagnostics.push({
        code: "E3036",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" must use a non-negative integer seed.',
        span: pipeline.span,
      });
    }

    if (pipeline.tracking.trim().length === 0) {
      diagnostics.push({
        code: "E3037",
        severity: "error",
        message:
          'Pipeline "' +
          pipeline.name +
          '" requires a non-empty tracking path.',
        span: pipeline.span,
      });
    }
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
            classesByName,
            protocolsByName,
            choicesByName,
            functionsByName: functionTypes.functionsByName,
            functionSignaturesByName: functionTypes.signaturesByName,
            screensByName: screens,
            serversByName: servers,
            toolsByName: tools,
            contextsByName: contexts,
            agentsByName: agents,
            evaluationsByName: evaluations,
            mobilesByName: mobiles,
            datasetsByName: datasets,
            arraysByName: arrays,
            pythonBridgesByName: pythonBridges,
            pipelinesByName: pipelines,
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

    case "ResultTypeAnnotation":
      return (
        right.kind === "ResultTypeAnnotation" &&
        sameTypeAnnotation(left.okType, right.okType) &&
        sameTypeAnnotation(left.errorType, right.errorType)
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
  classesByName: ReadonlyMap<string, ClassDeclaration>,
  choicesByName: ReadonlyMap<string, ChoiceDeclaration>,
): string | undefined {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      return !isPrimitiveTypeName(annotation.name) &&
        !dataByName.has(annotation.name) &&
        !classesByName.has(annotation.name) &&
        !choicesByName.has(annotation.name)
        ? annotation.name
        : undefined;

    case "ListTypeAnnotation":
    case "SetTypeAnnotation":
      return findUnknownType(
        annotation.elementType,
        dataByName,
        classesByName,
        choicesByName,
      );

    case "MapTypeAnnotation":
      return (
        findUnknownType(
          annotation.keyType,
          dataByName,
          classesByName,
          choicesByName,
        ) ??
        findUnknownType(
          annotation.valueType,
          dataByName,
          classesByName,
          choicesByName,
        )
      );

    case "ResultTypeAnnotation":
      return (
        findUnknownType(
          annotation.okType,
          dataByName,
          classesByName,
          choicesByName,
        ) ??
        findUnknownType(
          annotation.errorType,
          dataByName,
          classesByName,
          choicesByName,
        )
      );

    case "OptionalTypeAnnotation":
      return findUnknownType(
        annotation.valueType,
        dataByName,
        classesByName,
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
