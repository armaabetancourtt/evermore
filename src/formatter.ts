import type {
  ButtonStatement,
  ChoiceDeclaration,
  ClassDeclaration,
  ComponentDeclaration,
  DataDeclaration,
  Expression,
  FunctionDeclaration,
  FunctionStatement,
  Program,
  ProtocolDeclaration,
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
    ...program.protocols.map((protocol) =>
      formatProtocol(protocol, style),
    ),
    ...program.data.map((declaration) =>
      formatData(declaration, style),
    ),
    ...program.classes.map((declaration) =>
      formatClass(declaration, style),
    ),
    ...program.choices.map((choice) =>
      formatChoice(choice, style),
    ),
    ...program.functions.map((fn) =>
      formatFunction(fn, style),
    ),
    ...program.components.map((component) =>
      formatComponent(component, style),
    ),
    ...program.screens.map((screen) => formatScreen(screen, style)),
  ];

  const header =
    program.unitKind === "module"
      ? "module " + (program.moduleName ?? program.appName)
      : 'app "' + escapeString(program.appName) + '"';

  const importLines = program.imports.map(
    (declaration) =>
      'import "' + escapeString(declaration.path) + '"',
  );

  const parts = [
    header,
    ...(importLines.length > 0 ? importLines : []),
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
  const bodyParts = [
    ...declaration.conformances.map(
      (conformance) => indent(1) + "conforms " + conformance.name,
    ),
    ...declaration.fields.map(
      (field) =>
        indent(1) + field.name + " " + formatTypeAnnotation(field.type),
    ),
    ...declaration.methods.map((method) =>
      formatFunction(method, style, 1),
    ),
  ];
  const body = bodyParts.join("\n");

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

function formatClass(
  declaration: ClassDeclaration,
  style: FormatStyle,
): string {
  const bodyParts = [
    ...declaration.conformances.map(
      (conformance) => indent(1) + "conforms " + conformance.name,
    ),
    ...declaration.fields.map(
      (field) =>
        indent(1) +
        (field.visibility === "private" ? "private " : "public ") +
        field.name +
        " " +
        formatTypeAnnotation(field.type),
    ),
    ...declaration.methods.map((method) =>
      formatFunction(method, style, 1),
    ),
  ];
  const body = bodyParts.join("\n");

  if (style === "explicit") {
    return (
      "class " +
      declaration.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  return (
    "class " +
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
    case "SetTypeAnnotation":
      return "set of " + formatTypeAnnotation(annotation.elementType);
    case "MapTypeAnnotation":
      return (
        "map of " +
        formatTypeAnnotation(annotation.keyType) +
        " to " +
        formatTypeAnnotation(annotation.valueType)
      );
    case "ResultTypeAnnotation":
      return (
        "result of " +
        formatTypeAnnotation(annotation.okType) +
        " error " +
        formatTypeAnnotation(annotation.errorType)
      );
    case "OptionalTypeAnnotation":
      return "optional " + formatTypeAnnotation(annotation.valueType);
  }
}

function formatProtocol(
  protocol: ProtocolDeclaration,
  style: FormatStyle,
): string {
  const body = [
    ...protocol.fields.map(
      (field) =>
        indent(1) +
        field.name +
        " " +
        formatTypeAnnotation(field.type),
    ),
    ...protocol.methods.map((method) =>
      formatFunction(method, style, 1),
    ),
  ].join("\n");

  if (style === "explicit") {
    return (
      "protocol " +
      protocol.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  return (
    "protocol " +
    protocol.name +
    "\n" +
    (body ? "\n" + body + "\n" : "") +
    "end"
  );
}

function formatChoice(
  choice: ChoiceDeclaration,
  style: FormatStyle,
): string {
  const body = choice.cases
    .map((item) => indent(1) + item.name)
    .join("\n");

  if (style === "explicit") {
    return (
      "choice " +
      choice.name +
      " {\n" +
      (body ? body + "\n" : "") +
      "}"
    );
  }

  return (
    "choice " +
    choice.name +
    "\n" +
    (body ? "\n" + body + "\n" : "") +
    "end"
  );
}

function formatFunction(
  fn: FunctionDeclaration,
  style: FormatStyle,
  depth = 0,
): string {
  const lines: string[] = [];

  for (const parameter of fn.typeParameters) {
    lines.push(
      indent(depth + 1) +
        "generic " +
        parameter.name +
        (parameter.constraintName
          ? " conforms " + parameter.constraintName
          : ""),
    );
  }

  for (const parameter of fn.parameters) {
    lines.push(
      indent(depth + 1) +
        "takes " +
        parameter.name +
        " " +
        formatTypeAnnotation(parameter.type),
    );
  }

  lines.push(
    indent(depth + 1) +
      "returns " +
      formatTypeAnnotation(fn.returnType),
  );

  if (fn.body.length > 0) {
    lines.push("");
    lines.push(
      ...fn.body.map((statement) =>
        formatFunctionStatement(statement, depth + 1),
      ),
    );
  }

  const head = indent(depth) + "function " + fn.name;

  if (style === "explicit") {
    return (
      head +
      " {\n" +
      lines.join("\n") +
      "\n" +
      indent(depth) +
      "}"
    );
  }

  return (
    head +
    "\n\n" +
    lines.join("\n") +
    "\n" +
    indent(depth) +
    "end"
  );
}

function formatFunctionStatement(
  statement: FunctionStatement,
  depth: number,
): string {
  if (statement.kind === "LetStatement" || statement.kind === "VarStatement") {
    return (
      indent(depth) +
      (statement.kind === "LetStatement" ? "let " : "var ") +
      statement.name +
      " = " +
      formatExpression(statement.expression, 0, false, depth)
    );
  }

  if (statement.kind === "SetStatement") {
    return (
      indent(depth) +
      "set " +
      statement.name +
      " = " +
      formatExpression(statement.expression, 0, false, depth)
    );
  }

  return (
    indent(depth) +
    "return " +
    formatExpression(statement.expression, 0, false, depth)
  );
}

function formatExpression(
  expression: Expression,
  parentPrecedence = 0,
  rightChild = false,
  depth = 0,
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
          .map((element) => formatExpression(element, 0, false, depth))
          .join(", ") +
        "]"
      );

    case "SetExpression":
      return (
        "set[" +
        expression.elements
          .map((element) => formatExpression(element, 0, false, depth))
          .join(", ") +
        "]"
      );

    case "MapExpression":
      return (
        "map[" +
        expression.entries
          .map(
            (entry) =>
              formatExpression(entry.key, 0, false, depth) +
              ": " +
              formatExpression(entry.value, 0, false, depth),
          )
          .join(", ") +
        "]"
      );

    case "MatchExpression":
      return (
        "match " +
        formatExpression(expression.value, 0, false, depth) +
        "\n" +
        expression.cases
          .map(
            (branch) =>
              indent(depth + 1) +
              "case " +
              branch.caseName +
              (branch.bindingName ? " " + branch.bindingName : "") +
              " then " +
              formatExpression(
                branch.expression,
                0,
                false,
                depth + 1,
              ),
          )
          .join("\n") +
        "\n" +
        indent(depth) +
        "end"
      );

    case "MemberExpression":
      return (
        formatExpression(
          expression.object,
          4,
          false,
          depth,
        ) +
        "." +
        expression.member
      );

    case "ChoiceCaseExpression":
      return expression.choiceName + "." + expression.caseName;

    case "IdentifierExpression":
      return expression.name;

    case "IfExpression":
      return (
        "if " +
        formatExpression(expression.condition, 0, false, depth) +
        " then " +
        formatExpression(expression.thenExpression, 0, false, depth) +
        " else " +
        formatExpression(expression.elseExpression, 0, false, depth)
      );

    case "MethodCallExpression":
      return (
        formatExpression(expression.object, 4, false, depth) +
        "." +
        expression.method +
        "(" +
        expression.arguments
          .map((argument) => formatExpression(argument, 0, false, depth))
          .join(", ") +
        ")"
      );

    case "CallExpression":
      return (
        expression.callee +
        "(" +
        expression.arguments
          .map((argument) => formatExpression(argument, 0, false, depth))
          .join(", ") +
        ")"
      );

    case "BinaryExpression": {
      const precedence =
        expression.operator === "*" || expression.operator === "/"
          ? 3
          : expression.operator === "+" || expression.operator === "-"
            ? 2
            : 1;

      const left = formatExpression(
        expression.left,
        precedence,
        false,
        depth,
      );
      const right = formatExpression(
        expression.right,
        precedence,
        true,
        depth,
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
