import type {
  Expression,
  FunctionDeclaration,
  FunctionStatement,
  TypeAnnotation,
} from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";
import {
  isPrimitiveTypeName,
  typeRef,
  typeRefFromAnnotation,
  type TypeRef,
} from "./types.js";
import type { DataDeclaration } from "./ast.js";

export type FunctionSignature = {
  readonly declaration: FunctionDeclaration;
  readonly parameters: readonly TypeRef[];
  readonly returnType: TypeRef;
};

export type FunctionTypeModel = {
  readonly functionsByName: ReadonlyMap<string, FunctionDeclaration>;
  readonly signaturesByName: ReadonlyMap<string, FunctionSignature>;
};

export function validateFunctions(
  functions: readonly FunctionDeclaration[],
  dataByName: ReadonlyMap<string, DataDeclaration>,
  diagnostics: Diagnostic[],
): FunctionTypeModel {
  const functionsByName = new Map<string, FunctionDeclaration>();
  const signaturesByName = new Map<string, FunctionSignature>();

  for (const fn of functions) {
    if (functionsByName.has(fn.name)) {
      diagnostics.push({
        code: "E2200",
        severity: "error",
        message: 'Function "' + fn.name + '" is declared more than once.',
        span: fn.span,
        help: "Give every function a unique name.",
      });
      continue;
    }

    functionsByName.set(fn.name, fn);
  }

  for (const fn of functionsByName.values()) {
    const parameterTypes: TypeRef[] = [];
    const parameterNames = new Set<string>();
    let signatureValid = true;

    for (const parameter of fn.parameters) {
      if (parameterNames.has(parameter.name)) {
        diagnostics.push({
          code: "E2201",
          severity: "error",
          message:
            'Parameter "' +
            parameter.name +
            '" is declared more than once in function "' +
            fn.name +
            '".',
          span: parameter.span,
          help: "Give each parameter a unique name.",
        });
      } else {
        parameterNames.add(parameter.name);
      }

      const resolved = resolveType(
        parameter.type,
        parameter.span,
        dataByName,
        diagnostics,
      );

      if (!resolved) {
        signatureValid = false;
      } else {
        parameterTypes.push(resolved);
      }
    }

    const returnType = resolveType(
      fn.returnType,
      fn.span,
      dataByName,
      diagnostics,
    );

    if (!returnType) {
      signatureValid = false;
    }

    if (signatureValid && returnType) {
      signaturesByName.set(fn.name, {
        declaration: fn,
        parameters: parameterTypes,
        returnType,
      });
    }
  }

  for (const signature of signaturesByName.values()) {
    validateFunctionBody(
      signature,
      signaturesByName,
      dataByName,
      diagnostics,
    );
  }

  return {
    functionsByName,
    signaturesByName,
  };
}

function validateFunctionBody(
  signature: FunctionSignature,
  signatures: ReadonlyMap<string, FunctionSignature>,
  dataByName: ReadonlyMap<string, DataDeclaration>,
  diagnostics: Diagnostic[],
): void {
  const env = new Map<string, TypeRef>();

  signature.declaration.parameters.forEach((parameter, index) => {
    const type = signature.parameters[index];
    if (type && !env.has(parameter.name)) {
      env.set(parameter.name, type);
    }
  });

  let hasReturn = false;

  for (const statement of signature.declaration.body) {
    validateFunctionStatement(
      statement,
      signature,
      env,
      signatures,
      dataByName,
      diagnostics,
    );

    if (statement.kind === "ReturnStatement") {
      hasReturn = true;
    }
  }

  if (!hasReturn) {
    diagnostics.push({
      code: "E2210",
      severity: "error",
      message:
        'Function "' +
        signature.declaration.name +
        '" does not return a value.',
      span: signature.declaration.span,
      help:
        "Add return <expression> producing " +
        describeType(signature.returnType) +
        ".",
    });
  }
}

function validateFunctionStatement(
  statement: FunctionStatement,
  signature: FunctionSignature,
  env: Map<string, TypeRef>,
  signatures: ReadonlyMap<string, FunctionSignature>,
  dataByName: ReadonlyMap<string, DataDeclaration>,
  diagnostics: Diagnostic[],
): void {
  if (statement.kind === "LetStatement") {
    const inferred = inferExpression(
      statement.expression,
      env,
      signatures,
      dataByName,
      diagnostics,
    );

    if (env.has(statement.name)) {
      diagnostics.push({
        code: "E2203",
        severity: "error",
        message:
          'Local "' +
          statement.name +
          '" is already defined in function "' +
          signature.declaration.name +
          '".',
        span: statement.span,
        help: "Choose a new local name.",
      });
      return;
    }

    if (inferred) {
      env.set(statement.name, inferred);
    }

    return;
  }

  const returned = inferExpression(
    statement.expression,
    env,
    signatures,
    dataByName,
    diagnostics,
  );

  if (returned && !sameType(returned, signature.returnType)) {
    diagnostics.push({
      code: "E2206",
      severity: "error",
      message:
        'Function "' +
        signature.declaration.name +
        '" returns ' +
        describeType(returned) +
        " but declares " +
        describeType(signature.returnType) +
        ".",
      span: statement.span,
      help: "Return an expression matching the declared return type.",
    });
  }
}

function inferExpression(
  expression: Expression,
  env: ReadonlyMap<string, TypeRef>,
  signatures: ReadonlyMap<string, FunctionSignature>,
  dataByName: ReadonlyMap<string, DataDeclaration>,
  diagnostics: Diagnostic[],
): TypeRef | undefined {
  switch (expression.kind) {
    case "NumberExpression":
      return typeRef("number");

    case "StringExpression":
      return typeRef("text");

    case "BooleanExpression":
      return typeRef("boolean");

    case "ListExpression": {
      if (expression.elements.length === 0) {
        diagnostics.push({
          code: "E2212",
          severity: "error",
          message: "Cannot infer the type of an empty list yet.",
          span: expression.span,
          help:
            "Add at least one element. Contextual empty-list typing is planned for M2.",
        });
        return undefined;
      }

      const first = inferExpression(
        expression.elements[0]!,
        env,
        signatures,
        dataByName,
        diagnostics,
      );

      if (!first) return undefined;

      let valid = true;

      for (const element of expression.elements.slice(1)) {
        const type = inferExpression(
          element,
          env,
          signatures,
          dataByName,
          diagnostics,
        );

        if (type && !sameType(type, first)) {
          diagnostics.push({
            code: "E2211",
            severity: "error",
            message:
              "List elements must share one type. Expected " +
              describeType(first) +
              " but found " +
              describeType(type) +
              ".",
            span: element.span,
            help: "Use elements with the same type.",
          });
          valid = false;
        }
      }

      return valid
        ? { kind: "List", elementType: first }
        : undefined;
    }

    case "IdentifierExpression": {
      const resolved = env.get(expression.name);

      if (!resolved) {
        diagnostics.push({
          code: "E2204",
          severity: "error",
          message: 'Unknown value "' + expression.name + '".',
          span: expression.span,
          help:
            "Declare it as a parameter or local before using it.",
        });
      }

      return resolved;
    }

    case "BinaryExpression": {
      const left = inferExpression(
        expression.left,
        env,
        signatures,
        dataByName,
        diagnostics,
      );
      const right = inferExpression(
        expression.right,
        env,
        signatures,
        dataByName,
        diagnostics,
      );

      if (!left || !right) return undefined;

      const numberType = typeRef("number");

      if (!sameType(left, numberType) || !sameType(right, numberType)) {
        diagnostics.push({
          code: "E2205",
          severity: "error",
          message:
            'Operator "' +
            expression.operator +
            '" currently requires number operands.',
          span: expression.span,
          help:
            "Use numeric expressions on both sides of the operator.",
        });
        return undefined;
      }

      return numberType;
    }

    case "CallExpression": {
      const callee = signatures.get(expression.callee);

      if (!callee) {
        diagnostics.push({
          code: "E2207",
          severity: "error",
          message: 'Unknown function "' + expression.callee + '".',
          span: expression.span,
          help: "Declare the function before calling it.",
        });

        for (const argument of expression.arguments) {
          inferExpression(
            argument,
            env,
            signatures,
            dataByName,
            diagnostics,
          );
        }

        return undefined;
      }

      if (expression.arguments.length !== callee.parameters.length) {
        diagnostics.push({
          code: "E2208",
          severity: "error",
          message:
            'Function "' +
            expression.callee +
            '" expects ' +
            callee.parameters.length +
            " argument(s) but received " +
            expression.arguments.length +
            ".",
          span: expression.span,
          help: "Pass exactly the declared number of arguments.",
        });
      }

      expression.arguments.forEach((argument, index) => {
        const actual = inferExpression(
          argument,
          env,
          signatures,
          dataByName,
          diagnostics,
        );
        const expected = callee.parameters[index];

        if (actual && expected && !sameType(actual, expected)) {
          diagnostics.push({
            code: "E2209",
            severity: "error",
            message:
              "Argument " +
              (index + 1) +
              ' of function "' +
              expression.callee +
              '" has type ' +
              describeType(actual) +
              " but expects " +
              describeType(expected) +
              ".",
            span: argument.span,
            help: "Pass a value matching the parameter type.",
          });
        }
      });

      return callee.returnType;
    }
  }
}

function resolveType(
  annotation: TypeAnnotation,
  span: FunctionDeclaration["span"],
  dataByName: ReadonlyMap<string, DataDeclaration>,
  diagnostics: Diagnostic[],
): TypeRef | undefined {
  const unknown = findUnknownType(annotation, dataByName);

  if (unknown) {
    diagnostics.push({
      code: "E2202",
      severity: "error",
      message: 'Unknown function type "' + unknown + '".',
      span,
      help:
        "Use a primitive type (text, number, boolean, id), list/optional composition, or a declared data type.",
    });
    return undefined;
  }

  return typeRefFromAnnotation(annotation);
}

function findUnknownType(
  annotation: TypeAnnotation,
  dataByName: ReadonlyMap<string, DataDeclaration>,
): string | undefined {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      return !isPrimitiveTypeName(annotation.name) &&
        !dataByName.has(annotation.name)
        ? annotation.name
        : undefined;

    case "ListTypeAnnotation":
      return findUnknownType(annotation.elementType, dataByName);

    case "OptionalTypeAnnotation":
      return findUnknownType(annotation.valueType, dataByName);
  }
}

function sameType(left: TypeRef, right: TypeRef): boolean {
  if (left.kind !== right.kind) return false;

  switch (left.kind) {
    case "Primitive":
    case "Named":
      return (
        right.kind === left.kind &&
        left.name === right.name
      );

    case "List":
      return (
        right.kind === "List" &&
        sameType(left.elementType, right.elementType)
      );

    case "Optional":
      return (
        right.kind === "Optional" &&
        sameType(left.valueType, right.valueType)
      );
  }
}

function describeType(type: TypeRef): string {
  switch (type.kind) {
    case "Primitive":
    case "Named":
      return type.name;
    case "List":
      return "list of " + describeType(type.elementType);
    case "Optional":
      return "optional " + describeType(type.valueType);
  }
}
