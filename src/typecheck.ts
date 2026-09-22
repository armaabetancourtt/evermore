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
};

export type FunctionValidationOptions = {
  readonly initialValues?: ReadonlyMap<string, TypeRef>;
  readonly bodyCallSignatures?: ReadonlyMap<string, FunctionSignature>;
  readonly validateBodies?: boolean;
};

export function validateFunctions(
  functions: readonly FunctionDeclaration[],
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
  options: FunctionValidationOptions = {},
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

      if (parameter.constraintName) {
        if (!types.protocolsByName.has(parameter.constraintName)) {
          diagnostics.push({
            code: "E2223",
            severity: "error",
            message:
              'Generic type "' +
              parameter.name +
              '" is constrained by unknown protocol "' +
              parameter.constraintName +
              '".',
            span: parameter.span,
            help:
              "Generic constraints must name a declared protocol.",
          });
          signatureValid = false;
        } else {
          genericConstraints.set(
            parameter.name,
            parameter.constraintName,
          );
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
        genericConstraints,
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
      genericConstraints,
    );

    if (!returnType) {
      signatureValid = false;
    }

    if (signatureValid && returnType) {
      signaturesByName.set(fn.name, {
        declaration: fn,
        typeParameters: [...genericNames],
        parameters: parameterTypes,
        returnType,
      });
    }
  }

  if (options.validateBodies !== false) {
    const bodyCallSignatures =
      options.bodyCallSignatures ?? signaturesByName;

    for (const signature of signaturesByName.values()) {
      validateFunctionBody(
        signature,
        bodyCallSignatures,
        types,
        diagnostics,
        options.initialValues,
      );
    }
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
  initialValues: ReadonlyMap<string, TypeRef> = new Map(),
): void {
  const env = new Map<string, TypeRef>(initialValues);
  const mutableNames = new Set<string>();

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
      mutableNames,
      signatures,
      types,
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
  mutableNames: Set<string>,
  signatures: ReadonlyMap<string, FunctionSignature>,
  types: NamedTypeContext,
  diagnostics: Diagnostic[],
): void {
  if (
    statement.kind === "LetStatement" ||
    statement.kind === "VarStatement"
  ) {
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
      if (statement.kind === "VarStatement") {
        mutableNames.add(statement.name);
      }
    }

    return;
  }

  if (statement.kind === "SetStatement") {
    const current = env.get(statement.name);

    if (!current) {
      diagnostics.push({
        code: "E2232",
        severity: "error",
        message:
          'Cannot assign to unknown local "' + statement.name + '".',
        span: statement.span,
        help: "Declare a mutable local with var before assigning to it.",
      });

      inferExpression(
        statement.expression,
        env,
        signatures,
        types,
        diagnostics,
      );
      return;
    }

    if (!mutableNames.has(statement.name)) {
      diagnostics.push({
        code: "E2233",
        severity: "error",
        message:
          'Local "' +
          statement.name +
          '" is immutable and cannot be assigned.',
        span: statement.span,
        help:
          'Declare "' +
          statement.name +
          '" with var instead of let if mutation is required.',
      });
    }

    const assigned = inferExpression(
      statement.expression,
      env,
      signatures,
      types,
      diagnostics,
      current,
    );

    if (assigned && !isAssignable(assigned, current, types)) {
      diagnostics.push({
        code: "E2234",
        severity: "error",
        message:
          'Assignment to "' +
          statement.name +
          '" has type ' +
          describeType(assigned) +
          " but the variable stores " +
          describeType(current) +
          ".",
        span: statement.span,
        help: "Assign a value compatible with the variable's inferred type.",
      });
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
            : objectType.kind === "Generic" && objectType.constraint
              ? types.protocolsByName.get(objectType.constraint)
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
            describeType(objectType) +
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

    case "MethodCallExpression": {
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
            'Cannot call method "' +
            expression.method +
            '" through optional ' +
            describeType(objectType) +
            ".",
          span: expression.span,
          help:
            "Resolve the optional value before calling its methods.",
        });
        return undefined;
      }

      const owner =
        objectType.kind === "Named"
          ? types.dataByName.get(objectType.name)
          : objectType.kind === "Protocol"
            ? types.protocolsByName.get(objectType.name)
            : objectType.kind === "Generic" && objectType.constraint
              ? types.protocolsByName.get(objectType.constraint)
              : undefined;

      if (!owner) {
        diagnostics.push({
          code: "E2323",
          severity: "error",
          message:
            'Type "' +
            describeType(objectType) +
            '" does not expose methods.',
          span: expression.span,
          help:
            "Method calls are supported on data, protocol, and protocol-constrained generic values.",
        });
        return undefined;
      }

      const method = owner.methods.find(
        (item) => item.name === expression.method,
      );

      if (!method) {
        diagnostics.push({
          code: "E2324",
          severity: "error",
          message:
            'Type "' +
            describeType(objectType) +
            '" has no method "' +
            expression.method +
            '".',
          span: expression.span,
          help:
            "Call a method declared by the data type or protocol contract.",
        });
        return undefined;
      }

      if (expression.arguments.length !== method.parameters.length) {
        diagnostics.push({
          code: "E2325",
          severity: "error",
          message:
            'Method "' +
            expression.method +
            '" expects ' +
            method.parameters.length +
            " argument(s) but received " +
            expression.arguments.length +
            ".",
          span: expression.span,
          help: "Pass exactly the declared number of method arguments.",
        });
      }

      expression.arguments.forEach((argument, index) => {
        const parameter = method.parameters[index];
        const parameterType = parameter
          ? typeRefFromAnnotation(
              parameter.type,
              new Set(),
              new Set(types.protocolsByName.keys()),
            )
          : undefined;
        const actual = inferExpression(
          argument,
          env,
          signatures,
          types,
          diagnostics,
          parameterType,
        );

        if (
          actual &&
          parameterType &&
          !isAssignable(actual, parameterType, types)
        ) {
          diagnostics.push({
            code: "E2326",
            severity: "error",
            message:
              "Argument " +
              (index + 1) +
              ' of method "' +
              expression.method +
              '" has type ' +
              describeType(actual) +
              " but expects " +
              describeType(parameterType) +
              ".",
            span: argument.span,
            help: "Pass a value assignable to the method parameter type.",
          });
        }
      });

      return typeRefFromAnnotation(
        method.returnType,
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

    case "SetExpression": {
      const expectedElement =
        expected?.kind === "Set" ? expected.elementType : undefined;

      if (expression.elements.length === 0) {
        if (expected?.kind === "Set") {
          return expected;
        }

        diagnostics.push({
          code: "E2235",
          severity: "error",
          message:
            "Cannot infer the type of an empty set without context.",
          span: expression.span,
          help:
            "Use the empty set where a set type is already expected, or add at least one element.",
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
            code: "E2236",
            severity: "error",
            message:
              "Set elements do not have a compatible common type. Found " +
              describeType(common) +
              " and " +
              describeType(elementType) +
              ".",
            span: element.span,
            help:
              "Use compatible set elements. A value and none may combine into an optional type.",
          });
          valid = false;
          continue;
        }

        common = merged;
      }

      return valid
        ? { kind: "Set", elementType: common }
        : undefined;
    }

    case "MapExpression": {
      const expectedKey =
        expected?.kind === "Map" ? expected.keyType : undefined;
      const expectedValue =
        expected?.kind === "Map" ? expected.valueType : undefined;

      if (expression.entries.length === 0) {
        if (expected?.kind === "Map") {
          return expected;
        }

        diagnostics.push({
          code: "E2237",
          severity: "error",
          message:
            "Cannot infer the types of an empty map without context.",
          span: expression.span,
          help:
            "Use the empty map where a map type is already expected, or add at least one entry.",
        });
        return undefined;
      }

      const firstEntry = expression.entries[0]!;
      const firstKey = inferExpression(
        firstEntry.key,
        env,
        signatures,
        types,
        diagnostics,
        expectedKey,
      );
      const firstValue = inferExpression(
        firstEntry.value,
        env,
        signatures,
        types,
        diagnostics,
        expectedValue,
      );

      if (!firstKey || !firstValue) return undefined;

      let commonKey = firstKey;
      let commonValue = firstValue;
      let valid = true;

      for (const entry of expression.entries.slice(1)) {
        const keyType = inferExpression(
          entry.key,
          env,
          signatures,
          types,
          diagnostics,
          expectedKey,
        );
        const valueType = inferExpression(
          entry.value,
          env,
          signatures,
          types,
          diagnostics,
          expectedValue,
        );

        if (!keyType || !valueType) {
          valid = false;
          continue;
        }

        const mergedKey = commonType(commonKey, keyType, types);
        if (!mergedKey) {
          diagnostics.push({
            code: "E2238",
            severity: "error",
            message:
              "Map keys do not have a compatible common type. Found " +
              describeType(commonKey) +
              " and " +
              describeType(keyType) +
              ".",
            span: entry.key.span,
            help: "Use compatible key types in every map entry.",
          });
          valid = false;
        } else {
          commonKey = mergedKey;
        }

        const mergedValue = commonType(
          commonValue,
          valueType,
          types,
        );
        if (!mergedValue) {
          diagnostics.push({
            code: "E2239",
            severity: "error",
            message:
              "Map values do not have a compatible common type. Found " +
              describeType(commonValue) +
              " and " +
              describeType(valueType) +
              ".",
            span: entry.value.span,
            help:
              "Use compatible value types. A value and none may combine into an optional type.",
          });
          valid = false;
        } else {
          commonValue = mergedValue;
        }
      }

      return valid
        ? {
            kind: "Map",
            keyType: commonKey,
            valueType: commonValue,
          }
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
      const constructor = types.dataByName.get(expression.callee);

      if (!callee && constructor) {
        if (expression.arguments.length !== constructor.fields.length) {
          diagnostics.push({
            code: "E2230",
            severity: "error",
            message:
              'Data constructor "' +
              constructor.name +
              '" expects ' +
              constructor.fields.length +
              " argument(s) but received " +
              expression.arguments.length +
              ".",
            span: expression.span,
            help:
              "Pass one value for each field in declaration order: " +
              constructor.fields.map((field) => field.name).join(", ") +
              ".",
          });
        }

        expression.arguments.forEach((argument, index) => {
          const field = constructor.fields[index];
          const fieldType = field
            ? typeRefFromAnnotation(
                field.type,
                new Set(),
                new Set(types.protocolsByName.keys()),
              )
            : undefined;

          const actual = inferExpression(
            argument,
            env,
            signatures,
            types,
            diagnostics,
            fieldType,
          );

          if (!actual || !field || !fieldType) return;

          if (!isAssignable(actual, fieldType, types)) {
            diagnostics.push({
              code: "E2231",
              severity: "error",
              message:
                'Field "' +
                constructor.name +
                "." +
                field.name +
                '" receives ' +
                describeType(actual) +
                " but expects " +
                describeType(fieldType) +
                ".",
              span: argument.span,
              help:
                "Pass a value assignable to the declared field type.",
            });
          }
        });

        return {
          kind: "Named",
          name: constructor.name,
        };
      }

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
  genericConstraints: ReadonlyMap<string, string>,
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
        "Use a primitive type, collection/optional composition, or a declared data/protocol/choice type.",
    });
    return undefined;
  }

  return typeRefFromAnnotation(
    annotation,
    genericNames,
    new Set(types.protocolsByName.keys()),
    genericConstraints,
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
    case "SetTypeAnnotation":
      return findUnknownType(
        annotation.elementType,
        types,
        genericNames,
      );

    case "MapTypeAnnotation":
      return (
        findUnknownType(annotation.keyType, types, genericNames) ??
        findUnknownType(annotation.valueType, types, genericNames)
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
    if (
      pattern.constraint &&
      !isAssignable(
        actual,
        { kind: "Protocol", name: pattern.constraint },
        types,
      )
    ) {
      return false;
    }

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

  if (pattern.kind === "Set") {
    return (
      actual.kind === "Set" &&
      bindGenericTypes(
        pattern.elementType,
        actual.elementType,
        bindings,
        types,
      )
    );
  }

  if (pattern.kind === "Map") {
    return (
      actual.kind === "Map" &&
      bindGenericTypes(
        pattern.keyType,
        actual.keyType,
        bindings,
        types,
      ) &&
      bindGenericTypes(
        pattern.valueType,
        actual.valueType,
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

    case "Set":
      return {
        kind: "Set",
        elementType: substituteGenerics(type.elementType, bindings),
      };

    case "Map":
      return {
        kind: "Map",
        keyType: substituteGenerics(type.keyType, bindings),
        valueType: substituteGenerics(type.valueType, bindings),
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

    if (actual.kind === "Generic" && actual.constraint) {
      return actual.constraint === expected.name;
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

  if (actual.kind === "Set" && expected.kind === "Set") {
    return isAssignable(
      actual.elementType,
      expected.elementType,
      types,
    );
  }

  if (actual.kind === "Map" && expected.kind === "Map") {
    return (
      isAssignable(actual.keyType, expected.keyType, types) &&
      isAssignable(actual.valueType, expected.valueType, types)
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

  if (left.kind === "Set" && right.kind === "Set") {
    const elementType = commonType(
      left.elementType,
      right.elementType,
      types,
    );
    return elementType ? { kind: "Set", elementType } : undefined;
  }

  if (left.kind === "Map" && right.kind === "Map") {
    const keyType = commonType(left.keyType, right.keyType, types);
    const valueType = commonType(
      left.valueType,
      right.valueType,
      types,
    );

    return keyType && valueType
      ? { kind: "Map", keyType, valueType }
      : undefined;
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

    case "Set":
      return (
        right.kind === "Set" &&
        sameType(left.elementType, right.elementType)
      );

    case "Map":
      return (
        right.kind === "Map" &&
        sameType(left.keyType, right.keyType) &&
        sameType(left.valueType, right.valueType)
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

    case "Set":
      return "set of " + describeType(type.elementType);

    case "Map":
      return (
        "map of " +
        describeType(type.keyType) +
        " to " +
        describeType(type.valueType)
      );

    case "Optional":
      return "optional " + describeType(type.valueType);
  }
}
