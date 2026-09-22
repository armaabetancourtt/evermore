import type { IRProgram, IRScreen } from "../ir.js";

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export function emitVue(program: IRProgram): readonly GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const routes: string[] = [];

  for (const screen of program.screens) {
    const componentName = screen.name + "Screen";
    const routePath =
      screen.name === "Home"
        ? "/"
        : "/" + screen.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

    routes.push(
      "  { path: " +
        JSON.stringify(routePath) +
        ", name: " +
        JSON.stringify(screen.name) +
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
      "import type { RouteRecordRaw } from \"vue-router\";\n\n" +
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
          screens: program.screens.map((screen) => screen.name),
        },
        null,
        2,
      ) + "\n",
  });

  return files;
}

function emitScreen(screen: IRScreen): string {
  const needsRouter = screen.controls.some(
    (control) => control.action?.kind === "Navigate",
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

  for (const control of screen.controls) {
    const action =
      control.action?.kind === "Navigate"
        ? ' @click="go(' +
          "'" +
          escapeAttribute(control.action.target) +
          "'" +
          ')"'
        : "";

    body.push(
      "    <button type=\"button\"" +
        action +
        ">" +
        escapeHtml(control.label) +
        "</button>",
    );
  }

  return (
    script +
    "<template>\n" +
    '  <main class="evermore-screen">\n' +
    body.join("\n") +
    "\n  </main>\n" +
    "</template>\n\n" +
    "<style scoped>\n" +
    ".evermore-screen {\n" +
    "  min-height: 100dvh;\n" +
    "  display: grid;\n" +
    "  align-content: center;\n" +
    "  gap: 1rem;\n" +
    "  max-width: 42rem;\n" +
    "  margin: 0 auto;\n" +
    "  padding: 2rem;\n" +
    "}\n\n" +
    "h1 {\n" +
    "  margin: 0;\n" +
    "  font: 700 clamp(2.5rem, 8vw, 5rem)/0.96 system-ui, sans-serif;\n" +
    "  letter-spacing: -0.05em;\n" +
    "}\n\n" +
    "button {\n" +
    "  justify-self: start;\n" +
    "  min-height: 2.75rem;\n" +
    "  padding: 0.75rem 1rem;\n" +
    "  border: 0;\n" +
    "  border-radius: 999px;\n" +
    "  font: inherit;\n" +
    "  cursor: pointer;\n" +
    "}\n" +
    "</style>\n"
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
