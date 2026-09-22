import type { SourcePosition, SourceSpan } from "./ast.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";

export type TokenKind =
  | "app"
  | "screen"
  | "title"
  | "button"
  | "opens"
  | "identifier"
  | "string"
  | "lbrace"
  | "rbrace"
  | "eof";

export type Token = {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly value?: string;
  readonly span: SourceSpan;
};

const keywords = new Map<string, TokenKind>([
  ["app", "app"],
  ["screen", "screen"],
  ["title", "title"],
  ["button", "button"],
  ["opens", "opens"],
]);

export function lex(source: string): readonly Token[] {
  const lexer = new Lexer(source);
  return lexer.scan();
}

class Lexer {
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  scan(): readonly Token[] {
    const tokens: Token[] = [];

    while (!this.atEnd()) {
      this.skipTrivia();
      if (this.atEnd()) break;

      const start = this.position();
      const char = this.peek();

      if (char === "{") {
        this.advance();
        tokens.push(this.token("lbrace", "{", start));
        continue;
      }

      if (char === "}") {
        this.advance();
        tokens.push(this.token("rbrace", "}", start));
        continue;
      }

      if (char === '"') {
        tokens.push(this.scanString(start));
        continue;
      }

      if (isIdentifierStart(char)) {
        tokens.push(this.scanIdentifier(start));
        continue;
      }

      const bad = this.advance();
      throw new EvermoreDiagnosticError([
        {
          code: "E0001",
          severity: "error",
          message: "Unexpected character " + JSON.stringify(bad) + ".",
          span: { start, end: this.position() },
          help: "Remove the character or place it inside a string literal.",
        },
      ]);
    }

    const position = this.position();
    tokens.push({
      kind: "eof",
      lexeme: "",
      span: { start: position, end: position },
    });

    return tokens;
  }

  private skipTrivia(): void {
    while (!this.atEnd()) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      if (char === "/" && this.peekNext() === "/") {
        while (!this.atEnd() && this.peek() !== "\n") this.advance();
        continue;
      }

      break;
    }
  }

  private scanString(start: SourcePosition): Token {
    this.advance();
    let value = "";

    while (!this.atEnd() && this.peek() !== '"') {
      const char = this.advance();

      if (char === "\\") {
        if (this.atEnd()) break;
        const escaped = this.advance();
        switch (escaped) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case '"':
            value += '"';
            break;
          case "\\":
            value += "\\";
            break;
          default:
            value += escaped;
        }
        continue;
      }

      value += char;
    }

    if (this.atEnd()) {
      throw new EvermoreDiagnosticError([
        {
          code: "E0002",
          severity: "error",
          message: "Unterminated string literal.",
          span: { start, end: this.position() },
          help: 'Close the string with a double quote (").',
        },
      ]);
    }

    this.advance();

    return {
      kind: "string",
      lexeme: this.source.slice(start.offset, this.index),
      value,
      span: { start, end: this.position() },
    };
  }

  private scanIdentifier(start: SourcePosition): Token {
    while (!this.atEnd() && isIdentifierContinue(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(start.offset, this.index);
    const kind = keywords.get(lexeme) ?? "identifier";

    return {
      kind,
      lexeme,
      value: kind === "identifier" ? lexeme : undefined,
      span: { start, end: this.position() },
    };
  }

  private token(
    kind: TokenKind,
    lexeme: string,
    start: SourcePosition,
  ): Token {
    return {
      kind,
      lexeme,
      span: { start, end: this.position() },
    };
  }

  private position(): SourcePosition {
    return {
      offset: this.index,
      line: this.line,
      column: this.column,
    };
  }

  private atEnd(): boolean {
    return this.index >= this.source.length;
  }

  private peek(): string {
    return this.source[this.index] ?? "\0";
  }

  private peekNext(): string {
    return this.source[this.index + 1] ?? "\0";
  }

  private advance(): string {
    const char = this.source[this.index] ?? "\0";
    this.index += 1;

    if (char === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }

    return char;
  }
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentifierContinue(char: string): boolean {
  return /[A-Za-z0-9_-]/.test(char);
}
