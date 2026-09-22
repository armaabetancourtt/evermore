import type {
  ButtonStatement,
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
  const parts = [
    'app "' + escapeString(program.appName) + '"',
    "",
    ...program.screens.flatMap((screen, index) => [
      formatScreen(screen, style),
      ...(index === program.screens.length - 1 ? [] : [""]),
    ]),
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
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
