import type { SemanticModel } from "./semantic.js";

export type IRProgram = {
  readonly kind: "IRProgram";
  readonly appName: string;
  readonly screens: readonly IRScreen[];
};

export type IRScreen = {
  readonly id: string;
  readonly title?: string;
  readonly controls: readonly IRControl[];
};

export type IRControl = IRButton;

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

      const controls: IRControl[] = screen.body
        .filter((statement) => statement.kind === "ButtonStatement")
        .map((statement) => {
          if (statement.kind !== "ButtonStatement") {
            throw new Error("Unreachable statement kind.");
          }

          return {
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
          };
        });

      return {
        id: screen.name,
        ...(title?.kind === "TitleStatement" ? { title: title.text } : {}),
        controls,
      };
    }),
  };
}
