import type {
  ButtonStatement,
  NavigationAction,
  Program,
  ScreenDeclaration,
  SourceSpan,
  TitleStatement,
  UIStatement,
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
    this.consume("lbrace", 'Expected "{" after the screen name.');

    const body: UIStatement[] = [];

    while (!this.check("rbrace") && !this.check("eof")) {
      try {
        body.push(this.parseUIStatement());
      } catch (error) {
        if (!(error instanceof EvermoreDiagnosticError)) throw error;
        this.record(error);
        this.synchronizeUI();
      }
    }

    const end = this.consume("rbrace", 'Expected "}" to close the screen.');

    return {
      kind: "ScreenDeclaration",
      name: name.value ?? name.lexeme,
      body,
      span: spanFrom(start, end),
    };
  }

  private parseUIStatement(): UIStatement {
    if (this.match("title")) {
      return this.parseTitle(this.previous());
    }

    if (this.match("button")) {
      return this.parseButton(this.previous());
    }

    return this.fail(
      this.peek(),
      "E1004",
      "Expected a UI statement.",
      'Try title "..." or button "...".',
    );
  }

  private parseTitle(start: Token): TitleStatement {
    const text = this.consume("string", "Expected title text.");
    return {
      kind: "TitleStatement",
      text: text.value ?? "",
      span: spanFrom(start, text),
    };
  }

  private parseButton(start: Token): ButtonStatement {
    const label = this.consume("string", "Expected button label.");
    let action: NavigationAction | undefined;

    if (this.match("lbrace")) {
      const opens = this.consume(
        "opens",
        'Expected "opens ScreenName" inside the button block.',
      );
      const target = this.consume(
        "identifier",
        "Expected the destination screen name.",
      );
      const close = this.consume("rbrace", 'Expected "}" to close the button.');

      action = {
        kind: "NavigationAction",
        target: target.value ?? target.lexeme,
        span: spanFrom(opens, target),
      };

      return {
        kind: "ButtonStatement",
        label: label.value ?? "",
        action,
        span: spanFrom(start, close),
      };
    }

    return {
      kind: "ButtonStatement",
      label: label.value ?? "",
      span: spanFrom(start, label),
    };
  }

  private synchronizeUI(): void {
    if (
      this.check("title") ||
      this.check("button") ||
      this.check("rbrace") ||
      this.check("eof")
    ) {
      return;
    }

    this.advance();

    while (!this.check("eof")) {
      if (
        this.check("title") ||
        this.check("button") ||
        this.check("rbrace")
      ) {
        return;
      }

      this.advance();
    }
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

function spanFrom(start: Token, end: Token): SourceSpan {
  return {
    start: start.span.start,
    end: end.span.end,
  };
}
