import type {
  AgentDeclaration,
  ArrayDeclaration,
  BinaryExpression,
  BinaryOperator,
  BreakStatement,
  ButtonAction,
  ButtonStatement,
  CallExpression,
  ClassDeclaration,
  ClassField,
  ChoiceDeclaration,
  ChoiceCase,
  ComponentDeclaration,
  ContextDeclaration,
  ContinueStatement,
  DataDeclaration,
  DatasetDeclaration,
  DataField,
  DeploymentDeclaration,
  DatabaseDeclaration,
  EndpointDeclaration,
  EvaluationDeclaration,
  Expression,
  ForEachStatement,
  FunctionDeclaration,
  FunctionParameter,
  FunctionStatement,
  HttpMethod,
  IdentifierExpression,
  ImportDeclaration,
  IncrementAction,
  LetStatement,
  ListExpression,
  MapEntry,
  MapExpression,
  MatchCase,
  MatchExpression,
  MemberExpression,
  MethodCallExpression,
  MobileDeclaration,
  NavigationAction,
  NumberExpression,
  PipelineDeclaration,
  PythonDeclaration,
  JobDeclaration,
  Program,
  ProtocolConformance,
  ProtocolDeclaration,
  RealtimeDeclaration,
  RepositoryDeclaration,
  ReturnStatement,
  SetExpression,
  SetStatement,
  ServerDeclaration,
  ScreenDeclaration,
  ScreenStatement,
  ShowStatement,
  SourceSpan,
  StackDirection,
  StackStatement,
  StateDeclaration,
  StringExpression,
  TextStatement,
  TitleStatement,
  ToolDeclaration,
  TypeAnnotation,
  UnaryExpression,
  TypeParameter,
  UseStatement,
  VarStatement,
  VisualStatement,
  WhileStatement,
} from "./ast.js";
import {
  EvermoreDiagnosticError,
  type Diagnostic,
} from "./diagnostics.js";
import { lex, type Token, type TokenKind } from "./lexer.js";

export function parse(source: string): Program {
  return new Parser(lex(source)).parseProgram();
}

class Parser {
  private index = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly tokens: readonly Token[]) {}

  parseProgram(): Program {
    let header: Token;
    let unitKind: "app" | "module";
    let appName: string;
    let moduleName: string | undefined;

    if (this.match("app")) {
      header = this.previous();
      unitKind = "app";
      const nameToken = this.consume(
        "string",
        "Expected an application name.",
      );
      appName = nameToken.value ?? "";
    } else if (this.match("module")) {
      header = this.previous();
      unitKind = "module";
      const nameToken = this.consume(
        "identifier",
        "Expected a module name.",
      );
      moduleName = nameToken.value ?? nameToken.lexeme;
      appName = moduleName;
    } else {
      return this.fail(
        this.peek(),
        "E1000",
        'Every Evermore source starts with app "Name" or module Name.',
        "Use app for the project entrypoint and module for imported source files.",
      );
    }

    const imports: ImportDeclaration[] = [];

    while (this.match("import")) {
      const importToken = this.previous();
      const source = this.consume(
        "string",
        "Expected a relative module path after import.",
      );

      imports.push({
        path: source.value ?? "",
        span: spanFrom(importToken, source),
      });
    }

    const data: DataDeclaration[] = [];
    const classes: ClassDeclaration[] = [];
    const protocols: ProtocolDeclaration[] = [];
    const choices: ChoiceDeclaration[] = [];
    const functions: FunctionDeclaration[] = [];
    const servers: ServerDeclaration[] = [];
    const tools: ToolDeclaration[] = [];
    const contexts: ContextDeclaration[] = [];
    const agents: AgentDeclaration[] = [];
    const evaluations: EvaluationDeclaration[] = [];
    const mobiles: MobileDeclaration[] = [];
    const datasets: DatasetDeclaration[] = [];
    const arrays: ArrayDeclaration[] = [];
    const pythonBridges: PythonDeclaration[] = [];
    const pipelines: PipelineDeclaration[] = [];
    const deployments: DeploymentDeclaration[] = [];
    const components: ComponentDeclaration[] = [];
    const screens: ScreenDeclaration[] = [];

    while (!this.check("eof")) {
      try {
        if (this.check("data")) {
          data.push(this.parseData());
          continue;
        }

        if (this.check("class")) {
          classes.push(this.parseClass());
          continue;
        }

        if (this.check("protocol")) {
          protocols.push(this.parseProtocol());
          continue;
        }

        if (this.check("choice")) {
          choices.push(this.parseChoice());
          continue;
        }

        if (this.check("function")) {
          functions.push(this.parseFunction());
          continue;
        }

        if (this.check("server")) {
          servers.push(this.parseServer());
          continue;
        }

        if (this.check("tool")) {
          tools.push(this.parseTool());
          continue;
        }

        if (this.check("context")) {
          contexts.push(this.parseContext());
          continue;
        }

        if (this.check("agent")) {
          agents.push(this.parseAgent());
          continue;
        }

        if (this.check("evaluation")) {
          evaluations.push(this.parseEvaluation());
          continue;
        }

        if (this.check("mobile")) {
          mobiles.push(this.parseMobile());
          continue;
        }

        if (this.check("dataset")) {
          datasets.push(this.parseDataset());
          continue;
        }

        if (this.check("array")) {
          arrays.push(this.parseArray());
          continue;
        }

        if (this.check("python")) {
          pythonBridges.push(this.parsePython());
          continue;
        }

        if (this.check("pipeline")) {
          pipelines.push(this.parsePipeline());
          continue;
        }

        if (this.check("deploy")) {
          deployments.push(this.parseDeployment());
          continue;
        }

        if (this.check("component")) {
          components.push(this.parseComponent());
          continue;
        }

        if (this.check("screen")) {
          screens.push(this.parseScreen());
          continue;
        }

        this.fail(
          this.peek(),
          "E1007",
          "Expected a top-level declaration.",
          "Imports must appear immediately after the app/module header; otherwise declare data, a class, a protocol, a choice, a function, a server, AI declarations, a component, or a screen.",
        );
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeTopLevel();
      }
    }

    const eof = this.consume("eof", "Expected end of file.");

    if (this.diagnostics.length > 0) {
      throw new EvermoreDiagnosticError(this.diagnostics);
    }

    return {
      kind: "Program",
      unitKind,
      appName,
      ...(moduleName ? { moduleName } : {}),
      imports,
      data,
      classes,
      protocols,
      choices,
      functions,
      servers,
      tools,
      contexts,
      agents,
      evaluations,
      mobiles,
      datasets,
      arrays,
      pythonBridges,
      pipelines,
      deployments,
      components,
      screens,
      span: {
        start: header.span.start,
        end: eof.span.end,
      },
    };
  }

  private parseData(): DataDeclaration {
    const start = this.consume("data", "Expected a data declaration.");
    const name = this.consume("identifier", "Expected a data type name.");
    const explicitBlock = this.match("lbrace");
    const conformances: ProtocolConformance[] = [];
    const fields: DataField[] = [];
    const methods: FunctionDeclaration[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.match("conforms")) {
        const protocolName = this.consume(
          "identifier",
          "Expected a protocol name after conforms.",
        );

        conformances.push({
          name: protocolName.value ?? protocolName.lexeme,
          span: protocolName.span,
        });
        continue;
      }

      if (this.check("function")) {
        methods.push(this.parseFunction());
        continue;
      }

      const fieldName = this.consume(
        "identifier",
        "Expected a field name or function in the data declaration.",
      );
      const fieldType = this.parseTypeAnnotation();

      fields.push({
        name: fieldName.value ?? fieldName.lexeme,
        type: fieldType,
        span: {
          start: fieldName.span.start,
          end: fieldType.span.end,
        },
      });
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the data declaration.')
      : this.consume("end", 'Expected "end" to close the data declaration.');

    return {
      kind: "DataDeclaration",
      name: name.value ?? name.lexeme,
      conformances,
      fields,
      methods,
      span: spanFrom(start, end),
    };
  }

  private parseClass(): ClassDeclaration {
    const start = this.consume("class", "Expected a class declaration.");
    const name = this.consume("identifier", "Expected a class name.");
    const explicitBlock = this.match("lbrace");
    const conformances: ProtocolConformance[] = [];
    const fields: ClassField[] = [];
    const methods: FunctionDeclaration[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.match("conforms")) {
        const protocolName = this.consume(
          "identifier",
          "Expected a protocol name after conforms.",
        );

        conformances.push({
          name: protocolName.value ?? protocolName.lexeme,
          span: protocolName.span,
        });
        continue;
      }

      if (this.check("function")) {
        methods.push(this.parseFunction());
        continue;
      }

      let visibility: "public" | "private" = "public";
      let visibilityStart: Token | undefined;

      if (this.match("public")) {
        visibilityStart = this.previous();
      } else if (this.match("private")) {
        visibility = "private";
        visibilityStart = this.previous();
      }

      const fieldName = this.consume(
        "identifier",
        "Expected a class field name or function.",
      );
      const fieldType = this.parseTypeAnnotation();

      fields.push({
        name: fieldName.value ?? fieldName.lexeme,
        type: fieldType,
        visibility,
        span: {
          start: (visibilityStart ?? fieldName).span.start,
          end: fieldType.span.end,
        },
      });
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the class declaration.')
      : this.consume("end", 'Expected "end" to close the class declaration.');

    return {
      kind: "ClassDeclaration",
      name: name.value ?? name.lexeme,
      conformances,
      fields,
      methods,
      span: spanFrom(start, end),
    };
  }

  private parseProtocol(): ProtocolDeclaration {
    const start = this.consume(
      "protocol",
      "Expected a protocol declaration.",
    );
    const name = this.consume("identifier", "Expected a protocol name.");
    const explicitBlock = this.match("lbrace");
    const fields: DataField[] = [];
    const methods: FunctionDeclaration[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.check("function")) {
        methods.push(this.parseFunction());
        continue;
      }

      const fieldName = this.consume(
        "identifier",
        "Expected a required field name or function in the protocol.",
      );
      const fieldType = this.parseTypeAnnotation();

      fields.push({
        name: fieldName.value ?? fieldName.lexeme,
        type: fieldType,
        span: {
          start: fieldName.span.start,
          end: fieldType.span.end,
        },
      });
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the protocol.')
      : this.consume("end", 'Expected "end" to close the protocol.');

    return {
      kind: "ProtocolDeclaration",
      name: name.value ?? name.lexeme,
      fields,
      methods,
      span: spanFrom(start, end),
    };
  }

  private parseChoice(): ChoiceDeclaration {
    const start = this.consume("choice", "Expected a choice declaration.");
    const name = this.consume("identifier", "Expected a choice type name.");
    const explicitBlock = this.match("lbrace");
    const cases: ChoiceCase[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      const caseToken = this.consume(
        "identifier",
        "Expected a choice case name.",
      );

      cases.push({
        name: caseToken.value ?? caseToken.lexeme,
        span: caseToken.span,
      });
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the choice.')
      : this.consume("end", 'Expected "end" to close the choice.');

    return {
      kind: "ChoiceDeclaration",
      name: name.value ?? name.lexeme,
      cases,
      span: spanFrom(start, end),
    };
  }

  private parseFunction(): FunctionDeclaration {
    const start = this.consume("function", "Expected a function declaration.");
    const name = this.consume("identifier", "Expected a function name.");
    const explicitBlock = this.match("lbrace");
    const typeParameters: TypeParameter[] = [];
    const parameters: FunctionParameter[] = [];
    const body: FunctionStatement[] = [];
    let returnType: TypeAnnotation | undefined;

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      try {
        if (this.match("generic")) {
          const typeName = this.consume(
            "identifier",
            "Expected a generic type parameter name.",
          );

          let constraintName: string | undefined;
          let end = typeName.span.end;

          if (this.match("conforms")) {
            const constraint = this.consume(
              "identifier",
              "Expected a protocol name after conforms.",
            );
            constraintName = constraint.value ?? constraint.lexeme;
            end = constraint.span.end;
          }

          typeParameters.push({
            name: typeName.value ?? typeName.lexeme,
            ...(constraintName ? { constraintName } : {}),
            span: {
              start: typeName.span.start,
              end,
            },
          });
          continue;
        }

        if (this.match("takes")) {
          const parameterName = this.consume(
            "identifier",
            "Expected a parameter name after takes.",
          );
          const parameterType = this.parseTypeAnnotation();

          parameters.push({
            name: parameterName.value ?? parameterName.lexeme,
            type: parameterType,
            span: {
              start: parameterName.span.start,
              end: parameterType.span.end,
            },
          });
          continue;
        }

        if (this.match("returns")) {
          const parsedReturnType = this.parseTypeAnnotation();

          if (returnType !== undefined) {
            this.fail(
              this.previous(),
              "E1009",
              "Function return type is declared more than once.",
              "Keep a single returns declaration.",
            );
          }

          returnType = parsedReturnType;
          continue;
        }

        if (this.match("let")) {
          body.push(this.parseLet(this.previous()));
          continue;
        }

        if (this.match("var")) {
          body.push(this.parseVar(this.previous()));
          continue;
        }

        if (this.match("set")) {
          body.push(this.parseSet(this.previous()));
          continue;
        }

        if (this.match("while")) {
          body.push(this.parseWhile(this.previous()));
          continue;
        }

        if (this.match("for")) {
          body.push(this.parseForEach(this.previous()));
          continue;
        }

        if (this.match("break")) {
          body.push(this.parseBreak(this.previous()));
          continue;
        }

        if (this.match("continue")) {
          body.push(this.parseContinue(this.previous()));
          continue;
        }

        if (this.match("return")) {
          body.push(this.parseReturn(this.previous()));
          continue;
        }

        this.fail(
          this.peek(),
          "E1010",
          "Expected a function declaration item or statement.",
          "Use generic, takes, returns, let, var, set, while, for, break, continue, or return.",
        );
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeFunction();
      }
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the function.')
      : this.consume("end", 'Expected "end" to close the function.');

    if (returnType === undefined) {
      this.fail(
        name,
        "E1011",
        'Function "' + (name.value ?? name.lexeme) + '" has no return type.',
        "Add returns <type> before the function body completes.",
      );
    }

    return {
      kind: "FunctionDeclaration",
      name: name.value ?? name.lexeme,
      typeParameters,
      parameters,
      returnType,
      body,
      span: spanFrom(start, end),
    };
  }

  private parseLet(start: Token): LetStatement {
    const name = this.consume("identifier", "Expected a local variable name.");
    this.consume("equal", 'Expected "=" after the local variable name.');
    const expression = this.parseExpression();

    return {
      kind: "LetStatement",
      name: name.value ?? name.lexeme,
      expression,
      span: {
        start: start.span.start,
        end: expression.span.end,
      },
    };
  }

  private parseVar(start: Token): VarStatement {
    const name = this.consume("identifier", "Expected a mutable local name.");
    this.consume("equal", 'Expected "=" after the mutable local name.');
    const expression = this.parseExpression();

    return {
      kind: "VarStatement",
      name: name.value ?? name.lexeme,
      expression,
      span: {
        start: start.span.start,
        end: expression.span.end,
      },
    };
  }

  private parseSet(start: Token): SetStatement {
    const name = this.consume("identifier", "Expected a local name after set.");
    this.consume("equal", 'Expected "=" after the local name.');
    const expression = this.parseExpression();

    return {
      kind: "SetStatement",
      name: name.value ?? name.lexeme,
      expression,
      span: {
        start: start.span.start,
        end: expression.span.end,
      },
    };
  }

  private parseWhile(start: Token): WhileStatement {
    const condition = this.parseExpression();
    const explicitBlock = this.match("lbrace");
    const body: FunctionStatement[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.match("let")) {
        body.push(this.parseLet(this.previous()));
        continue;
      }

      if (this.match("var")) {
        body.push(this.parseVar(this.previous()));
        continue;
      }

      if (this.match("set")) {
        body.push(this.parseSet(this.previous()));
        continue;
      }

      if (this.match("while")) {
        body.push(this.parseWhile(this.previous()));
        continue;
      }

      if (this.match("for")) {
        body.push(this.parseForEach(this.previous()));
        continue;
      }

      if (this.match("break")) {
        body.push(this.parseBreak(this.previous()));
        continue;
      }

      if (this.match("continue")) {
        body.push(this.parseContinue(this.previous()));
        continue;
      }

      if (this.match("return")) {
        body.push(this.parseReturn(this.previous()));
        continue;
      }

      this.fail(
        this.peek(),
        "E1012",
        "Expected a statement inside while.",
        "Use let, var, set, while, for, break, continue, or return.",
      );
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the while statement.')
      : this.consume("end", 'Expected "end" to close the while statement.');

    return {
      kind: "WhileStatement",
      condition,
      body,
      span: {
        start: start.span.start,
        end: end.span.end,
      },
    };
  }

  private parseForEach(start: Token): ForEachStatement {
    const binding = this.consume(
      "identifier",
      "Expected an iteration binding after for.",
    );
    this.consume("in", 'Expected "in" after the iteration binding.');
    const collection = this.parseExpression();
    const explicitBlock = this.match("lbrace");
    const body: FunctionStatement[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.match("let")) {
        body.push(this.parseLet(this.previous()));
        continue;
      }

      if (this.match("var")) {
        body.push(this.parseVar(this.previous()));
        continue;
      }

      if (this.match("set")) {
        body.push(this.parseSet(this.previous()));
        continue;
      }

      if (this.match("while")) {
        body.push(this.parseWhile(this.previous()));
        continue;
      }

      if (this.match("for")) {
        body.push(this.parseForEach(this.previous()));
        continue;
      }

      if (this.match("break")) {
        body.push(this.parseBreak(this.previous()));
        continue;
      }

      if (this.match("continue")) {
        body.push(this.parseContinue(this.previous()));
        continue;
      }

      if (this.match("return")) {
        body.push(this.parseReturn(this.previous()));
        continue;
      }

      this.fail(
        this.peek(),
        "E1013",
        "Expected a statement inside for.",
        "Use let, var, set, while, for, break, continue, or return.",
      );
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the for statement.')
      : this.consume("end", 'Expected "end" to close the for statement.');

    return {
      kind: "ForEachStatement",
      bindingName: binding.value ?? binding.lexeme,
      collection,
      body,
      span: {
        start: start.span.start,
        end: end.span.end,
      },
    };
  }

  private parseBreak(start: Token): BreakStatement {
    return {
      kind: "BreakStatement",
      span: start.span,
    };
  }

  private parseContinue(start: Token): ContinueStatement {
    return {
      kind: "ContinueStatement",
      span: start.span,
    };
  }

  private parseReturn(start: Token): ReturnStatement {
    const expression = this.parseExpression();
    return {
      kind: "ReturnStatement",
      expression,
      span: {
        start: start.span.start,
        end: expression.span.end,
      },
    };
  }

  private parseExpression(): Expression {
    if (this.match("match")) {
      const start = this.previous();
      const value = this.parseLogicalOr();
      const cases: MatchCase[] = [];

      while (this.match("case")) {
        const caseStart = this.previous();
        let caseName: Token;

        if (
          this.match("identifier") ||
          this.match("ok") ||
          this.match("error")
        ) {
          caseName = this.previous();
        } else {
          caseName = this.consume(
            "identifier",
            "Expected a choice/result case name after case.",
          );
        }

        let bindingName: string | undefined;

        if (this.check("identifier")) {
          const binding = this.advance();
          bindingName = binding.value ?? binding.lexeme;
        }

        this.consume(
          "then",
          'Expected "then" after the match case name or payload binding.',
        );
        const expression = this.parseExpression();

        cases.push({
          caseName: caseName.value ?? caseName.lexeme,
          ...(bindingName ? { bindingName } : {}),
          expression,
          span: {
            start: caseStart.span.start,
            end: expression.span.end,
          },
        });
      }

      const end = this.consume(
        "end",
        'Expected "end" to close the match expression.',
      );

      const expression: MatchExpression = {
        kind: "MatchExpression",
        value,
        cases,
        span: spanFrom(start, end),
      };
      return expression;
    }

    if (this.match("if")) {
      const start = this.previous();
      const condition = this.parseLogicalOr();
      this.consume("then", 'Expected "then" after the condition.');
      const thenExpression = this.parseExpression();
      this.consume("else", 'Expected "else" after the then expression.');
      const elseExpression = this.parseExpression();

      return {
        kind: "IfExpression",
        condition,
        thenExpression,
        elseExpression,
        span: {
          start: start.span.start,
          end: elseExpression.span.end,
        },
      };
    }

    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expression {
    let expression = this.parseLogicalAnd();

    while (this.check("or")) {
      const operator = this.advance();
      const right = this.parseLogicalAnd();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
  }

  private parseLogicalAnd(): Expression {
    let expression = this.parseComparison();

    while (this.check("and")) {
      const operator = this.advance();
      const right = this.parseComparison();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
  }

  private parseComparison(): Expression {
    let expression = this.parseAdditive();

    while (
      this.check("eqeq") ||
      this.check("neq") ||
      this.check("gt") ||
      this.check("gte") ||
      this.check("lt") ||
      this.check("lte")
    ) {
      const operator = this.advance();
      const right = this.parseAdditive();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
  }

  private parseAdditive(): Expression {
    let expression = this.parseMultiplicative();

    while (this.check("plus") || this.check("minus")) {
      const operator = this.advance();
      const right = this.parseMultiplicative();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
  }

  private parseMultiplicative(): Expression {
    let expression = this.parseUnary();

    while (this.check("star") || this.check("slash")) {
      const operator = this.advance();
      const right = this.parseUnary();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
  }

  private parseUnary(): Expression {
    if (this.match("not")) {
      const operator = this.previous();
      const expression = this.parseUnary();
      const unary: UnaryExpression = {
        kind: "UnaryExpression",
        operator: "not",
        expression,
        span: {
          start: operator.span.start,
          end: expression.span.end,
        },
      };
      return unary;
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    if (this.match("number")) {
      const token = this.previous();
      const expression: NumberExpression = {
        kind: "NumberExpression",
        value: Number(token.value ?? token.lexeme),
        span: token.span,
      };
      return expression;
    }

    if (this.match("string")) {
      const token = this.previous();
      const expression: StringExpression = {
        kind: "StringExpression",
        value: token.value ?? "",
        span: token.span,
      };
      return expression;
    }

    if (this.match("true") || this.match("false")) {
      const token = this.previous();
      return {
        kind: "BooleanExpression",
        value: token.kind === "true",
        span: token.span,
      };
    }

    if (this.match("none")) {
      const token = this.previous();
      return {
        kind: "NoneExpression",
        span: token.span,
      };
    }

    if (this.match("lbracket")) {
      const start = this.previous();
      const elements: Expression[] = [];

      if (!this.check("rbracket")) {
        do {
          elements.push(this.parseExpression());
        } while (this.match("comma"));
      }

      const close = this.consume(
        "rbracket",
        'Expected "]" after list elements.',
      );

      const expression: ListExpression = {
        kind: "ListExpression",
        elements,
        span: spanFrom(start, close),
      };
      return expression;
    }

    if (this.match("set")) {
      const start = this.previous();
      this.consume("lbracket", 'Expected "[" after set.');
      const elements: Expression[] = [];

      if (!this.check("rbracket")) {
        do {
          elements.push(this.parseExpression());
        } while (this.match("comma"));
      }

      const close = this.consume(
        "rbracket",
        'Expected "]" after set elements.',
      );

      const expression: SetExpression = {
        kind: "SetExpression",
        elements,
        span: spanFrom(start, close),
      };
      return expression;
    }

    if (this.match("map")) {
      const start = this.previous();
      this.consume("lbracket", 'Expected "[" after map.');
      const entries: MapEntry[] = [];

      if (!this.check("rbracket")) {
        do {
          const key = this.parseExpression();
          this.consume("colon", 'Expected ":" between map key and value.');
          const value = this.parseExpression();
          entries.push({
            key,
            value,
            span: {
              start: key.span.start,
              end: value.span.end,
            },
          });
        } while (this.match("comma"));
      }

      const close = this.consume(
        "rbracket",
        'Expected "]" after map entries.',
      );

      const expression: MapExpression = {
        kind: "MapExpression",
        entries,
        span: spanFrom(start, close),
      };
      return expression;
    }

    if (this.match("ok") || this.match("error")) {
      const constructor = this.previous();
      this.consume(
        "lparen",
        'Expected "(" after ' + constructor.lexeme + ".",
      );
      const args: Expression[] = [];

      if (!this.check("rparen")) {
        do {
          args.push(this.parseExpression());
        } while (this.match("comma"));
      }

      const close = this.consume(
        "rparen",
        'Expected ")" after result payload.',
      );

      return {
        kind: "CallExpression",
        callee: constructor.lexeme,
        arguments: args,
        span: spanFrom(constructor, close),
      };
    }

    if (this.match("identifier")) {
      const identifier = this.previous();
      const name = identifier.value ?? identifier.lexeme;

      if (this.match("lparen")) {
        const args: Expression[] = [];

        if (!this.check("rparen")) {
          do {
            args.push(this.parseExpression());
          } while (this.match("comma"));
        }

        const close = this.consume(
          "rparen",
          'Expected ")" after function arguments.',
        );

        const expression: CallExpression = {
          kind: "CallExpression",
          callee: name,
          arguments: args,
          span: spanFrom(identifier, close),
        };
        return expression;
      }

      let expression: Expression = {
        kind: "IdentifierExpression",
        name,
        span: identifier.span,
      };

      while (this.match("dot")) {
        const member = this.consume(
          "identifier",
          "Expected a member name after '.'.",
        );

        if (this.match("lparen")) {
          const args: Expression[] = [];

          if (!this.check("rparen")) {
            do {
              args.push(this.parseExpression());
            } while (this.match("comma"));
          }

          const close = this.consume(
            "rparen",
            'Expected ")" after method arguments.',
          );

          const methodCall: MethodCallExpression = {
            kind: "MethodCallExpression",
            object: expression,
            method: member.value ?? member.lexeme,
            arguments: args,
            span: {
              start: expression.span.start,
              end: close.span.end,
            },
          };

          expression = methodCall;
          continue;
        }

        const memberExpression: MemberExpression = {
          kind: "MemberExpression",
          object: expression,
          member: member.value ?? member.lexeme,
          span: {
            start: expression.span.start,
            end: member.span.end,
          },
        };

        expression = memberExpression;
      }

      return expression;
    }

    if (this.match("lparen")) {
      const expression = this.parseExpression();
      this.consume("rparen", 'Expected ")" after the expression.');
      return expression;
    }

    return this.fail(
      this.peek(),
      "E1012",
      "Expected an expression.",
      "Use a literal, variable, function call, or arithmetic expression.",
    );
  }

  private parseTypeAnnotation(): TypeAnnotation {
    if (this.match("optional")) {
      const start = this.previous();
      const valueType = this.parseTypeAnnotation();

      return {
        kind: "OptionalTypeAnnotation",
        valueType,
        span: {
          start: start.span.start,
          end: valueType.span.end,
        },
      };
    }

    if (this.match("list")) {
      const start = this.previous();
      this.consume("of", 'Expected "of" after list.');
      const elementType = this.parseTypeAnnotation();

      return {
        kind: "ListTypeAnnotation",
        elementType,
        span: {
          start: start.span.start,
          end: elementType.span.end,
        },
      };
    }

    if (this.match("set")) {
      const start = this.previous();
      this.consume("of", 'Expected "of" after set.');
      const elementType = this.parseTypeAnnotation();

      return {
        kind: "SetTypeAnnotation",
        elementType,
        span: {
          start: start.span.start,
          end: elementType.span.end,
        },
      };
    }

    if (this.match("map")) {
      const start = this.previous();
      this.consume("of", 'Expected "of" after map.');
      const keyType = this.parseTypeAnnotation();
      this.consume("to", 'Expected "to" between map key and value types.');
      const valueType = this.parseTypeAnnotation();

      return {
        kind: "MapTypeAnnotation",
        keyType,
        valueType,
        span: {
          start: start.span.start,
          end: valueType.span.end,
        },
      };
    }

    if (this.match("result")) {
      const start = this.previous();
      this.consume("of", 'Expected "of" after result.');
      const okType = this.parseTypeAnnotation();
      this.consume(
        "error",
        'Expected "error" between result success and error types.',
      );
      const errorType = this.parseTypeAnnotation();

      return {
        kind: "ResultTypeAnnotation",
        okType,
        errorType,
        span: {
          start: start.span.start,
          end: errorType.span.end,
        },
      };
    }

    if (this.match("identifier") || this.match("text")) {
      const token = this.previous();

      return {
        kind: "NamedTypeAnnotation",
        name: token.lexeme,
        span: token.span,
      };
    }

    return this.fail(
      this.peek(),
      "E1008",
      "Expected a type.",
      "Use a primitive/nominal type, collection, result of <ok> error <error>, or optional <type>.",
    );
  }

  private parseServer(): ServerDeclaration {
    const start = this.consume("server", "Expected a server declaration.");
    const name = this.consume("identifier", "Expected a server name.");
    const explicitBlock = this.match("lbrace");
    let port = 3000;
    const endpoints: EndpointDeclaration[] = [];
    const databases: DatabaseDeclaration[] = [];
    const repositories: RepositoryDeclaration[] = [];
    const jobs: JobDeclaration[] = [];
    const realtime: RealtimeDeclaration[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      if (this.matchWord("port")) {
        const value = this.consume("number", "Expected a numeric server port.");
        port = Number(value.value ?? value.lexeme);
        continue;
      }

      if (this.checkWord("endpoint")) {
        endpoints.push(this.parseEndpoint());
        continue;
      }

      if (this.checkWord("database")) {
        databases.push(this.parseDatabase());
        continue;
      }

      if (this.checkWord("repository")) {
        repositories.push(this.parseRepository());
        continue;
      }

      if (this.checkWord("job")) {
        jobs.push(this.parseJob());
        continue;
      }

      if (this.checkWord("realtime")) {
        realtime.push(this.parseRealtime());
        continue;
      }

      return this.fail(
        this.peek(),
        "E1100",
        "Expected a server declaration item.",
        "Use port, endpoint, database, repository, job, or realtime.",
      );
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the server.')
      : this.consume("end", 'Expected "end" to close the server.');

    return {
      kind: "ServerDeclaration",
      name: name.value ?? name.lexeme,
      port,
      endpoints,
      databases,
      repositories,
      jobs,
      realtime,
      span: spanFrom(start, end),
    };
  }

  private parseEndpoint(): EndpointDeclaration {
    const start = this.consumeWord("endpoint", "Expected an endpoint declaration.");
    const method = this.consume("identifier", "Expected an HTTP method.");
    const rawMethod = (method.value ?? method.lexeme).toUpperCase();
    const allowed = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

    if (!allowed.has(rawMethod)) {
      return this.fail(
        method,
        "E1101",
        'Unsupported HTTP method "' + rawMethod + '".',
        "Use GET, POST, PUT, PATCH, or DELETE.",
      );
    }

    const pathToken = this.consume("string", "Expected an endpoint path.");
    let requestType: TypeAnnotation | undefined;
    let responseType: TypeAnnotation | undefined;
    let handler: string | undefined;
    let auth: "public" | "bearer" = "public";

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("takes")) {
        requestType = this.parseTypeAnnotation();
        continue;
      }

      if (this.match("returns")) {
        responseType = this.parseTypeAnnotation();
        continue;
      }

      if (this.matchWord("uses")) {
        const fn = this.consume("identifier", "Expected a handler function name.");
        handler = fn.value ?? fn.lexeme;
        continue;
      }

      if (this.matchWord("auth")) {
        if (this.match("public")) {
          auth = "public";
          continue;
        }

        const mode = this.consume("identifier", "Expected public or bearer authentication.");
        if ((mode.value ?? mode.lexeme) !== "bearer") {
          return this.fail(
            mode,
            "E1102",
            "Expected public or bearer authentication.",
          );
        }
        auth = "bearer";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1103",
        "Expected an endpoint option.",
        "Use takes, returns, uses, or auth.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the endpoint.');

    if (!responseType || !handler) {
      return this.fail(
        end,
        "E1104",
        "Endpoints require both returns <Type> and uses <function>.",
      );
    }

    return {
      method: rawMethod as HttpMethod,
      path: pathToken.value ?? "",
      ...(requestType ? { requestType } : {}),
      responseType,
      handler,
      auth,
      span: spanFrom(start, end),
    };
  }

  private parseDatabase(): DatabaseDeclaration {
    const start = this.consumeWord("database", "Expected a database declaration.");
    const name = this.consume("identifier", "Expected a database name.");
    this.consumeWord("postgres", 'Expected "postgres" as the M3 database engine.');
    let connectionEnv: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("connection")) {
        const value = this.consume("string", "Expected the connection environment variable name.");
        connectionEnv = value.value ?? "";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1105",
        "Expected a database option.",
        'Use connection "DATABASE_URL".',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the database.');

    if (!connectionEnv) {
      return this.fail(
        end,
        "E1106",
        "Postgres databases require a connection environment variable.",
      );
    }

    return {
      name: name.value ?? name.lexeme,
      engine: "postgres",
      connectionEnv,
      span: spanFrom(start, end),
    };
  }

  private parseRepository(): RepositoryDeclaration {
    const start = this.consumeWord("repository", "Expected a repository declaration.");
    const name = this.consume("identifier", "Expected a repository name.");
    let modelName: string | undefined;
    let databaseName: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("model")) {
        const value = this.consume("identifier", "Expected a data/class model name.");
        modelName = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("using")) {
        const value = this.consume("identifier", "Expected a database name.");
        databaseName = value.value ?? value.lexeme;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1107",
        "Expected a repository option.",
        "Use model <Type> and using <Database>.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the repository.');

    if (!modelName || !databaseName) {
      return this.fail(
        end,
        "E1108",
        "Repositories require model <Type> and using <Database>.",
      );
    }

    return {
      name: name.value ?? name.lexeme,
      modelName,
      databaseName,
      span: spanFrom(start, end),
    };
  }

  private parseJob(): JobDeclaration {
    const start = this.consumeWord("job", "Expected a job declaration.");
    const name = this.consume("identifier", "Expected a job name.");
    let schedule: string | undefined;
    let handler: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("every")) {
        const value = this.consume("string", "Expected a cron schedule string.");
        schedule = value.value ?? "";
        continue;
      }

      if (this.matchWord("uses")) {
        const value = this.consume("identifier", "Expected a job handler function.");
        handler = value.value ?? value.lexeme;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1109",
        "Expected a job option.",
        'Use every "<cron>" and uses <function>.',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the job.');

    if (!schedule || !handler) {
      return this.fail(
        end,
        "E1110",
        "Jobs require a schedule and handler.",
      );
    }

    return {
      name: name.value ?? name.lexeme,
      schedule,
      handler,
      span: spanFrom(start, end),
    };
  }

  private parseRealtime(): RealtimeDeclaration {
    const start = this.consumeWord("realtime", "Expected a realtime declaration.");
    const name = this.consume("identifier", "Expected a realtime channel name.");
    let messageType: TypeAnnotation | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("message")) {
        messageType = this.parseTypeAnnotation();
        continue;
      }

      return this.fail(
        this.peek(),
        "E1111",
        "Expected a realtime option.",
        "Use message <Type>.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the realtime declaration.');

    if (!messageType) {
      return this.fail(
        end,
        "E1112",
        "Realtime channels require a message type.",
      );
    }

    return {
      name: name.value ?? name.lexeme,
      messageType,
      span: spanFrom(start, end),
    };
  }

  private parseTool(): ToolDeclaration {
    const start = this.consume("tool", "Expected a tool declaration.");
    const name = this.consume("identifier", "Expected a tool name.");
    let inputType: TypeAnnotation | undefined;
    let outputType: TypeAnnotation | undefined;
    let permission: string | undefined;
    let handler: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("takes")) {
        inputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.match("returns")) {
        outputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.matchWord("permission")) {
        const value = this.consume("string", "Expected a capability permission string.");
        permission = value.value ?? "";
        continue;
      }

      if (this.matchWord("uses")) {
        const value = this.consume("identifier", "Expected a tool handler function.");
        handler = value.value ?? value.lexeme;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1200",
        "Expected a tool option.",
        'Use takes, returns, permission "capability", or uses <function>.',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the tool.');

    if (!outputType || !permission || !handler) {
      return this.fail(
        end,
        "E1201",
        "Tools require returns <Type>, permission <string>, and uses <function>.",
      );
    }

    return {
      kind: "ToolDeclaration",
      name: name.value ?? name.lexeme,
      ...(inputType ? { inputType } : {}),
      outputType,
      permission,
      handler,
      span: spanFrom(start, end),
    };
  }

  private parseContext(): ContextDeclaration {
    const start = this.consume("context", "Expected a context declaration.");
    const name = this.consume("identifier", "Expected a context name.");
    const includes: string[] = [];
    let tokenBudget = 12000;
    let overflow: "summarize" | "reject" = "summarize";

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("include")) {
        const value = this.consume("string", "Expected a context source label.");
        includes.push(value.value ?? "");
        continue;
      }

      if (this.matchWord("budget")) {
        const value = this.consume("number", "Expected a context token budget.");
        tokenBudget = Number(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("overflow")) {
        const value = this.consume("identifier", "Expected summarize or reject.");
        const mode = value.value ?? value.lexeme;
        if (mode !== "summarize" && mode !== "reject") {
          return this.fail(
            value,
            "E1202",
            'Unknown context overflow policy "' + mode + '".',
            "Use summarize or reject.",
          );
        }
        overflow = mode;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1203",
        "Expected a context option.",
        'Use include "...", budget <tokens>, or overflow summarize|reject.',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the context.');

    return {
      kind: "ContextDeclaration",
      name: name.value ?? name.lexeme,
      includes,
      tokenBudget,
      overflow,
      span: spanFrom(start, end),
    };
  }

  private parseAgent(): AgentDeclaration {
    const start = this.consume("agent", "Expected an agent declaration.");
    const name = this.consume("identifier", "Expected an agent name.");
    let inputType: TypeAnnotation | undefined;
    let outputType: TypeAnnotation | undefined;
    let modelRequirement: string | undefined;
    let contextName: string | undefined;
    const tools: string[] = [];
    const approvalTools: string[] = [];
    let tokenBudget = 4000;
    let costBudget: number | undefined;
    let tracing = false;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("accepts")) {
        inputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.match("returns")) {
        outputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.matchWord("model")) {
        const value = this.consume("string", "Expected a provider-neutral model requirement.");
        modelRequirement = value.value ?? "";
        continue;
      }

      if (this.match("context")) {
        const value = this.consume("identifier", "Expected a context name.");
        contextName = value.value ?? value.lexeme;
        continue;
      }

      if (this.match("tool")) {
        const value = this.consume("identifier", "Expected a tool name.");
        tools.push(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("approval")) {
        const value = this.consume("identifier", "Expected a tool name requiring approval.");
        approvalTools.push(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("budget")) {
        if (this.matchWord("tokens")) {
          const value = this.consume("number", "Expected a token budget.");
          tokenBudget = Number(value.value ?? value.lexeme);
          continue;
        }

        if (this.matchWord("cost")) {
          const value = this.consume("number", "Expected a numeric cost budget.");
          costBudget = Number(value.value ?? value.lexeme);
          continue;
        }

        return this.fail(
          this.peek(),
          "E1204",
          "Expected tokens or cost after budget.",
        );
      }

      if (this.matchWord("trace")) {
        tracing = true;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1205",
        "Expected an agent option.",
        "Use accepts, returns, model, context, tool, approval, budget, or trace.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the agent.');

    if (!inputType || !outputType || !modelRequirement) {
      return this.fail(
        end,
        "E1206",
        "Agents require accepts <Type>, returns <Type>, and model <requirement>.",
      );
    }

    return {
      kind: "AgentDeclaration",
      name: name.value ?? name.lexeme,
      inputType,
      outputType,
      modelRequirement,
      ...(contextName ? { contextName } : {}),
      tools,
      approvalTools,
      tokenBudget,
      ...(costBudget !== undefined ? { costBudget } : {}),
      tracing,
      span: spanFrom(start, end),
    };
  }

  private parseEvaluation(): EvaluationDeclaration {
    const start = this.consume("evaluation", "Expected an evaluation declaration.");
    const name = this.consume("identifier", "Expected an evaluation name.");
    let agentName: string | undefined;
    let inputFunction: string | undefined;
    let expectedFunction: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("agent")) {
        const value = this.consume("identifier", "Expected an agent name.");
        agentName = value.value ?? value.lexeme;
        continue;
      }

      if (
        this.check("identifier") &&
        this.peek().lexeme === "input"
      ) {
        this.advance();
        const value = this.consume("identifier", "Expected an input fixture function.");
        inputFunction = value.value ?? value.lexeme;
        continue;
      }

      if (
        this.check("identifier") &&
        this.peek().lexeme === "expected"
      ) {
        this.advance();
        const value = this.consume("identifier", "Expected an expected-output fixture function.");
        expectedFunction = value.value ?? value.lexeme;
        continue;
      }

      return this.fail(
        this.peek(),
        "E1207",
        "Expected an evaluation option.",
        "Use agent, input, or expected.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the evaluation.');

    if (!agentName || !inputFunction || !expectedFunction) {
      return this.fail(
        end,
        "E1208",
        "Evaluations require agent, input, and expected fixture functions.",
      );
    }

    return {
      kind: "EvaluationDeclaration",
      name: name.value ?? name.lexeme,
      agentName,
      inputFunction,
      expectedFunction,
      span: spanFrom(start, end),
    };
  }

  private parseMobile(): MobileDeclaration {
    const start = this.consume("mobile", "Expected a mobile declaration.");
    const name = this.consume("identifier", "Expected a mobile target name.");
    let storage: "memory" | "secure" = "memory";
    let network: "online" | "offline-first" = "online";
    const permissions: string[] = [];
    const nativeExtensions: ("swift" | "kotlin")[] = [];

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("storage")) {
        const value = this.consume("string", "Expected memory or secure storage mode.");
        const mode = value.value ?? "";
        if (mode !== "memory" && mode !== "secure") {
          return this.fail(
            value,
            "E1300",
            'Unknown mobile storage mode "' + mode + '".',
            "Use memory or secure.",
          );
        }
        storage = mode;
        continue;
      }

      if (this.matchWord("permission")) {
        const value = this.consume("string", "Expected a mobile permission name.");
        permissions.push(value.value ?? "");
        continue;
      }

      if (this.matchWord("network")) {
        const value = this.consume("string", "Expected online or offline-first network mode.");
        const mode = value.value ?? "";
        if (mode !== "online" && mode !== "offline-first") {
          return this.fail(
            value,
            "E1301",
            'Unknown mobile network mode "' + mode + '".',
            "Use online or offline-first.",
          );
        }
        network = mode;
        continue;
      }

      if (this.matchWord("native")) {
        const value = this.consume("string", "Expected swift or kotlin native boundary.");
        const platform = value.value ?? "";
        if (platform !== "swift" && platform !== "kotlin") {
          return this.fail(
            value,
            "E1302",
            'Unknown native mobile boundary "' + platform + '".',
            "Use swift or kotlin.",
          );
        }
        nativeExtensions.push(platform);
        continue;
      }

      return this.fail(
        this.peek(),
        "E1303",
        "Expected a mobile option.",
        'Use storage, permission, network, or native.',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the mobile declaration.');

    return {
      kind: "MobileDeclaration",
      name: name.value ?? name.lexeme,
      storage,
      permissions,
      network,
      nativeExtensions,
      span: spanFrom(start, end),
    };
  }

  private parseDataset(): DatasetDeclaration {
    const start = this.consume("dataset", "Expected a dataset declaration.");
    const name = this.consume("identifier", "Expected a dataset name.");
    let rowType: string | undefined;
    let source: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("row")) {
        const value = this.consume("identifier", "Expected a dataset row type.");
        rowType = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("source")) {
        const value = this.consume("string", "Expected a dataset source path.");
        source = value.value ?? "";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1400",
        "Expected a dataset option.",
        'Use row <Type> or source "path".',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the dataset.');

    if (!rowType || !source) {
      return this.fail(
        end,
        "E1401",
        "Datasets require row <Type> and source <path>.",
      );
    }

    return {
      kind: "DatasetDeclaration",
      name: name.value ?? name.lexeme,
      rowType,
      source,
      span: spanFrom(start, end),
    };
  }

  private parseArray(): ArrayDeclaration {
    const start = this.consume("array", "Expected an array declaration.");
    const name = this.consume("identifier", "Expected an array name.");
    let dtype: "float32" | "float64" | "int64" | undefined;
    let shape: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.matchWord("dtype")) {
        const value = this.consume("string", "Expected a NumPy dtype.");
        const raw = value.value ?? "";
        if (
          raw !== "float32" &&
          raw !== "float64" &&
          raw !== "int64"
        ) {
          return this.fail(
            value,
            "E1402",
            'Unsupported numerical dtype "' + raw + '".',
            "Use float32, float64, or int64.",
          );
        }
        dtype = raw;
        continue;
      }

      if (this.matchWord("shape")) {
        const value = this.consume("string", "Expected an array shape.");
        shape = value.value ?? "";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1403",
        "Expected an array option.",
        'Use dtype "float64" or shape "*,3".',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the array.');

    if (!dtype || !shape) {
      return this.fail(
        end,
        "E1404",
        "Arrays require dtype and shape.",
      );
    }

    return {
      kind: "ArrayDeclaration",
      name: name.value ?? name.lexeme,
      dtype,
      shape,
      span: spanFrom(start, end),
    };
  }

  private parsePython(): PythonDeclaration {
    const start = this.consume("python", "Expected a Python bridge declaration.");
    const name = this.consume("identifier", "Expected a Python bridge name.");
    let inputType: TypeAnnotation | undefined;
    let outputType: TypeAnnotation | undefined;
    let moduleName: string | undefined;
    let callableName: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("takes")) {
        inputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.match("returns")) {
        outputType = this.parseTypeAnnotation();
        continue;
      }

      if (this.match("module")) {
        const value = this.consume("string", "Expected a Python module name.");
        moduleName = value.value ?? "";
        continue;
      }

      if (this.matchWord("callable")) {
        const value = this.consume("string", "Expected a Python callable name.");
        callableName = value.value ?? "";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1405",
        "Expected a Python bridge option.",
        'Use takes, returns, module "...", or callable "...".',
      );
    }

    const end = this.consume("end", 'Expected "end" to close the Python bridge.');

    if (!outputType || !moduleName || !callableName) {
      return this.fail(
        end,
        "E1406",
        "Python bridges require returns, module, and callable.",
      );
    }

    return {
      kind: "PythonDeclaration",
      name: name.value ?? name.lexeme,
      ...(inputType ? { inputType } : {}),
      outputType,
      moduleName,
      callableName,
      span: spanFrom(start, end),
    };
  }

  private parsePipeline(): PipelineDeclaration {
    const start = this.consume("pipeline", "Expected a pipeline declaration.");
    const name = this.consume("identifier", "Expected a pipeline name.");
    let datasetName: string | undefined;
    let trainBridge: string | undefined;
    let evaluateBridge: string | undefined;
    let seed = 0;
    let tracking: string | undefined;

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("dataset")) {
        const value = this.consume("identifier", "Expected a dataset name.");
        datasetName = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("train")) {
        const value = this.consume("identifier", "Expected a Python training bridge.");
        trainBridge = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("evaluate")) {
        const value = this.consume("identifier", "Expected a Python evaluation bridge.");
        evaluateBridge = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("seed")) {
        const value = this.consume("number", "Expected an integer seed.");
        seed = Number(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("tracking")) {
        const value = this.consume("string", "Expected a tracking file path.");
        tracking = value.value ?? "";
        continue;
      }

      return this.fail(
        this.peek(),
        "E1407",
        "Expected a pipeline option.",
        "Use dataset, train, evaluate, seed, or tracking.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the pipeline.');

    if (!datasetName || !trainBridge || !evaluateBridge || !tracking) {
      return this.fail(
        end,
        "E1408",
        "Pipelines require dataset, train, evaluate, and tracking.",
      );
    }

    return {
      kind: "PipelineDeclaration",
      name: name.value ?? name.lexeme,
      datasetName,
      trainBridge,
      evaluateBridge,
      seed,
      tracking,
      span: spanFrom(start, end),
    };
  }

  private parseDeployment(): DeploymentDeclaration {
    const start = this.consume("deploy", "Expected a deployment declaration.");
    const name = this.consume("identifier", "Expected a deployment name.");
    let serverName: string | undefined;
    let image: string | undefined;
    let replicas = 1;
    let port: number | undefined;
    let healthPath = "/health";
    let readinessPath = "/ready";
    const environments: {
      name: string;
      source: string;
      span: SourceSpan;
    }[] = [];
    const secrets: {
      name: string;
      source: string;
      span: SourceSpan;
    }[] = [];
    let observability: "basic" | "open-telemetry" = "basic";
    let rollbackRevisions = 3;

    while (!this.check("eof") && !this.check("end")) {
      if (this.match("server")) {
        const value = this.consume("identifier", "Expected a server declaration name.");
        serverName = value.value ?? value.lexeme;
        continue;
      }

      if (this.matchWord("image")) {
        const value = this.consume("string", "Expected a container image reference.");
        image = value.value ?? "";
        continue;
      }

      if (this.matchWord("replicas")) {
        const value = this.consume("number", "Expected a replica count.");
        replicas = Number(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("port")) {
        const value = this.consume("number", "Expected a container port.");
        port = Number(value.value ?? value.lexeme);
        continue;
      }

      if (this.matchWord("health")) {
        const value = this.consume("string", "Expected a health path.");
        healthPath = value.value ?? "";
        continue;
      }

      if (this.matchWord("readiness")) {
        const value = this.consume("string", "Expected a readiness path.");
        readinessPath = value.value ?? "";
        continue;
      }

      if (this.matchWord("env")) {
        const envName = this.consume("identifier", "Expected an environment variable name.");
        const source = this.consume("string", "Expected the external environment source name.");
        environments.push({
          name: envName.value ?? envName.lexeme,
          source: source.value ?? "",
          span: spanFrom(envName, source),
        });
        continue;
      }

      if (this.matchWord("secret")) {
        const secretName = this.consume("identifier", "Expected a secret variable name.");
        const source = this.consume("string", "Expected the external secret source name.");
        secrets.push({
          name: secretName.value ?? secretName.lexeme,
          source: source.value ?? "",
          span: spanFrom(secretName, source),
        });
        continue;
      }

      if (this.matchWord("observability")) {
        const value = this.consume("string", "Expected basic or open-telemetry.");
        const mode = value.value ?? "";
        if (mode !== "basic" && mode !== "open-telemetry") {
          return this.fail(
            value,
            "E1500",
            'Unknown observability mode "' + mode + '".',
            "Use basic or open-telemetry.",
          );
        }
        observability = mode;
        continue;
      }

      if (this.matchWord("rollback")) {
        const value = this.consume("number", "Expected rollback revision history count.");
        rollbackRevisions = Number(value.value ?? value.lexeme);
        continue;
      }

      return this.fail(
        this.peek(),
        "E1501",
        "Expected a deployment option.",
        "Use server, image, replicas, port, health, readiness, env, secret, observability, or rollback.",
      );
    }

    const end = this.consume("end", 'Expected "end" to close the deployment.');

    if (!serverName || !image || port === undefined) {
      return this.fail(
        end,
        "E1502",
        "Deployments require server <Name>, image <reference>, and port <number>.",
      );
    }

    return {
      kind: "DeploymentDeclaration",
      name: name.value ?? name.lexeme,
      serverName,
      image,
      replicas,
      port,
      healthPath,
      readinessPath,
      environments,
      secrets,
      observability,
      rollbackRevisions,
      span: spanFrom(start, end),
    };
  }

  private parseComponent(): ComponentDeclaration {
    const start = this.consume("component", "Expected a component declaration.");
    const name = this.consume("identifier", "Expected a component name.");
    const explicitBlock = this.match("lbrace");
    const body: VisualStatement[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      try {
        body.push(this.parseVisualStatement());
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeVisual();
      }
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the component.')
      : this.consume("end", 'Expected "end" to close the component.');

    return {
      kind: "ComponentDeclaration",
      name: name.value ?? name.lexeme,
      body,
      span: spanFrom(start, end),
    };
  }

  private parseScreen(): ScreenDeclaration {
    const start = this.consume("screen", "Expected a screen declaration.");
    const name = this.consume("identifier", "Expected a screen name.");
    const explicitBlock = this.match("lbrace");
    const body: ScreenStatement[] = [];

    while (
      !this.check("eof") &&
      !this.isTopLevelStart() &&
      !(explicitBlock && this.check("rbrace"))
    ) {
      try {
        body.push(this.parseScreenStatement());
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeScreen();
      }
    }

    let end: Token;

    if (explicitBlock) {
      end = this.consume("rbrace", 'Expected "}" to close the screen.');
    } else {
      end = this.previous();
    }

    return {
      kind: "ScreenDeclaration",
      name: name.value ?? name.lexeme,
      body,
      span: spanFrom(start, end),
    };
  }

  private parseScreenStatement(): ScreenStatement {
    if (this.match("state")) {
      return this.parseState(this.previous());
    }

    if (this.match("title")) {
      return this.parseTitle(this.previous());
    }

    return this.parseVisualStatement();
  }

  private parseVisualStatement(): VisualStatement {
    if (this.match("text")) {
      return this.parseText(this.previous());
    }

    if (this.match("show")) {
      return this.parseShow(this.previous());
    }

    if (this.match("button")) {
      return this.parseButton(this.previous());
    }

    if (this.match("stack")) {
      return this.parseStack(this.previous());
    }

    if (this.match("use")) {
      return this.parseUse(this.previous());
    }

    return this.fail(
      this.peek(),
      "E1004",
      "Expected a visual statement.",
      'Try text "...", show count, button "...", stack vertical, or use ComponentName.',
    );
  }

  private parseState(start: Token): StateDeclaration {
    const name = this.consume("identifier", "Expected a state name.");
    this.consume("starts", 'Expected "starts" after the state name.');
    const value = this.consume("number", "Expected an integer initial value.");

    return {
      kind: "StateDeclaration",
      name: name.value ?? name.lexeme,
      initialValue: Number(value.value ?? value.lexeme),
      span: spanFrom(start, value),
    };
  }

  private parseTitle(start: Token): TitleStatement {
    const text = this.consume("string", "Expected title text.");
    return {
      kind: "TitleStatement",
      text: text.value ?? "",
      span: spanFrom(start, text),
    };
  }

  private parseText(start: Token): TextStatement {
    const text = this.consume("string", "Expected text content.");
    return {
      kind: "TextStatement",
      text: text.value ?? "",
      span: spanFrom(start, text),
    };
  }

  private parseShow(start: Token): ShowStatement {
    const state = this.consume("identifier", "Expected the state name to show.");
    return {
      kind: "ShowStatement",
      stateName: state.value ?? state.lexeme,
      span: spanFrom(start, state),
    };
  }

  private parseUse(start: Token): UseStatement {
    const component = this.consume(
      "identifier",
      "Expected a component name after use.",
    );

    return {
      kind: "UseStatement",
      componentName: component.value ?? component.lexeme,
      span: spanFrom(start, component),
    };
  }

  private parseStack(start: Token): StackStatement {
    const directionToken = this.peek();
    let direction: StackDirection;

    if (this.match("vertical")) {
      direction = "vertical";
    } else if (this.match("horizontal")) {
      direction = "horizontal";
    } else {
      return this.fail(
        directionToken,
        "E1006",
        "Expected a stack direction.",
        "Use stack vertical or stack horizontal.",
      );
    }

    const explicitBlock = this.match("lbrace");
    const body: VisualStatement[] = [];

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      try {
        body.push(this.parseVisualStatement());
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeVisual();
      }
    }

    const end = explicitBlock
      ? this.consume("rbrace", 'Expected "}" to close the stack.')
      : this.consume("end", 'Expected "end" to close the natural stack.');

    return {
      kind: "StackStatement",
      direction,
      body,
      span: spanFrom(start, end),
    };
  }

  private parseButton(start: Token): ButtonStatement {
    const label = this.consume("string", "Expected button label.");

    if (this.match("lbrace")) {
      const action = this.parseButtonAction();
      const close = this.consume("rbrace", 'Expected "}" to close the button.');

      return {
        kind: "ButtonStatement",
        label: label.value ?? "",
        action,
        span: spanFrom(start, close),
      };
    }

    if (this.check("opens") || this.check("increases")) {
      const action = this.parseButtonAction();
      return {
        kind: "ButtonStatement",
        label: label.value ?? "",
        action,
        span: {
          start: start.span.start,
          end: action.span.end,
        },
      };
    }

    return {
      kind: "ButtonStatement",
      label: label.value ?? "",
      span: spanFrom(start, label),
    };
  }

  private parseButtonAction(): ButtonAction {
    if (this.match("opens")) {
      const opens = this.previous();
      const target = this.consume(
        "identifier",
        "Expected the destination screen name.",
      );
      return navigation(opens, target);
    }

    if (this.match("increases")) {
      const increases = this.previous();
      const state = this.consume(
        "identifier",
        "Expected the state name to increase.",
      );
      return increment(increases, state);
    }

    return this.fail(
      this.peek(),
      "E1005",
      "Expected a button action.",
      "Try opens ScreenName or increases stateName.",
    );
  }

  private synchronizeFunction(): void {
    if (this.isFunctionBoundary()) return;

    this.advance();

    while (!this.check("eof")) {
      if (this.isFunctionBoundary()) return;
      this.advance();
    }
  }

  private isFunctionBoundary(): boolean {
    return (
      this.check("generic") ||
      this.check("takes") ||
      this.check("returns") ||
      this.check("let") ||
      this.check("var") ||
      this.check("set") ||
      this.check("return") ||
      this.check("end") ||
      this.check("rbrace") ||
      this.isTopLevelStart() ||
      this.check("eof")
    );
  }

  private synchronizeScreen(): void {
    if (this.isScreenBoundary()) return;

    this.advance();

    while (!this.check("eof")) {
      if (this.isScreenBoundary()) return;
      this.advance();
    }
  }

  private synchronizeVisual(): void {
    if (this.isVisualBoundary()) return;

    this.advance();

    while (!this.check("eof")) {
      if (this.isVisualBoundary()) return;
      this.advance();
    }
  }

  private isScreenBoundary(): boolean {
    return (
      this.check("state") ||
      this.check("title") ||
      this.check("text") ||
      this.check("show") ||
      this.check("button") ||
      this.check("stack") ||
      this.check("use") ||
      this.check("rbrace") ||
      this.check("eof") ||
      this.isTopLevelStart()
    );
  }

  private isVisualBoundary(): boolean {
    return (
      this.check("text") ||
      this.check("show") ||
      this.check("button") ||
      this.check("stack") ||
      this.check("use") ||
      this.check("end") ||
      this.check("rbrace") ||
      this.check("eof")
    );
  }

  private synchronizeTopLevel(): void {
    if (this.isTopLevelStart() || this.check("eof")) return;

    this.advance();

    while (!this.check("eof") && !this.isTopLevelStart()) {
      this.advance();
    }
  }

  private isTopLevelStart(): boolean {
    return (
      this.check("data") ||
      this.check("class") ||
      this.check("protocol") ||
      this.check("choice") ||
      this.check("function") ||
      this.check("server") ||
      this.check("tool") ||
      this.check("context") ||
      this.check("agent") ||
      this.check("evaluation") ||
      this.check("mobile") ||
      this.check("dataset") ||
      this.check("array") ||
      this.check("python") ||
      this.check("pipeline") ||
      this.check("deploy") ||
      this.check("component") ||
      this.check("screen")
    );
  }

  private checkWord(word: string): boolean {
    return this.check("identifier") && this.peek().lexeme === word;
  }

  private matchWord(word: string): boolean {
    if (!this.checkWord(word)) return false;
    this.advance();
    return true;
  }

  private consumeWord(word: string, message: string): Token {
    if (this.checkWord(word)) return this.advance();
    return this.fail(
      this.peek(),
      "E1001",
      message,
      "Review the surrounding Evermore syntax.",
    );
  }

  private record(error: EvermoreDiagnosticError): void {
    this.diagnostics.push(...error.diagnostics);
  }

  private match(kind: TokenKind): boolean {
    if (!this.check(kind)) return false;
    this.advance();
    return true;
  }

  private consume(kind: TokenKind, message: string): Token {
    if (this.check(kind)) return this.advance();
    return this.fail(
      this.peek(),
      "E1001",
      message,
      "Review the surrounding Evermore syntax.",
    );
  }

  private fail(
    token: Token,
    code: string,
    message: string,
    help?: string,
  ): never {
    throw new EvermoreDiagnosticError([
      {
        code,
        severity: "error",
        message,
        span: token.span,
        ...(help ? { help } : {}),
      },
    ]);
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      throw new Error("Parser advanced beyond EOF token.");
    }
    this.index += 1;
    return token;
  }

  private peek(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      throw new Error("Parser token stream has no EOF token.");
    }
    return token;
  }

  private previous(): Token {
    const token = this.tokens[this.index - 1];
    if (!token) {
      throw new Error("Parser has no previous token.");
    }
    return token;
  }
}

function binaryExpression(
  left: Expression,
  operator: Token,
  right: Expression,
): BinaryExpression {
  const operatorMap: Partial<Record<TokenKind, BinaryOperator>> = {
    plus: "+",
    minus: "-",
    star: "*",
    slash: "/",
    eqeq: "==",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    and: "and",
    or: "or",
  };

  const mapped = operatorMap[operator.kind];

  if (!mapped) {
    throw new Error("Invalid binary operator token: " + operator.kind);
  }

  return {
    kind: "BinaryExpression",
    operator: mapped,
    left,
    right,
    span: {
      start: left.span.start,
      end: right.span.end,
    },
  };
}

function navigation(opens: Token, target: Token): NavigationAction {
  return {
    kind: "NavigationAction",
    target: target.value ?? target.lexeme,
    span: spanFrom(opens, target),
  };
}

function increment(increases: Token, state: Token): IncrementAction {
  return {
    kind: "IncrementAction",
    stateName: state.value ?? state.lexeme,
    amount: 1,
    span: spanFrom(increases, state),
  };
}

function spanFrom(start: Token, end: Token): SourceSpan {
  return {
    start: start.span.start,
    end: end.span.end,
  };
}
