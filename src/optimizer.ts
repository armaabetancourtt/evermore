import type {
  IRClassModel,
  IRDataModel,
  IRExpression,
  IRFunctionStatement,
  IRMethod,
  IRProgram,
  IRProtocol,
} from "./ir.js";

export type OptimizationStats = {
  readonly foldedConstants: number;
  readonly eliminatedConstantBranches: number;
};

export type OptimizationResult = {
  readonly program: IRProgram;
  readonly stats: OptimizationStats;
};

export function optimizeIR(program: IRProgram): OptimizationResult {
  const stats = {
    foldedConstants: 0,
    eliminatedConstantBranches: 0,
  };

  const optimizeMethod = (method: IRMethod): IRMethod => ({
    ...method,
    body: method.body.map((statement) =>
      optimizeStatement(statement, stats),
    ),
  });

  const optimizeData = (model: IRDataModel): IRDataModel => ({
    ...model,
    methods: model.methods.map(optimizeMethod),
  });

  const optimizeClass = (model: IRClassModel): IRClassModel => ({
    ...model,
    methods: model.methods.map(optimizeMethod),
  });

  const optimizeProtocol = (model: IRProtocol): IRProtocol => ({
    ...model,
    methods: model.methods.map(optimizeMethod),
  });

  return {
    program: {
      ...program,
      data: program.data.map(optimizeData),
      classes: program.classes.map(optimizeClass),
      protocols: program.protocols.map(optimizeProtocol),
      functions: program.functions.map((fn) => ({
        ...fn,
        body: fn.body.map((statement) =>
          optimizeStatement(statement, stats),
        ),
      })),
    },
    stats,
  };
}

function optimizeStatement(
  statement: IRFunctionStatement,
  stats: { foldedConstants: number; eliminatedConstantBranches: number },
): IRFunctionStatement {
  if (statement.kind === "While") {
    return {
      ...statement,
      condition: optimizeExpression(statement.condition, stats),
      body: statement.body.map((nested) =>
        optimizeStatement(nested, stats),
      ),
    };
  }

  return {
    ...statement,
    expression: optimizeExpression(statement.expression, stats),
  };
}

function optimizeExpression(
  expression: IRExpression,
  stats: { foldedConstants: number; eliminatedConstantBranches: number },
): IRExpression {
  switch (expression.kind) {
    case "Number":
    case "String":
    case "Boolean":
    case "None":
    case "ChoiceCase":
    case "Identifier":
      return expression;

    case "List":
      return {
        ...expression,
        elements: expression.elements.map((item) =>
          optimizeExpression(item, stats),
        ),
      };

    case "Set":
      return {
        ...expression,
        elements: expression.elements.map((item) =>
          optimizeExpression(item, stats),
        ),
      };

    case "Map":
      return {
        ...expression,
        entries: expression.entries.map((entry) => ({
          key: optimizeExpression(entry.key, stats),
          value: optimizeExpression(entry.value, stats),
        })),
      };

    case "Result":
      return {
        ...expression,
        value: optimizeExpression(expression.value, stats),
      };

    case "Member":
      return {
        ...expression,
        object: optimizeExpression(expression.object, stats),
      };

    case "MethodCall":
      return {
        ...expression,
        object: optimizeExpression(expression.object, stats),
        arguments: expression.arguments.map((argument) =>
          optimizeExpression(argument, stats),
        ),
      };

    case "Construct":
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          value: optimizeExpression(field.value, stats),
        })),
        methods: expression.methods.map((method) => ({
          ...method,
          body: method.body.map((statement) =>
            optimizeStatement(statement, stats),
          ),
        })),
      };

    case "Call":
      return {
        ...expression,
        arguments: expression.arguments.map((argument) =>
          optimizeExpression(argument, stats),
        ),
      };

    case "Match":
      return {
        ...expression,
        value: optimizeExpression(expression.value, stats),
        cases: expression.cases.map((item) => ({
          ...item,
          expression: optimizeExpression(item.expression, stats),
        })),
      };

    case "If": {
      const condition = optimizeExpression(expression.condition, stats);
      const thenExpression = optimizeExpression(
        expression.thenExpression,
        stats,
      );
      const elseExpression = optimizeExpression(
        expression.elseExpression,
        stats,
      );

      if (condition.kind === "Boolean") {
        stats.eliminatedConstantBranches += 1;
        return condition.value ? thenExpression : elseExpression;
      }

      return {
        ...expression,
        condition,
        thenExpression,
        elseExpression,
      };
    }

    case "Binary": {
      const left = optimizeExpression(expression.left, stats);
      const right = optimizeExpression(expression.right, stats);

      if (left.kind === "Number" && right.kind === "Number") {
        const folded = foldNumericBinary(
          expression.operator,
          left.value,
          right.value,
        );
        if (folded) {
          stats.foldedConstants += 1;
          return folded;
        }
      }

      return {
        ...expression,
        left,
        right,
      };
    }
  }
}

function foldNumericBinary(
  operator: string,
  left: number,
  right: number,
): IRExpression | undefined {
  switch (operator) {
    case "+":
      return { kind: "Number", value: left + right };
    case "-":
      return { kind: "Number", value: left - right };
    case "*":
      return { kind: "Number", value: left * right };
    case "/":
      return { kind: "Number", value: left / right };
    case "==":
      return { kind: "Boolean", value: left === right };
    case "!=":
      return { kind: "Boolean", value: left !== right };
    case ">":
      return { kind: "Boolean", value: left > right };
    case ">=":
      return { kind: "Boolean", value: left >= right };
    case "<":
      return { kind: "Boolean", value: left < right };
    case "<=":
      return { kind: "Boolean", value: left <= right };
    default:
      return undefined;
  }
}
