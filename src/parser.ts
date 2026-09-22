import type {
  BinaryExpression,
  BinaryOperator,
  ButtonAction,
  ButtonStatement,
  CallExpression,
  ChoiceDeclaration,
  ChoiceCase,
  ComponentDeclaration,
  DataDeclaration,
  DataField,
  Expression,
  FunctionDeclaration,
  FunctionParameter,
  FunctionStatement,
  IdentifierExpression,
  IncrementAction,
  LetStatement,
  ListExpression,
  MatchCase,
  MatchExpression,
  MemberExpression,
  NavigationAction,
  NumberExpression,
  Program,
  ProtocolConformance,
  ProtocolDeclaration,
  ReturnStatement,
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
  TypeAnnotation,
  TypeParameter,
  UseStatement,
  VisualStatement,
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
    const appToken = this.consume(
      "app",
      'Every Evermore program starts with app "Name".',
    );
    const nameToken = this.consume("string", "Expected an application name.");

    const data: DataDeclaration[] = [];
    const protocols: ProtocolDeclaration[] = [];
    const choices: ChoiceDeclaration[] = [];
    const functions: FunctionDeclaration[] = [];
    const components: ComponentDeclaration[] = [];
    const screens: ScreenDeclaration[] = [];

    while (!this.check("eof")) {
      try {
        if (this.check("data")) {
          data.push(this.parseData());
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
          "Declare data, a protocol, a choice, a function, a component, or a screen.",
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
      appName: nameToken.value ?? "",
      data,
      protocols,
      choices,
      functions,
      components,
      screens,
      span: {
        start: appToken.span.start,
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

      const fieldName = this.consume(
        "identifier",
        "Expected a field name in the data declaration.",
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

    while (
      !this.check("eof") &&
      !(explicitBlock && this.check("rbrace")) &&
      !(!explicitBlock && this.check("end"))
    ) {
      const fieldName = this.consume(
        "identifier",
        "Expected a required field name in the protocol.",
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

          typeParameters.push({
            name: typeName.value ?? typeName.lexeme,
            span: typeName.span,
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

        if (this.match("return")) {
          body.push(this.parseReturn(this.previous()));
          continue;
        }

        this.fail(
          this.peek(),
          "E1010",
          "Expected a function declaration item or statement.",
          "Use generic, takes, returns, let, or return.",
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
      const value = this.parseComparison();
      const cases: MatchCase[] = [];

      while (this.match("case")) {
        const caseStart = this.previous();
        const caseName = this.consume(
          "identifier",
          "Expected a choice case name after case.",
        );
        this.consume(
          "then",
          'Expected "then" after the match case name.',
        );
        const expression = this.parseExpression();

        cases.push({
          caseName: caseName.value ?? caseName.lexeme,
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
      const condition = this.parseComparison();
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

    return this.parseComparison();
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
    let expression = this.parsePrimary();

    while (this.check("star") || this.check("slash")) {
      const operator = this.advance();
      const right = this.parsePrimary();
      expression = binaryExpression(expression, operator, right);
    }

    return expression;
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
      "Use text, number, boolean, id, a data type, list of <type>, or optional <type>.",
    );
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
      this.isVisualBoundary() ||
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
      this.check("choice") ||
      this.check("function") ||
      this.check("component") ||
      this.check("screen")
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
