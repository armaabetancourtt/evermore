import type { VisualStatement } from "./ast.js";
import type { SemanticModel } from "./semantic.js";

export type IRProgram = {
  readonly kind: "IRProgram";
  readonly appName: string;
  readonly screens: readonly IRScreen[];
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
