import type { IRProgram, IRScreen } from "../ir.js";

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
              build: "vite build",
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
            },
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
          screens: program.screens.map((screen) => screen.id),
        },
        null,
        2,
      ) + "\n",
  });

  return files;
}

function emitScreen(screen: IRScreen): string {
  const needsRouter = screen.elements.some(
    (element) =>
      element.kind === "Button" &&
      element.action?.kind === "Navigate",
  );

  const script = needsRouter
    ? '<script setup lang="ts">\n' +
      'import { useRouter } from "vue-router";\n\n' +
      "const router = useRouter();\n" +
      "const go = (screen: string) => router.push({ name: screen });\n" +
      "</script>\n\n"
    : "";

  const body: string[] = [];

  if (screen.title) {
    body.push("    <h1>" + escapeHtml(screen.title) + "</h1>");
  }

  for (const element of screen.elements) {
    if (element.kind === "Text") {
      body.push(
        '    <p class="evermore-text">' +
          escapeHtml(element.value) +
          "</p>",
      );
      continue;
    }

    const action =
      element.action?.kind === "Navigate"
        ? ' @click="go(' +
          "'" +
          escapeAttribute(element.action.target) +
          "'" +
          ')"'
        : "";

    body.push(
      '    <button class="evermore-button" type="button"' +
        action +
        ">" +
        escapeHtml(element.label) +
        "</button>",
    );
  }

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
