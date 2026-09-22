import type {
  ButtonStatement,
  Program,
  ScreenDeclaration,
  UIStatement,
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
  statement: UIStatement,
  style: FormatStyle,
  depth: number,
): string {
  switch (statement.kind) {
    case "TitleStatement":
      return indent(depth) + 'title "' + escapeString(statement.text) + '"';

    case "TextStatement":
      return indent(depth) + 'text "' + escapeString(statement.text) + '"';

    case "ButtonStatement":
      return formatButton(statement, style, depth);
  }
}

function formatButton(
  button: ButtonStatement,
  style: FormatStyle,
  depth: number,
): string {
  const head =
    indent(depth) + 'button "' + escapeString(button.label) + '"';

  if (!button.action) return head;

  if (style === "explicit") {
    return (
      head +
      " {\n" +
      indent(depth + 1) +
      "opens " +
      button.action.target +
      "\n" +
      indent(depth) +
      "}"
    );
  }

  return (
    head +
    "\n" +
    indent(depth + 1) +
    "opens " +
    button.action.target
  );
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
