import type {
  Expression,
  FunctionStatement,
  VisualStatement,
} from "./ast.js";
import type { SemanticModel } from "./semantic.js";
import {
  typeRefFromAnnotation,
  type TypeRef,
} from "./types.js";

export type IRProgram = {
  readonly kind: "IRProgram";
  readonly appName: string;
  readonly data: readonly IRDataModel[];
  readonly protocols: readonly IRProtocol[];
  readonly choices: readonly IRChoice[];
  readonly functions: readonly IRFunction[];
  readonly screens: readonly IRScreen[];
};

export type IRChoice = {
  readonly name: string;
  readonly cases: readonly string[];
};

export type IRProtocol = {
  readonly name: string;
  readonly fields: readonly IRDataField[];
  readonly methods: readonly IRMethod[];
};

export type IRDataModel = {
  readonly name: string;
  readonly conformances: readonly string[];
  readonly fields: readonly IRDataField[];
  readonly methods: readonly IRMethod[];
};

export type IRDataField = {
  readonly name: string;
  readonly type: TypeRef;
};

export type IRFunction = {
  readonly name: string;
  readonly typeParameters: readonly IRTypeParameter[];
  readonly parameters: readonly IRFunctionParameter[];
  readonly returnType: TypeRef;
  readonly body: readonly IRFunctionStatement[];
};

export type IRMethod = {
  readonly name: string;
  readonly parameters: readonly IRFunctionParameter[];
  readonly returnType: TypeRef;
  readonly body: readonly IRFunctionStatement[];
};

export type IRTypeParameter = {
  readonly name: string;
  readonly constraint?: string;
};

export type IRFunctionParameter = {
  readonly name: string;
  readonly type: TypeRef;
};

export type IRFunctionStatement = IRLet | IRVar | IRAssign | IRReturn;

export type IRLet = {
  readonly kind: "Let";
  readonly name: string;
  readonly expression: IRExpression;
};

export type IRVar = {
  readonly kind: "Var";
  readonly name: string;
  readonly expression: IRExpression;
};

export type IRAssign = {
  readonly kind: "Assign";
  readonly name: string;
  readonly expression: IRExpression;
};

export type IRReturn = {
  readonly kind: "Return";
  readonly expression: IRExpression;
};

export type IRExpression =
  | IRNumberExpression
  | IRStringExpression
  | IRBooleanExpression
  | IRNoneExpression
  | IRListExpression
  | IRSetExpression
  | IRMapExpression
  | IRIfExpression
  | IRMatchExpression
  | IRMemberExpression
  | IRMethodCallExpression
  | IRConstructExpression
  | IRChoiceCaseExpression
  | IRIdentifierExpression
  | IRBinaryExpression
  | IRCallExpression;

export type IRNumberExpression = {
  readonly kind: "Number";
  readonly value: number;
};

export type IRStringExpression = {
  readonly kind: "String";
  readonly value: string;
};

export type IRBooleanExpression = {
  readonly kind: "Boolean";
  readonly value: boolean;
};

export type IRNoneExpression = {
  readonly kind: "None";
};

export type IRListExpression = {
  readonly kind: "List";
  readonly elements: readonly IRExpression[];
};

export type IRSetExpression = {
  readonly kind: "Set";
  readonly elements: readonly IRExpression[];
};

export type IRMapExpression = {
  readonly kind: "Map";
  readonly entries: readonly IRMapEntry[];
};

export type IRMapEntry = {
  readonly key: IRExpression;
  readonly value: IRExpression;
};

export type IRMatchExpression = {
  readonly kind: "Match";
  readonly value: IRExpression;
  readonly cases: readonly IRMatchCase[];
};

export type IRMatchCase = {
  readonly caseName: string;
  readonly expression: IRExpression;
};

export type IRMemberExpression = {
  readonly kind: "Member";
  readonly object: IRExpression;
  readonly member: string;
};

export type IRMethodCallExpression = {
  readonly kind: "MethodCall";
  readonly object: IRExpression;
  readonly method: string;
  readonly arguments: readonly IRExpression[];
};

export type IRConstructExpression = {
  readonly kind: "Construct";
  readonly typeName: string;
  readonly fields: readonly IRConstructField[];
  readonly methods: readonly IRMethod[];
};

export type IRConstructField = {
  readonly name: string;
  readonly value: IRExpression;
};

export type IRChoiceCaseExpression = {
  readonly kind: "ChoiceCase";
  readonly choiceName: string;
  readonly caseName: string;
};

export type IRIdentifierExpression = {
  readonly kind: "Identifier";
  readonly name: string;
};

export type IRIfExpression = {
  readonly kind: "If";
  readonly condition: IRExpression;
  readonly thenExpression: IRExpression;
  readonly elseExpression: IRExpression;
};

export type IRBinaryExpression = {
  readonly kind: "Binary";
  readonly operator:
    | "+"
    | "-"
    | "*"
    | "/"
    | "=="
    | "!="
    | ">"
    | ">="
    | "<"
    | "<=";
  readonly left: IRExpression;
  readonly right: IRExpression;
};

export type IRCallExpression = {
  readonly kind: "Call";
  readonly callee: string;
  readonly arguments: readonly IRExpression[];
};

export type IRScreen = {
  readonly id: string;
  readonly title?: string;
  readonly states: readonly IRState[];
  readonly elements: readonly IRElement[];
};

export type IRState = {
  readonly name: string;
  readonly initialValue: number;
};

export type IRElement = IRText | IRStateValue | IRButton | IRStack;

export type IRText = {
  readonly kind: "Text";
  readonly value: string;
};

export type IRStateValue = {
  readonly kind: "StateValue";
  readonly stateName: string;
};

export type IRButton = {
  readonly kind: "Button";
  readonly label: string;
  readonly action?: IRAction;
};

export type IRStack = {
  readonly kind: "Stack";
  readonly direction: "vertical" | "horizontal";
  readonly elements: readonly IRElement[];
};

export type IRAction = IRNavigateAction | IRIncrementAction;

export type IRNavigateAction = {
  readonly kind: "Navigate";
  readonly target: string;
};

export type IRIncrementAction = {
  readonly kind: "Increment";
  readonly stateName: string;
  readonly amount: number;
};

export function lowerToIR(model: SemanticModel): IRProgram {
  return {
    kind: "IRProgram",
    appName: model.program.appName,
    data: model.program.data.map((declaration) => ({
      name: declaration.name,
      conformances: declaration.conformances.map(
        (conformance) => conformance.name,
      ),
      fields: declaration.fields.map((field) => ({
        name: field.name,
        type: typeRefFromAnnotation(
          field.type,
          new Set(),
          new Set(model.protocolsByName.keys()),
        ),
      })),
      methods: declaration.methods.map((method) =>
        lowerMethod(method, model),
      ),
    })),
    protocols: model.program.protocols.map((protocol) => ({
      name: protocol.name,
      fields: protocol.fields.map((field) => ({
        name: field.name,
        type: typeRefFromAnnotation(
          field.type,
          new Set(),
          new Set(model.protocolsByName.keys()),
        ),
      })),
      methods: protocol.methods.map((method) =>
        lowerMethod(method, model),
      ),
    })),
    choices: model.program.choices.map((choice) => ({
      name: choice.name,
      cases: choice.cases.map((item) => item.name),
    })),
    functions: model.program.functions.map((fn) => {
      const genericNames = new Set(
        fn.typeParameters.map((parameter) => parameter.name),
      );
      const protocolNames = new Set(
        model.program.protocols.map((protocol) => protocol.name),
      );
      const genericConstraints = new Map(
        fn.typeParameters
          .filter((parameter) => parameter.constraintName)
          .map(
            (parameter) =>
              [
                parameter.name,
                parameter.constraintName!,
              ] as const,
          ),
      );

      return {
        name: fn.name,
        typeParameters: fn.typeParameters.map((parameter) => ({
          name: parameter.name,
          ...(parameter.constraintName
            ? { constraint: parameter.constraintName }
            : {}),
        })),
        parameters: fn.parameters.map((parameter) => ({
          name: parameter.name,
          type: typeRefFromAnnotation(
            parameter.type,
            genericNames,
            protocolNames,
            genericConstraints,
          ),
        })),
        returnType: typeRefFromAnnotation(
          fn.returnType,
          genericNames,
          protocolNames,
          genericConstraints,
        ),
        body: fn.body.map((statement) =>
          lowerFunctionStatement(statement, model),
        ),
      };
    }),
    screens: model.program.screens.map((screen) => {
      const title = screen.body.find(
        (statement) => statement.kind === "TitleStatement",
      );

      const states: IRState[] = [];
      const elements: IRElement[] = [];

      for (const statement of screen.body) {
        if (statement.kind === "StateDeclaration") {
          states.push({
            name: statement.name,
            initialValue: statement.initialValue,
          });
          continue;
        }

        if (statement.kind === "TitleStatement") {
          continue;
        }

        elements.push(...lowerVisual(statement, model));
      }

      return {
        id: screen.name,
        ...(title?.kind === "TitleStatement" ? { title: title.text } : {}),
        states,
        elements,
      };
    }),
  };
}

function lowerMethod(
  method: SemanticModel["program"]["functions"][number],
  model: SemanticModel,
): IRMethod {
  const protocolNames = new Set(model.protocolsByName.keys());

  return {
    name: method.name,
    parameters: method.parameters.map((parameter) => ({
      name: parameter.name,
      type: typeRefFromAnnotation(
        parameter.type,
        new Set(),
        protocolNames,
      ),
    })),
    returnType: typeRefFromAnnotation(
      method.returnType,
      new Set(),
      protocolNames,
    ),
    body: method.body.map((statement) =>
      lowerFunctionStatement(statement, model),
    ),
  };
}

function lowerFunctionStatement(
  statement: FunctionStatement,
  model: SemanticModel,
): IRFunctionStatement {
  if (statement.kind === "LetStatement") {
    return {
      kind: "Let",
      name: statement.name,
      expression: lowerExpression(statement.expression, model),
    };
  }

  if (statement.kind === "VarStatement") {
    return {
      kind: "Var",
      name: statement.name,
      expression: lowerExpression(statement.expression, model),
    };
  }

  if (statement.kind === "SetStatement") {
    return {
      kind: "Assign",
      name: statement.name,
      expression: lowerExpression(statement.expression, model),
    };
  }

  return {
    kind: "Return",
    expression: lowerExpression(statement.expression, model),
  };
}

function lowerExpression(
  expression: Expression,
  model: SemanticModel,
): IRExpression {
  switch (expression.kind) {
    case "NumberExpression":
      return { kind: "Number", value: expression.value };

    case "StringExpression":
      return { kind: "String", value: expression.value };

    case "BooleanExpression":
      return { kind: "Boolean", value: expression.value };

    case "NoneExpression":
      return { kind: "None" };

    case "ListExpression":
      return {
        kind: "List",
        elements: expression.elements.map((element) =>
          lowerExpression(element, model),
        ),
      };

    case "SetExpression":
      return {
        kind: "Set",
        elements: expression.elements.map((element) =>
          lowerExpression(element, model),
        ),
      };

    case "MapExpression":
      return {
        kind: "Map",
        entries: expression.entries.map((entry) => ({
          key: lowerExpression(entry.key, model),
          value: lowerExpression(entry.value, model),
        })),
      };

    case "IfExpression":
      return {
        kind: "If",
        condition: lowerExpression(expression.condition, model),
        thenExpression: lowerExpression(expression.thenExpression, model),
        elseExpression: lowerExpression(expression.elseExpression, model),
      };

    case "MatchExpression":
      return {
        kind: "Match",
        value: lowerExpression(expression.value, model),
        cases: expression.cases.map((branch) => ({
          caseName: branch.caseName,
          expression: lowerExpression(branch.expression, model),
        })),
      };

    case "MemberExpression": {
      if (
        expression.object.kind === "IdentifierExpression" &&
        model.choicesByName.has(expression.object.name)
      ) {
        return {
          kind: "ChoiceCase",
          choiceName: expression.object.name,
          caseName: expression.member,
        };
      }

      return {
        kind: "Member",
        object: lowerExpression(expression.object, model),
        member: expression.member,
      };
    }

    case "MethodCallExpression":
      return {
        kind: "MethodCall",
        object: lowerExpression(expression.object, model),
        method: expression.method,
        arguments: expression.arguments.map((argument) =>
          lowerExpression(argument, model),
        ),
      };

    case "ChoiceCaseExpression":
      return {
        kind: "ChoiceCase",
        choiceName: expression.choiceName,
        caseName: expression.caseName,
      };

    case "IdentifierExpression":
      return { kind: "Identifier", name: expression.name };

    case "BinaryExpression":
      return {
        kind: "Binary",
        operator: expression.operator,
        left: lowerExpression(expression.left, model),
        right: lowerExpression(expression.right, model),
      };

    case "CallExpression": {
      const constructor =
        model.functionsByName.has(expression.callee)
          ? undefined
          : model.dataByName.get(expression.callee);

      if (constructor) {
        return {
          kind: "Construct",
          typeName: constructor.name,
          fields: constructor.fields.map((field, index) => ({
            name: field.name,
            value: lowerExpression(expression.arguments[index]!, model),
          })),
          methods: constructor.methods.map((method) =>
            lowerMethod(method, model),
          ),
        };
      }

      return {
        kind: "Call",
        callee: expression.callee,
        arguments: expression.arguments.map((argument) =>
          lowerExpression(argument, model),
        ),
      };
    }
  }
}

function lowerVisual(
  statement: VisualStatement,
  model: SemanticModel,
): readonly IRElement[] {
  switch (statement.kind) {
    case "TextStatement":
      return [
        {
          kind: "Text",
          value: statement.text,
        },
      ];

    case "ShowStatement":
      return [
        {
          kind: "StateValue",
          stateName: statement.stateName,
        },
      ];

    case "ButtonStatement":
      return [
        {
          kind: "Button",
          label: statement.label,
          ...(statement.action
            ? {
                action:
                  statement.action.kind === "NavigationAction"
                    ? {
                        kind: "Navigate" as const,
                        target: statement.action.target,
                      }
                    : {
                        kind: "Increment" as const,
                        stateName: statement.action.stateName,
                        amount: statement.action.amount,
                      },
              }
            : {}),
        },
      ];

    case "StackStatement":
      return [
        {
          kind: "Stack",
          direction: statement.direction,
          elements: statement.body.flatMap((child) =>
            lowerVisual(child, model),
          ),
        },
      ];

    case "UseStatement": {
      const component = model.componentsByName.get(statement.componentName);

      if (!component) {
        throw new Error(
          'Semantic model is missing component "' +
            statement.componentName +
            '".',
        );
      }

      return component.body.flatMap((child) =>
        lowerVisual(child, model),
      );
    }
  }
}
