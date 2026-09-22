import type {
  ButtonStatement,
  ComponentDeclaration,
  DataDeclaration,
  Expression,
  FunctionDeclaration,
  FunctionStatement,
  Program,
  ScreenDeclaration,
  ScreenStatement,
  StackStatement,
  TypeAnnotation,
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
    ...program.functions.map((fn) =>
      formatFunction(fn, style),
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
        indent(1) + field.name + " " + formatTypeAnnotation(field.type),
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

function formatTypeAnnotation(
  annotation: TypeAnnotation,
): string {
  switch (annotation.kind) {
    case "NamedTypeAnnotation":
      return annotation.name;
    case "ListTypeAnnotation":
      return "list of " + formatTypeAnnotation(annotation.elementType);
    case "OptionalTypeAnnotation":
      return "optional " + formatTypeAnnotation(annotation.valueType);
  }
}

function formatFunction(
  fn: FunctionDeclaration,
  style: FormatStyle,
): string {
  const lines: string[] = [];

  for (const parameter of fn.parameters) {
    lines.push(
      indent(1) +
        "takes " +
        parameter.name +
        " " +
        formatTypeAnnotation(parameter.type),
    );
  }

  lines.push(
    indent(1) + "returns " + formatTypeAnnotation(fn.returnType),
  );

  if (fn.body.length > 0) {
    lines.push("");
    lines.push(
      ...fn.body.map((statement) =>
        formatFunctionStatement(statement, 1),
      ),
    );
  }

  if (style === "explicit") {
    return (
      "function " +
      fn.name +
      " {\n" +
      lines.join("\n") +
      "\n}"
    );
  }

  return (
    "function " +
    fn.name +
    "\n\n" +
    lines.join("\n") +
    "\nend"
  );
}

function formatFunctionStatement(
  statement: FunctionStatement,
  depth: number,
): string {
  if (statement.kind === "LetStatement") {
    return (
      indent(depth) +
      "let " +
      statement.name +
      " = " +
      formatExpression(statement.expression)
    );
  }

  return (
    indent(depth) +
    "return " +
    formatExpression(statement.expression)
  );
}

function formatExpression(
  expression: Expression,
  parentPrecedence = 0,
  rightChild = false,
): string {
  switch (expression.kind) {
    case "NumberExpression":
      return String(expression.value);

    case "StringExpression":
      return '"' + escapeString(expression.value) + '"';

    case "BooleanExpression":
      return expression.value ? "true" : "false";

    case "NoneExpression":
      return "none";

    case "ListExpression":
      return (
        "[" +
        expression.elements
          .map((element) => formatExpression(element))
          .join(", ") +
        "]"
      );

    case "IdentifierExpression":
      return expression.name;

    case "CallExpression":
      return (
        expression.callee +
        "(" +
        expression.arguments
          .map((argument) => formatExpression(argument))
          .join(", ") +
        ")"
      );

    case "BinaryExpression": {
      const precedence =
        expression.operator === "*" || expression.operator === "/"
          ? 2
          : 1;

      const left = formatExpression(
        expression.left,
        precedence,
        false,
      );
      const right = formatExpression(
        expression.right,
        precedence,
        true,
      );
      const source =
        left + " " + expression.operator + " " + right;

      if (
        precedence < parentPrecedence ||
        (rightChild && precedence === parentPrecedence)
      ) {
        return "(" + source + ")";
      }

      return source;
    }
  }
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
