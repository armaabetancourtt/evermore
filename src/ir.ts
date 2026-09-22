import type { SemanticModel } from "./semantic.js";

export type IRProgram = {
  readonly kind: "IRProgram";
  readonly appName: string;
  readonly screens: readonly IRScreen[];
};

export type IRScreen = {
  readonly id: string;
  readonly title?: string;
  readonly elements: readonly IRElement[];
};

export type IRElement = IRText | IRButton;

export type IRText = {
  readonly kind: "Text";
  readonly value: string;
};

export type IRButton = {
  readonly kind: "Button";
  readonly label: string;
  readonly action?: IRAction;
};

export type IRAction = {
  readonly kind: "Navigate";
  readonly target: string;
};

export function lowerToIR(model: SemanticModel): IRProgram {
  return {
    kind: "IRProgram",
    appName: model.program.appName,
    screens: model.program.screens.map((screen) => {
      const title = screen.body.find(
        (statement) => statement.kind === "TitleStatement",
      );

      const elements: IRElement[] = [];

      for (const statement of screen.body) {
        switch (statement.kind) {
          case "TitleStatement":
            break;

          case "TextStatement":
            elements.push({
              kind: "Text",
              value: statement.text,
            });
            break;

          case "ButtonStatement":
            elements.push({
              kind: "Button",
              label: statement.label,
              ...(statement.action
                ? {
                    action: {
                      kind: "Navigate" as const,
                      target: statement.action.target,
                    },
                  }
                : {}),
            });
            break;
        }
      }

      return {
        id: screen.name,
        ...(title?.kind === "TitleStatement" ? { title: title.text } : {}),
        elements,
      };
    }),
  };
}
