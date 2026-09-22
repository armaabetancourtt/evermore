import type {
  ButtonStatement,
  ComponentDeclaration,
  DataDeclaration,
  Program,
  ScreenDeclaration,
  ScreenStatement,
  StackStatement,
} from "./ast.js";
import { parse } from "./parser.js";

export type FormatStyle = "natural" | "explicit";

export function formatSource(
  source: string,
  style: FormatStyle = "natural",
): string {
  return formatProgram(parse(source), style);
}

export function formatProgram(
  program: Program,
  style: FormatStyle = "natural",
): string {
  const declarations = [
    ...program.data.map((declaration) =>
      formatData(declaration, style),
    ),
    ...program.components.map((component) =>
      formatComponent(component, style),
    ),
    ...program.screens.map((screen) => formatScreen(screen, style)),
  ];

  const parts = [
    'app "' + escapeString(program.appName) + '"',
    ...(declarations.length > 0
      ? ["", declarations.join("\n\n")]
      : []),
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function formatData(
  declaration: DataDeclaration,
  style: FormatStyle,
): string {
  const body = declaration.fields
    .map(
      (field) =>
        indent(1) + field.name + " " + field.typeName,
    )
    .join("\n");

  if (style === "explicit") {
    return (
      "data " +
      declaration.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  return (
    "data " +
    declaration.name +
    "\n" +
    (body ? "\n" + body + "\n" : "") +
    "end"
  );
}

function formatComponent(
  component: ComponentDeclaration,
  style: FormatStyle,
): string {
  const body = component.body
    .map((statement) => formatStatement(statement, style, 1))
    .join("\n\n");

  if (style === "explicit") {
    return (
      "component " +
      component.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  return (
    "component " +
    component.name +
    "\n" +
    (body ? "\n" + body + "\n" : "") +
    "end"
  );
}

function formatScreen(
  screen: ScreenDeclaration,
  style: FormatStyle,
): string {
  if (style === "explicit") {
    const body = screen.body
      .map((statement) => formatStatement(statement, style, 1))
      .join("\n\n");

    return (
      "screen " +
      screen.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  const body = screen.body
    .map((statement) => formatStatement(statement, style, 1))
    .join("\n\n");

  return "screen " + screen.name + (body ? "\n\n" + body : "");
}

function formatStatement(
  statement: ScreenStatement,
  style: FormatStyle,
  depth: number,
): string {
  switch (statement.kind) {
    case "StateDeclaration":
      return (
        indent(depth) +
        "state " +
        statement.name +
        " starts " +
        String(statement.initialValue)
      );

    case "TitleStatement":
      return indent(depth) + 'title "' + escapeString(statement.text) + '"';

    case "TextStatement":
      return indent(depth) + 'text "' + escapeString(statement.text) + '"';

    case "ShowStatement":
      return indent(depth) + "show " + statement.stateName;

    case "ButtonStatement":
      return formatButton(statement, style, depth);

    case "StackStatement":
      return formatStack(statement, style, depth);

    case "UseStatement":
      return indent(depth) + "use " + statement.componentName;
  }
}

function formatStack(
  stack: StackStatement,
  style: FormatStyle,
  depth: number,
): string {
  const head = indent(depth) + "stack " + stack.direction;
  const body = stack.body
    .map((statement) => formatStatement(statement, style, depth + 1))
    .join("\n\n");

  if (style === "explicit") {
    return (
      head +
      " {\n" +
      (body ? body + "\n" : "") +
      indent(depth) +
      "}"
    );
  }

  return (
    head +
    "\n" +
    (body ? "\n" + body + "\n" : "") +
    indent(depth) +
    "end"
  );
}

function formatButton(
  button: ButtonStatement,
  style: FormatStyle,
  depth: number,
): string {
  const head =
    indent(depth) + 'button "' + escapeString(button.label) + '"';

  if (!button.action) return head;

  const action =
    button.action.kind === "NavigationAction"
      ? "opens " + button.action.target
      : "increases " + button.action.stateName;

  if (style === "explicit") {
    return (
      head +
      " {\n" +
      indent(depth + 1) +
      action +
      "\n" +
      indent(depth) +
      "}"
    );
  }

  return head + "\n" + indent(depth + 1) + action;
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function escapeString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t");
}
