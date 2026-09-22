import type {
  ButtonAction,
  ButtonStatement,
  ComponentDeclaration,
  IncrementAction,
  NavigationAction,
  Program,
  ScreenDeclaration,
  ScreenStatement,
  ShowStatement,
  SourceSpan,
  StackDirection,
  StackStatement,
  StateDeclaration,
  TextStatement,
  TitleStatement,
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

    const components: ComponentDeclaration[] = [];
    const screens: ScreenDeclaration[] = [];

    while (!this.check("eof")) {
      try {
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
          "Declare a component or screen.",
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
      components,
      screens,
      span: {
        start: appToken.span.start,
        end: eof.span.end,
      },
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
      !this.check("screen") &&
      !this.check("component") &&
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
      this.check("screen") ||
      this.check("component")
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
    if (
      this.check("screen") ||
      this.check("component") ||
      this.check("eof")
    ) {
      return;
    }

    this.advance();

    while (
      !this.check("eof") &&
      !this.check("screen") &&
      !this.check("component")
    ) {
      this.advance();
    }
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
