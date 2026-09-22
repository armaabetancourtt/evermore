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
  readonly choices: readonly IRChoice[];
  readonly functions: readonly IRFunction[];
  readonly screens: readonly IRScreen[];
};

export type IRChoice = {
  readonly name: string;
  readonly cases: readonly string[];
};

export type IRDataModel = {
  readonly name: string;
  readonly fields: readonly IRDataField[];
};

export type IRDataField = {
  readonly name: string;
  readonly type: TypeRef;
};

export type IRFunction = {
  readonly name: string;
  readonly parameters: readonly IRFunctionParameter[];
  readonly returnType: TypeRef;
  readonly body: readonly IRFunctionStatement[];
};

export type IRFunctionParameter = {
  readonly name: string;
  readonly type: TypeRef;
};

export type IRFunctionStatement = IRLet | IRReturn;

export type IRLet = {
  readonly kind: "Let";
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
  | IRIfExpression
  | IRMatchExpression
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

export type IRMatchExpression = {
  readonly kind: "Match";
  readonly value: IRExpression;
  readonly cases: readonly IRMatchCase[];
};

export type IRMatchCase = {
  readonly caseName: string;
  readonly expression: IRExpression;
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
      fields: declaration.fields.map((field) => ({
        name: field.name,
        type: typeRefFromAnnotation(field.type),
      })),
    })),
    choices: model.program.choices.map((choice) => ({
      name: choice.name,
      cases: choice.cases.map((item) => item.name),
    })),
    functions: model.program.functions.map((fn) => ({
      name: fn.name,
      parameters: fn.parameters.map((parameter) => ({
        name: parameter.name,
        type: typeRefFromAnnotation(parameter.type),
      })),
      returnType: typeRefFromAnnotation(fn.returnType),
      body: fn.body.map(lowerFunctionStatement),
    })),
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

function lowerFunctionStatement(
  statement: FunctionStatement,
): IRFunctionStatement {
  if (statement.kind === "LetStatement") {
    return {
      kind: "Let",
      name: statement.name,
      expression: lowerExpression(statement.expression),
    };
  }

  return {
    kind: "Return",
    expression: lowerExpression(statement.expression),
  };
}

function lowerExpression(expression: Expression): IRExpression {
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
        elements: expression.elements.map(lowerExpression),
      };

    case "IfExpression":
      return {
        kind: "If",
        condition: lowerExpression(expression.condition),
        thenExpression: lowerExpression(expression.thenExpression),
        elseExpression: lowerExpression(expression.elseExpression),
      };

    case "MatchExpression":
      return {
        kind: "Match",
        value: lowerExpression(expression.value),
        cases: expression.cases.map((branch) => ({
          caseName: branch.caseName,
          expression: lowerExpression(branch.expression),
        })),
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
        left: lowerExpression(expression.left),
        right: lowerExpression(expression.right),
      };

    case "CallExpression":
      return {
        kind: "Call",
        callee: expression.callee,
        arguments: expression.arguments.map(lowerExpression),
      };
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
