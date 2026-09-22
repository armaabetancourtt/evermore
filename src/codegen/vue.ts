import type {
  IRChoice,
  IRDataModel,
  IRElement,
  IRExpression,
  IRFunction,
  IRProgram,
  IRScreen,
} from "../ir.js";
import type { TypeRef } from "../types.js";

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export function emitVue(program: IRProgram): readonly GeneratedFile[] {
  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content:
        JSON.stringify(
          {
            name: slug(program.appName),
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "vue-tsc --noEmit -p tsconfig.json && vite build",
              preview: "vite preview",
            },
            dependencies: {
              vue: "^3.5.0",
              "vue-router": "^4.5.0",
            },
            devDependencies: {
              "@vitejs/plugin-vue": "^6.0.0",
              typescript: "^5.9.0",
              vite: "^7.0.0",
              "vue-tsc": "^3.0.0",
            },
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "Bundler",
              strict: true,
              noEmit: true,
              skipLibCheck: true,
              lib: ["ES2022", "DOM", "DOM.Iterable"],
              types: ["vite/client"],
            },
            include: [
              "src/**/*.ts",
              "src/**/*.vue",
              "vite.config.ts",
            ],
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "index.html",
      content:
        '<!doctype html>\n<html lang="en">\n  <head>\n' +
        '    <meta charset="UTF-8" />\n' +
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
        "    <title>" +
        escapeHtml(program.appName) +
        "</title>\n" +
        "  </head>\n" +
        '  <body>\n    <div id="app"></div>\n' +
        '    <script type="module" src="/src/main.ts"></script>\n' +
        "  </body>\n</html>\n",
    },
    {
      path: "vite.config.ts",
      content:
        'import { defineConfig } from "vite";\n' +
        'import vue from "@vitejs/plugin-vue";\n\n' +
        "export default defineConfig({\n" +
        "  plugins: [vue()],\n" +
        "});\n",
    },
    {
      path: "src/main.ts",
      content:
        'import { createApp } from "vue";\n' +
        'import { createRouter, createWebHistory } from "vue-router";\n' +
        'import App from "./App.vue";\n' +
        'import { evermoreRoutes } from "./generated/routes";\n' +
        'import "./style.css";\n\n' +
        "const router = createRouter({\n" +
        "  history: createWebHistory(),\n" +
        "  routes: evermoreRoutes,\n" +
        "});\n\n" +
        'createApp(App).use(router).mount("#app");\n',
    },
    {
      path: "src/App.vue",
      content:
        "<template>\n" +
        '  <RouterView />\n' +
        "</template>\n\n" +
        '<script setup lang="ts">\n' +
        'import { RouterView } from "vue-router";\n' +
        "</script>\n",
    },
    {
      path: "src/style.css",
      content: emitGlobalStyle(),
    },
  ];

  if (program.data.length > 0 || program.choices.length > 0) {
    files.push({
      path: "src/generated/models.ts",
      content: emitModels(program.data, program.choices),
    });
  }

  if (program.functions.length > 0) {
    files.push({
      path: "src/generated/functions.ts",
      content: emitFunctions(program.functions),
    });
  }

  const routes: string[] = [];

  for (const screen of program.screens) {
    const componentName = screen.id + "Screen";
    const routePath =
      screen.id === "Home"
        ? "/"
        : "/" +
          screen.id
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .toLowerCase();

    routes.push(
      "  { path: " +
        JSON.stringify(routePath) +
        ", name: " +
        JSON.stringify(screen.id) +
        ", component: () => import(" +
        JSON.stringify("./screens/" + componentName + ".vue") +
        ") },",
    );

    files.push({
      path: "src/generated/screens/" + componentName + ".vue",
      content: emitScreen(screen),
    });
  }

  files.push({
    path: "src/generated/routes.ts",
    content:
      'import type { RouteRecordRaw } from "vue-router";\n\n' +
      "export const evermoreRoutes: RouteRecordRaw[] = [\n" +
      routes.join("\n") +
      "\n];\n",
  });

  files.push({
    path: "src/generated/evermore.manifest.json",
    content:
      JSON.stringify(
        {
          app: program.appName,
          target: "vue",
          irVersion: "0.0.1",
          generatedBy: "Evermore 0.0.1",
          ...(program.data.length > 0
            ? { dataModels: program.data.map((model) => model.name) }
            : {}),
          ...(program.choices.length > 0
            ? { choices: program.choices.map((choice) => choice.name) }
            : {}),
          ...(program.functions.length > 0
            ? { functions: program.functions.map((fn) => fn.name) }
            : {}),
          screens: program.screens.map((screen) => screen.id),
        },
        null,
        2,
      ) + "\n",
  });

  return files;
}

function emitModels(
  models: readonly IRDataModel[],
  choices: readonly IRChoice[],
): string {
  const lines = [
    "// Generated by Evermore. Do not edit by hand.",
    "",
    "export type EvermoreModels = {",
  ];

  for (const model of models) {
    lines.push("  " + JSON.stringify(model.name) + ": {");

    for (const field of model.fields) {
      lines.push(
        "    readonly " +
          JSON.stringify(field.name) +
          ": " +
          emitTypeRef(field.type) +
          ";",
      );
    }

    lines.push("  };");
  }

  for (const choice of choices) {
    lines.push(
      "  " +
        JSON.stringify(choice.name) +
        ": " +
        choice.cases.map((item) => JSON.stringify(item)).join(" | ") +
        ";",
    );
  }

  lines.push("};", "");
  return lines.join("\n");
}

function emitTypeRef(
  type: TypeRef,
  genericNames: ReadonlyMap<string, string> = new Map(),
): string {
  switch (type.kind) {
    case "None":
      return "null";

    case "Named":
      return "EvermoreModels[" + JSON.stringify(type.name) + "]";

    case "Generic": {
      const generated = genericNames.get(type.name);

      if (!generated) {
        throw new Error(
          'Missing generated generic type for "' + type.name + '".',
        );
      }

      return generated;
    }

    case "Primitive":
      switch (type.name) {
        case "text":
        case "id":
          return "string";
        case "number":
          return "number";
        case "boolean":
          return "boolean";
      }

    case "List":
      return (
        "ReadonlyArray<" +
        emitTypeRef(type.elementType, genericNames) +
        ">"
      );

    case "Optional":
      return (
        "(" +
        emitTypeRef(type.valueType, genericNames) +
        " | null)"
      );
  }
}

function containsNamedType(type: TypeRef): boolean {
  switch (type.kind) {
    case "None":
      return false;
    case "Named":
      return true;
    case "Primitive":
    case "Generic":
      return false;
    case "List":
      return containsNamedType(type.elementType);
    case "Optional":
      return containsNamedType(type.valueType);
  }
}

function emitFunctions(
  functions: readonly IRFunction[],
): string {
  const functionNames = new Map<string, string>();

  functions.forEach((fn, index) => {
    functionNames.set(fn.name, "fn_" + index);
  });

  const needsModels = functions.some(
    (fn) =>
      containsNamedType(fn.returnType) ||
      fn.parameters.some((parameter) =>
        containsNamedType(parameter.type),
      ),
  );

  const lines: string[] = [
    "// Generated by Evermore. Do not edit by hand.",
  ];

  if (needsModels) {
    lines.push(
      'import type { EvermoreModels } from "./models";',
      "",
    );
  } else {
    lines.push("");
  }

  functions.forEach((fn, functionIndex) => {
    const generatedName = functionNames.get(fn.name);

    if (!generatedName) {
      throw new Error("Missing generated function name for " + fn.name);
    }

    const values = new Map<string, string>();
    const genericNames = new Map<string, string>();

    fn.typeParameters.forEach((name, index) => {
      genericNames.set(name, "T" + index);
    });

    const genericClause =
      fn.typeParameters.length > 0
        ? "<" +
          fn.typeParameters
            .map((name) => genericNames.get(name))
            .join(", ") +
          ">"
        : "";

    const params = fn.parameters.map((parameter, parameterIndex) => {
      const generatedParameter = "arg_" + parameterIndex;
      values.set(parameter.name, generatedParameter);

      return (
        generatedParameter +
        ": " +
        emitTypeRef(parameter.type, genericNames)
      );
    });

    lines.push(
      "function " +
        generatedName +
        genericClause +
        "(" +
        params.join(", ") +
        "): " +
        emitTypeRef(fn.returnType, genericNames) +
        " {",
    );

    let localIndex = 0;

    for (const statement of fn.body) {
      if (statement.kind === "Let") {
        const generatedLocal = "local_" + localIndex++;
        lines.push(
          "  const " +
            generatedLocal +
            " = " +
            emitFunctionExpression(
              statement.expression,
              values,
              functionNames,
            ) +
            ";",
        );
        values.set(statement.name, generatedLocal);
        continue;
      }

      lines.push(
        "  return " +
          emitFunctionExpression(
            statement.expression,
            values,
            functionNames,
          ) +
          ";",
      );
    }

    lines.push("}", "");
  });

  lines.push("export const evermoreFunctions = {");

  functions.forEach((fn) => {
    const generatedName = functionNames.get(fn.name);
    if (!generatedName) return;

    lines.push(
      "  " + JSON.stringify(fn.name) + ": " + generatedName + ",",
    );
  });

  lines.push("} as const;", "");

  return lines.join("\n");
}

function emitFunctionExpression(
  expression: IRExpression,
  values: ReadonlyMap<string, string>,
  functions: ReadonlyMap<string, string>,
): string {
  switch (expression.kind) {
    case "Number":
      return String(expression.value);

    case "String":
      return JSON.stringify(expression.value);

    case "Boolean":
      return expression.value ? "true" : "false";

    case "None":
      return "null";

    case "List":
      return (
        "[" +
        expression.elements
          .map((element) =>
            emitFunctionExpression(element, values, functions),
          )
          .join(", ") +
        "]"
      );

    case "If":
      return (
        "(" +
        emitFunctionExpression(
          expression.condition,
          values,
          functions,
        ) +
        " ? " +
        emitFunctionExpression(
          expression.thenExpression,
          values,
          functions,
        ) +
        " : " +
        emitFunctionExpression(
          expression.elseExpression,
          values,
          functions,
        ) +
        ")"
      );

    case "Match":
      return (
        "(() => { const matchValue = " +
        emitFunctionExpression(
          expression.value,
          values,
          functions,
        ) +
        "; switch (matchValue) { " +
        expression.cases
          .map(
            (branch) =>
              "case " +
              JSON.stringify(branch.caseName) +
              ": return " +
              emitFunctionExpression(
                branch.expression,
                values,
                functions,
              ) +
              ";",
          )
          .join(" ") +
        ' default: throw new Error("Unreachable Evermore match"); } })()'
      );

    case "ChoiceCase":
      return JSON.stringify(expression.caseName);

    case "Identifier": {
      const generated = values.get(expression.name);

      if (!generated) {
        throw new Error(
          'IR references unknown value "' + expression.name + '".',
        );
      }

      return generated;
    }

    case "Binary": {
      const operator =
        expression.operator === "=="
          ? "==="
          : expression.operator === "!="
            ? "!=="
            : expression.operator;

      return (
        "(" +
        emitFunctionExpression(expression.left, values, functions) +
        " " +
        operator +
        " " +
        emitFunctionExpression(expression.right, values, functions) +
        ")"
      );
    }

    case "Call": {
      const generated = functions.get(expression.callee);

      if (!generated) {
        throw new Error(
          'IR references unknown function "' + expression.callee + '".',
        );
      }

      return (
        generated +
        "(" +
        expression.arguments
          .map((argument) =>
            emitFunctionExpression(argument, values, functions),
          )
          .join(", ") +
        ")"
      );
    }
  }
}

function emitScreen(screen: IRScreen): string {
  const needsRouter = hasNavigation(screen.elements);
  const needsState = screen.states.length > 0;
  const scriptLines: string[] = [];

  if (needsState) {
    scriptLines.push('import { ref } from "vue";');
  }

  if (needsRouter) {
    scriptLines.push('import { useRouter } from "vue-router";');
  }

  if (scriptLines.length > 0) {
    scriptLines.push("");
  }

  for (const state of screen.states) {
    scriptLines.push(
      "const " +
        stateIdentifier(state.name) +
        " = ref(" +
        String(state.initialValue) +
        ");",
    );
  }

  if (needsRouter) {
    if (screen.states.length > 0) scriptLines.push("");
    scriptLines.push("const router = useRouter();");
    scriptLines.push(
      "const go = (screen: string) => router.push({ name: screen });",
    );
  }

  const script =
    scriptLines.length > 0
      ? '<script setup lang="ts">\n' +
        scriptLines.join("\n") +
        "\n</script>\n\n"
      : "";

  const body: string[] = [];

  if (screen.title) {
    body.push("    <h1>" + escapeHtml(screen.title) + "</h1>");
  }

  body.push(...emitElements(screen.elements, 2));

  return (
    script +
    "<template>\n" +
    '  <main class="evermore-screen">\n' +
    '    <section class="evermore-content">\n' +
    body.join("\n") +
    "\n    </section>\n" +
    "  </main>\n" +
    "</template>\n"
  );
}

function emitElements(
  elements: readonly IRElement[],
  depth: number,
): string[] {
  return elements.flatMap((element) => emitElement(element, depth));
}

function emitElement(element: IRElement, depth: number): string[] {
  const pad = "  ".repeat(depth);

  if (element.kind === "Text") {
    return [
      pad +
        '<p class="evermore-text">' +
        escapeHtml(element.value) +
        "</p>",
    ];
  }

  if (element.kind === "StateValue") {
    return [
      pad +
        '<output class="evermore-value" aria-live="polite">{{ ' +
        stateIdentifier(element.stateName) +
        " }}</output>",
    ];
  }

  if (element.kind === "Stack") {
    const directionClass =
      element.direction === "horizontal"
        ? "evermore-stack--horizontal"
        : "evermore-stack--vertical";

    return [
      pad +
        '<div class="evermore-stack ' +
        directionClass +
        '">',
      ...emitElements(element.elements, depth + 1),
      pad + "</div>",
    ];
  }

  let action = "";

  if (element.action?.kind === "Navigate") {
    action =
      ' @click="go(' +
      "'" +
      escapeAttribute(element.action.target) +
      "'" +
      ')"';
  }

  if (element.action?.kind === "Increment") {
    action =
      ' @click="' +
      stateIdentifier(element.action.stateName) +
      " += " +
      String(element.action.amount) +
      '"';
  }

  return [
    pad +
      '<button class="evermore-button" type="button"' +
      action +
      ">" +
      escapeHtml(element.label) +
      "</button>",
  ];
}

function hasNavigation(elements: readonly IRElement[]): boolean {
  return elements.some((element) => {
    if (element.kind === "Stack") {
      return hasNavigation(element.elements);
    }

    return (
      element.kind === "Button" &&
      element.action?.kind === "Navigate"
    );
  });
}

function stateIdentifier(name: string): string {
  return (
    "state_" +
    name
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^([0-9])/, "_$1")
  );
}

function emitGlobalStyle(): string {
  return `:root {
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  color: #111111;
  background: #f7f7f5;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

.evermore-screen {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(1.5rem, 6vw, 5rem);
}

.evermore-content {
  width: min(42rem, 100%);
  display: grid;
  gap: 1.5rem;
}

h1 {
  margin: 0;
  font-size: clamp(3rem, 9vw, 6.5rem);
  line-height: 0.94;
  letter-spacing: -0.055em;
  font-weight: 700;
}

.evermore-text {
  margin: 0;
  max-width: 38rem;
  font-size: clamp(1rem, 2vw, 1.25rem);
  line-height: 1.6;
  color: color-mix(in srgb, currentColor 72%, transparent);
}

.evermore-value {
  font-size: clamp(3rem, 12vw, 8rem);
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.055em;
}

.evermore-stack {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.evermore-stack--vertical {
  flex-direction: column;
}

.evermore-stack--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.evermore-button {
  justify-self: start;
  min-height: 3rem;
  border: 0;
  border-radius: 999px;
  padding: 0.875rem 1.375rem;
  background: #111111;
  color: #ffffff;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.evermore-button:hover {
  transform: translateY(-1px);
}

.evermore-button:active {
  transform: translateY(0);
}

.evermore-button:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f5f5f3;
    background: #0b0b0c;
  }

  .evermore-button {
    background: #f5f5f3;
    color: #111111;
  }
}
`;
}

function slug(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "evermore-app"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
