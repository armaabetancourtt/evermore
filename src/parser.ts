import type {
  ButtonAction,
  ButtonStatement,
  IncrementAction,
  NavigationAction,
  Program,
  ScreenDeclaration,
  ScreenStatement,
  ShowStatement,
  SourceSpan,
  StateDeclaration,
  TextStatement,
  TitleStatement,
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

    const screens: ScreenDeclaration[] = [];

    while (!this.check("eof")) {
      try {
        screens.push(this.parseScreen());
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
      screens,
      span: {
        start: appToken.span.start,
        end: eof.span.end,
      },
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

    if (this.match("text")) {
      return this.parseText(this.previous());
    }

    if (this.match("show")) {
      return this.parseShow(this.previous());
    }

    if (this.match("button")) {
      return this.parseButton(this.previous());
    }

    return this.fail(
      this.peek(),
      "E1004",
      "Expected a screen statement.",
      'Try state count starts 0, title "...", text "...", show count, or button "...".',
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
      'Try opens ScreenName or increases stateName.',
    );
  }

  private synchronizeScreen(): void {
    if (this.isStatementBoundary()) return;

    this.advance();

    while (!this.check("eof")) {
      if (this.isStatementBoundary()) return;
      this.advance();
    }
  }

  private isStatementBoundary(): boolean {
    return (
      this.check("state") ||
      this.check("title") ||
      this.check("text") ||
      this.check("show") ||
      this.check("button") ||
      this.check("screen") ||
      this.check("rbrace") ||
      this.check("eof")
    );
  }

  private synchronizeTopLevel(): void {
    if (this.check("screen") || this.check("eof")) return;

    this.advance();

    while (!this.check("eof") && !this.check("screen")) {
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
