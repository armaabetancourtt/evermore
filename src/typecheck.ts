import type {
  ChoiceDeclaration,
  DataDeclaration,
  Expression,
  FunctionDeclaration,
  FunctionStatement,
  ProtocolDeclaration,
  TypeAnnotation,
} from "./ast.js";
import type { Diagnostic } from "./diagnostics.js";
import {
  isPrimitiveTypeName,
  typeRef,
  typeRefFromAnnotation,
  type TypeRef,
} from "./types.js";

export type FunctionSignature = {
  readonly declaration: FunctionDeclaration;
  readonly typeParameters: readonly string[];
  readonly typeParameterConstraints: ReadonlyMap<string, string>;
  readonly parameters: readonly TypeRef[];
  readonly returnType: TypeRef;
};

export type FunctionTypeModel = {
  readonly functionsByName: ReadonlyMap<string, FunctionDeclaration>;
  readonly signaturesByName: ReadonlyMap<string, FunctionSignature>;
};

export type NamedTypeContext = {
  readonly dataByName: ReadonlyMap<string, DataDeclaration>;
  readonly protocolsByName: ReadonlyMap<string, ProtocolDeclaration>;
  readonly choicesByName: ReadonlyMap<string, ChoiceDeclaration>;
  readonly genericConstraints?: ReadonlyMap<string, string>;
};

export function validateFunctions(
  functions: readonly FunctionDeclaration[],
  types: NamedTypeContext,
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
    const genericNames = new Set<string>();
    const genericConstraints = new Map<string, string>();
    let signatureValid = true;

    for (const parameter of fn.typeParameters) {
      if (genericNames.has(parameter.name)) {
        diagnostics.push({
          code: "E2220",
          severity: "error",
          message:
            'Generic type "' +
            parameter.name +
            '" is declared more than once in function "' +
            fn.name +
            '".',
          span: parameter.span,
          help: "Give each generic type parameter a unique name.",
        });
        signatureValid = false;
        continue;
      }

      if (
        isPrimitiveTypeName(parameter.name) ||
        types.dataByName.has(parameter.name) ||
        types.protocolsByName.has(parameter.name) ||
        types.choicesByName.has(parameter.name)
      ) {
        diagnostics.push({
          code: "E2221",
          severity: "error",
          message:
            'Generic type "' +
            parameter.name +
            '" conflicts with an existing type name.',
          span: parameter.span,
          help: "Choose a fresh generic type parameter name such as T or Value.",
        });
        signatureValid = false;
        continue;
      }

      genericNames.add(parameter.name);

      if (parameter.constraint) {
        const protocol = types.protocolsByName.get(
          parameter.constraint.name,
        );

        if (!protocol) {
          diagnostics.push({
            code: "E2223",
            severity: "error",
            message:
              'Generic type "' +
              parameter.name +
              '" in function "' +
              fn.name +
              '" conforms to unknown protocol "' +
              parameter.constraint.name +
              '".',
            span: parameter.constraint.span,
            help:
              "Declare the protocol before using it as a generic constraint.",
          });
          signatureValid = false;
        } else {
          genericConstraints.set(parameter.name, protocol.name);
        }
      }
    }

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
        types,
        diagnostics,
        genericNames,
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
      types,
      diagnostics,
      genericNames,
    );

    if (!returnType) {
      signatureValid = false;
    }

    if (signatureValid && returnType) {
      signaturesByName.set(fn.name, {
        declaration: fn,
        typeParameters: [...genericNames],
        typeParameterConstraints: genericConstraints,
        parameters: parameterTypes,
        returnType,
      });
    }
  }

  for (const signature of signaturesByName.values()) {
    validateFunctionBody(
      signature,
      signaturesByName,
      types,
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
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
): void {
  const env = new Map<string, TypeRef>();
  const scopedTypes: NamedTypeContext = {
    ...types,
    genericConstraints: signature.typeParameterConstraints,
  };

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
      scopedTypes,
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
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
): void {
  if (statement.kind === "LetStatement") {
    const inferred = inferExpression(
      statement.expression,
      env,
      signatures,
      types,
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
    types,
    diagnostics,
    signature.returnType,
  );

  if (
    returned &&
    !isAssignable(returned, signature.returnType, types)
  ) {
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
      help: "Return an expression assignable to the declared return type.",
    });
  }
}

function inferExpression(
  expression: Expression,
  env: ReadonlyMap<string, TypeRef>,
  signatures: ReadonlyMap<string, FunctionSignature>,
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
  expected?: TypeRef,
): TypeRef | undefined {
  switch (expression.kind) {
    case "NumberExpression":
      return typeRef("number");

    case "StringExpression":
      return typeRef("text");

    case "BooleanExpression":
      return typeRef("boolean");

    case "NoneExpression":
      return { kind: "None" };

    case "MatchExpression": {
      const valueType = inferExpression(
        expression.value,
        env,
        signatures,
        types,
        diagnostics,
      );

      const choice =
        valueType?.kind === "Named"
          ? types.choicesByName.get(valueType.name)
          : undefined;

      if (valueType && !choice) {
        diagnostics.push({
          code: "E2310",
          severity: "error",
          message:
            "Match requires a choice value, but found " +
            describeType(valueType) +
            ".",
          span: expression.value.span,
          help: "Match over a declared choice type.",
        });
      }

      const seen = new Set<string>();
      let resultType: TypeRef | undefined;
      let branchesCompatible = true;

      for (const branch of expression.cases) {
        if (seen.has(branch.caseName)) {
          diagnostics.push({
            code: "E2312",
            severity: "error",
            message:
              'Match case "' +
              branch.caseName +
              '" is handled more than once.',
            span: branch.span,
            help: "Keep exactly one branch for each choice case.",
          });
        } else {
          seen.add(branch.caseName);
        }

        if (
          choice &&
          !choice.cases.some((item) => item.name === branch.caseName)
        ) {
          diagnostics.push({
            code: "E2311",
            severity: "error",
            message:
              'Choice "' +
              choice.name +
              '" has no case "' +
              branch.caseName +
              '" in this match.',
            span: branch.span,
            help:
              "Use one of: " +
              choice.cases.map((item) => item.name).join(", ") +
              ".",
          });
        }

        const branchType = inferExpression(
          branch.expression,
          env,
          signatures,
          types,
          diagnostics,
          expected,
        );

        if (!branchType) continue;

        if (!resultType) {
          resultType = branchType;
          continue;
        }

        const merged = commonType(resultType, branchType, types);

        if (!merged) {
          diagnostics.push({
            code: "E2313",
            severity: "error",
            message:
              "Match branches must have compatible types. Found " +
              describeType(resultType) +
              " and " +
              describeType(branchType) +
              ".",
            span: branch.span,
            help:
              "Return compatible values from every match branch.",
          });
          branchesCompatible = false;
          continue;
        }

        resultType = merged;
      }

      if (choice) {
        const missing = choice.cases
          .map((item) => item.name)
          .filter((name) => !seen.has(name));

        if (missing.length > 0) {
          diagnostics.push({
            code: "E2314",
            severity: "error",
            message:
              'Match over choice "' +
              choice.name +
              '" is not exhaustive. Missing: ' +
              missing.join(", ") +
              ".",
            span: expression.span,
            help:
              "Add one case branch for every missing choice case.",
          });
        }
      }

      return branchesCompatible ? resultType : undefined;
    }

    case "MemberExpression": {
      if (expression.object.kind === "IdentifierExpression") {
        const choice = types.choicesByName.get(
          expression.object.name,
        );

        if (choice) {
          if (
            !choice.cases.some(
              (item) => item.name === expression.member,
            )
          ) {
            diagnostics.push({
              code: "E2305",
              severity: "error",
              message:
                'Choice "' +
                choice.name +
                '" has no case "' +
                expression.member +
                '".',
              span: expression.span,
              help:
                "Use one of: " +
                choice.cases.map((item) => item.name).join(", ") +
                ".",
            });
            return undefined;
          }

          return {
            kind: "Named",
            name: choice.name,
          };
        }
      }

      const objectType = inferExpression(
        expression.object,
        env,
        signatures,
        types,
        diagnostics,
      );

      if (!objectType) return undefined;

      if (objectType.kind === "Optional") {
        diagnostics.push({
          code: "E2322",
          severity: "error",
          message:
            'Cannot access member "' +
            expression.member +
            '" through optional ' +
            describeType(objectType) +
            ".",
          span: expression.span,
          help:
            "Resolve the optional value before accessing its members.",
        });
        return undefined;
      }

      const owner =
        objectType.kind === "Named"
          ? types.dataByName.get(objectType.name)
          : objectType.kind === "Protocol"
            ? types.protocolsByName.get(objectType.name)
            : objectType.kind === "Generic"
              ? types.protocolsByName.get(
                  types.genericConstraints?.get(objectType.name) ?? "",
                )
              : undefined;

      if (!owner) {
        diagnostics.push({
          code: "E2320",
          severity: "error",
          message:
            'Type "' +
            describeType(objectType) +
            '" does not expose data members.',
          span: expression.span,
          help:
            "Member access is currently supported on data and protocol values.",
        });
        return undefined;
      }

      const field = owner.fields.find(
        (item) => item.name === expression.member,
      );

      if (!field) {
        diagnostics.push({
          code: "E2321",
          severity: "error",
          message:
            'Type "' +
            objectType.name +
            '" has no member "' +
            expression.member +
            '".',
          span: expression.span,
          help:
            "Use a field declared by the data type or protocol contract.",
        });
        return undefined;
      }

      return typeRefFromAnnotation(
        field.type,
        new Set(),
        new Set(types.protocolsByName.keys()),
      );
    }

    case "ChoiceCaseExpression": {
      const choice = types.choicesByName.get(expression.choiceName);

      if (!choice) {
        diagnostics.push({
          code: "E2304",
          severity: "error",
          message:
            'Unknown choice type "' + expression.choiceName + '".',
          span: expression.span,
          help: "Declare the choice type before using one of its cases.",
        });
        return undefined;
      }

      if (!choice.cases.some((item) => item.name === expression.caseName)) {
        diagnostics.push({
          code: "E2305",
          severity: "error",
          message:
            'Choice "' +
            expression.choiceName +
            '" has no case "' +
            expression.caseName +
            '".',
          span: expression.span,
          help:
            "Use one of: " +
            choice.cases.map((item) => item.name).join(", ") +
            ".",
        });
        return undefined;
      }

      return {
        kind: "Named",
        name: expression.choiceName,
      };
    }

    case "ListExpression": {
      const expectedElement =
        expected?.kind === "List" ? expected.elementType : undefined;

      if (expression.elements.length === 0) {
        if (expected?.kind === "List") {
          return expected;
        }

        diagnostics.push({
          code: "E2212",
          severity: "error",
          message:
            "Cannot infer the type of an empty list without context.",
          span: expression.span,
          help:
            "Use the empty list where a list type is already expected, or add at least one element.",
        });
        return undefined;
      }

      const first = inferExpression(
        expression.elements[0]!,
        env,
        signatures,
        types,
        diagnostics,
        expectedElement,
      );

      if (!first) return undefined;

      let common = first;
      let valid = true;

      for (const element of expression.elements.slice(1)) {
        const elementType = inferExpression(
          element,
          env,
          signatures,
          types,
          diagnostics,
          expectedElement,
        );

        if (!elementType) {
          valid = false;
          continue;
        }

        const merged = commonType(common, elementType, types);

        if (!merged) {
          diagnostics.push({
            code: "E2211",
            severity: "error",
            message:
              "List elements do not have a compatible common type. Found " +
              describeType(common) +
              " and " +
              describeType(elementType) +
              ".",
            span: element.span,
            help:
              "Use compatible elements. A value and none may combine into an optional type.",
          });
          valid = false;
          continue;
        }

        common = merged;
      }

      return valid
        ? { kind: "List", elementType: common }
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
          help: "Declare it as a parameter or local before using it.",
        });
      }

      return resolved;
    }

    case "IfExpression": {
      const condition = inferExpression(
        expression.condition,
        env,
        signatures,
        types,
        diagnostics,
      );
      const thenType = inferExpression(
        expression.thenExpression,
        env,
        signatures,
        types,
        diagnostics,
        expected,
      );
      const elseType = inferExpression(
        expression.elseExpression,
        env,
        signatures,
        types,
        diagnostics,
        expected,
      );

      const booleanType = typeRef("boolean");

      if (condition && !sameType(condition, booleanType)) {
        diagnostics.push({
          code: "E2213",
          severity: "error",
          message:
            "If condition must be boolean, but found " +
            describeType(condition) +
            ".",
          span: expression.condition.span,
          help: "Use a boolean expression or comparison as the condition.",
        });
      }

      if (!thenType || !elseType) return undefined;

      const merged = commonType(thenType, elseType, types);

      if (!merged) {
        diagnostics.push({
          code: "E2214",
          severity: "error",
          message:
            "If branches must have compatible types. Found " +
            describeType(thenType) +
            " and " +
            describeType(elseType) +
            ".",
          span: expression.span,
          help:
            "Return compatible values from both branches. A value and none may form an optional type.",
        });
        return undefined;
      }

      return merged;
    }

    case "BinaryExpression": {
      const left = inferExpression(
        expression.left,
        env,
        signatures,
        types,
        diagnostics,
      );
      const right = inferExpression(
        expression.right,
        env,
        signatures,
        types,
        diagnostics,
      );

      if (!left || !right) return undefined;

      const numberType = typeRef("number");
      const booleanType = typeRef("boolean");

      if (
        expression.operator === "+" ||
        expression.operator === "-" ||
        expression.operator === "*" ||
        expression.operator === "/"
      ) {
        if (!sameType(left, numberType) || !sameType(right, numberType)) {
          diagnostics.push({
            code: "E2205",
            severity: "error",
            message:
              'Operator "' +
              expression.operator +
              '" requires number operands.',
            span: expression.span,
            help: "Use numeric expressions on both sides of the operator.",
          });
          return undefined;
        }

        return numberType;
      }

      if (
        expression.operator === ">" ||
        expression.operator === ">=" ||
        expression.operator === "<" ||
        expression.operator === "<="
      ) {
        if (!sameType(left, numberType) || !sameType(right, numberType)) {
          diagnostics.push({
            code: "E2215",
            severity: "error",
            message:
              'Ordering operator "' +
              expression.operator +
              '" requires number operands.',
            span: expression.span,
            help: "Compare numeric expressions with ordering operators.",
          });
          return undefined;
        }

        return booleanType;
      }

      if (
        !sameType(left, right) &&
        !isAssignable(left, right, types) &&
        !isAssignable(right, left, types)
      ) {
        diagnostics.push({
          code: "E2216",
          severity: "error",
          message:
            'Equality operator "' +
            expression.operator +
            '" cannot compare ' +
            describeType(left) +
            " with " +
            describeType(right) +
            ".",
          span: expression.span,
          help: "Compare values with compatible types.",
        });
        return undefined;
      }

      return booleanType;
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
            types,
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

      const bindings = new Map<string, TypeRef>();

      expression.arguments.forEach((argument, index) => {
        const parameterType = callee.parameters[index];
        const contextualExpected = parameterType
          ? substituteGenerics(parameterType, bindings)
          : undefined;

        const actual = inferExpression(
          argument,
          env,
          signatures,
          types,
          diagnostics,
          contextualExpected,
        );

        if (!actual || !parameterType) return;

        const compatible = bindGenericTypes(
          parameterType,
          actual,
          bindings,
          types,
        );

        if (!compatible) {
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
              describeType(substituteGenerics(parameterType, bindings)) +
              ".",
            span: argument.span,
            help: "Pass a value assignable to the parameter type.",
          });
        }
      });

      if (expected) {
        bindGenericTypes(
          callee.returnType,
          expected,
          bindings,
          types,
        );
      }

      const unresolved = callee.typeParameters.filter(
        (name) => !bindings.has(name),
      );

      if (unresolved.length > 0) {
        diagnostics.push({
          code: "E2222",
          severity: "error",
          message:
            'Cannot infer generic type ' +
            unresolved.map((name) => '"' + name + '"').join(", ") +
            ' for function "' +
            expression.callee +
            '".',
          span: expression.span,
          help:
            "Pass arguments that determine every generic type, or use the call where its result type provides context.",
        });
        return undefined;
      }

      let constraintsValid = true;

      for (const [typeParameter, protocolName] of callee.typeParameterConstraints) {
        const actual = bindings.get(typeParameter);

        if (
          actual &&
          !isAssignable(
            actual,
            { kind: "Protocol", name: protocolName },
            types,
          )
        ) {
          diagnostics.push({
            code: "E2224",
            severity: "error",
            message:
              "Generic type " +
              describeType(actual) +
              ' does not conform to protocol "' +
              protocolName +
              '" required by function "' +
              expression.callee +
              '".',
            span: expression.span,
            help:
              "Pass a conforming data value or propagate the same protocol constraint on the calling generic.",
          });
          constraintsValid = false;
        }
      }

      if (!constraintsValid) return undefined;

      return substituteGenerics(callee.returnType, bindings);
    }
  }
}

function resolveType(
  annotation: TypeAnnotation,
  span: FunctionDeclaration["span"],
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
  genericNames: ReadonlySet<string>,
): TypeRef | undefined {
  const unknown = findUnknownType(
    annotation,
    types,
    genericNames,
  );

  if (unknown) {
    diagnostics.push({
      code: "E2202",
      severity: "error",
      message: 'Unknown function type "' + unknown + '".',
      span,
      help:
        "Use a primitive type, list/optional composition, or a declared data/choice type.",
    });
    return undefined;
  }

  return typeRefFromAnnotation(
    annotation,
    genericNames,
    new Set(types.protocolsByName.keys()),
  );
}

function findUnknownType(
  annotation: TypeAnnotation,
  types: NamedTypeContext,
  genericNames: ReadonlySet<string>,
): string | undefined {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      return !genericNames.has(annotation.name) &&
        !isPrimitiveTypeName(annotation.name) &&
        !types.dataByName.has(annotation.name) &&
        !types.protocolsByName.has(annotation.name) &&
        !types.choicesByName.has(annotation.name)
        ? annotation.name
        : undefined;

    case "ListTypeAnnotation":
      return findUnknownType(
        annotation.elementType,
        types,
        genericNames,
      );

    case "OptionalTypeAnnotation":
      return findUnknownType(
        annotation.valueType,
        types,
        genericNames,
      );
  }
}

function bindGenericTypes(
  pattern: TypeRef,
  actual: TypeRef,
  bindings: Map<string, TypeRef>,
  types: NamedTypeContext,
): boolean {
  if (pattern.kind === "Generic") {
    const existing = bindings.get(pattern.name);

    if (!existing) {
      bindings.set(pattern.name, actual);
      return true;
    }

    return sameType(existing, actual);
  }

  if (pattern.kind === "List") {
    return (
      actual.kind === "List" &&
      bindGenericTypes(
        pattern.elementType,
        actual.elementType,
        bindings,
        types,
      )
    );
  }

  if (pattern.kind === "Optional") {
    if (actual.kind === "None") return true;

    return actual.kind === "Optional"
      ? bindGenericTypes(
          pattern.valueType,
          actual.valueType,
          bindings,
          types,
        )
      : bindGenericTypes(
          pattern.valueType,
          actual,
          bindings,
          types,
        );
  }

  return isAssignable(actual, pattern, types);
}

function substituteGenerics(
  type: TypeRef,
  bindings: ReadonlyMap<string, TypeRef>,
): TypeRef {
  switch (type.kind) {
    case "Generic":
      return bindings.get(type.name) ?? type;

    case "List":
      return {
        kind: "List",
        elementType: substituteGenerics(type.elementType, bindings),
      };

    case "Optional":
      return {
        kind: "Optional",
        valueType: substituteGenerics(type.valueType, bindings),
      };

    case "None":
    case "Primitive":
    case "Named":
    case "Protocol":
      return type;
  }
}

function isAssignable(
  actual: TypeRef,
  expected: TypeRef,
  types: NamedTypeContext,
): boolean {
  if (sameType(actual, expected)) return true;

  if (expected.kind === "Protocol") {
    if (actual.kind === "Named") {
      const data = types.dataByName.get(actual.name);
      return (
        data?.conformances.some(
          (conformance) => conformance.name === expected.name,
        ) ?? false
      );
    }

    if (actual.kind === "Generic") {
      return (
        types.genericConstraints?.get(actual.name) === expected.name
      );
    }
  }

  if (expected.kind === "Optional") {
    if (actual.kind === "None") return true;
    return isAssignable(actual, expected.valueType, types);
  }

  if (actual.kind === "List" && expected.kind === "List") {
    return isAssignable(
      actual.elementType,
      expected.elementType,
      types,
    );
  }

  return false;
}

function commonType(
  left: TypeRef,
  right: TypeRef,
  types: NamedTypeContext,
): TypeRef | undefined {
  if (sameType(left, right)) return left;

  if (left.kind === "None" && right.kind !== "None") {
    return right.kind === "Optional"
      ? right
      : { kind: "Optional", valueType: right };
  }

  if (right.kind === "None" && left.kind !== "None") {
    return left.kind === "Optional"
      ? left
      : { kind: "Optional", valueType: left };
  }

  if (
    left.kind === "Optional" &&
    isAssignable(right, left, types)
  ) {
    return left;
  }

  if (
    right.kind === "Optional" &&
    isAssignable(left, right, types)
  ) {
    return right;
  }

  if (left.kind === "List" && right.kind === "List") {
    const elementType = commonType(
      left.elementType,
      right.elementType,
      types,
    );
    return elementType ? { kind: "List", elementType } : undefined;
  }

  if (isAssignable(left, right, types)) return right;
  if (isAssignable(right, left, types)) return left;

  return undefined;
}

function sameType(left: TypeRef, right: TypeRef): boolean {
  if (left.kind !== right.kind) return false;

  switch (left.kind) {
    case "None":
      return right.kind === "None";

    case "Primitive":
    case "Named":
    case "Generic":
    case "Protocol":
      return right.kind === left.kind && left.name === right.name;

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
    case "None":
      return "none";

    case "Primitive":
    case "Named":
    case "Generic":
    case "Protocol":
      return type.name;

    case "List":
      return "list of " + describeType(type.elementType);

    case "Optional":
      return "optional " + describeType(type.valueType);
  }
}
