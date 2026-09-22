import type { SourcePosition, SourceSpan } from "./ast.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";

export type TokenKind =
  | "app"
  | "data"
  | "choice"
  | "function"
  | "takes"
  | "returns"
  | "list"
  | "of"
  | "optional"
  | "none"
  | "if"
  | "match"
  | "case"
  | "then"
  | "else"
  | "let"
  | "return"
  | "true"
  | "false"
  | "screen"
  | "component"
  | "use"
  | "title"
  | "text"
  | "state"
  | "starts"
  | "show"
  | "stack"
  | "vertical"
  | "horizontal"
  | "end"
  | "button"
  | "opens"
  | "increases"
  | "identifier"
  | "number"
  | "string"
  | "lbrace"
  | "rbrace"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "dot"
  | "equal"
  | "eqeq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "eof";

export type Token = {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly value?: string | undefined;
  readonly span: SourceSpan;
};

const keywords = new Map<string, TokenKind>([
  ["app", "app"],
  ["data", "data"],
  ["choice", "choice"],
  ["function", "function"],
  ["takes", "takes"],
  ["returns", "returns"],
  ["list", "list"],
  ["of", "of"],
  ["optional", "optional"],
  ["none", "none"],
  ["if", "if"],
  ["match", "match"],
  ["case", "case"],
  ["then", "then"],
  ["else", "else"],
  ["let", "let"],
  ["return", "return"],
  ["true", "true"],
  ["false", "false"],
  ["screen", "screen"],
  ["component", "component"],
  ["use", "use"],
  ["title", "title"],
  ["text", "text"],
  ["state", "state"],
  ["starts", "starts"],
  ["show", "show"],
  ["stack", "stack"],
  ["vertical", "vertical"],
  ["horizontal", "horizontal"],
  ["end", "end"],
  ["button", "button"],
  ["opens", "opens"],
  ["increases", "increases"],
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

      if (char === "[") {
        this.advance();
        tokens.push(this.token("lbracket", "[", start));
        continue;
      }

      if (char === "]") {
        this.advance();
        tokens.push(this.token("rbracket", "]", start));
        continue;
      }

      if (char === "(") {
        this.advance();
        tokens.push(this.token("lparen", "(", start));
        continue;
      }

      if (char === ")") {
        this.advance();
        tokens.push(this.token("rparen", ")", start));
        continue;
      }

      if (char === ",") {
        this.advance();
        tokens.push(this.token("comma", ",", start));
        continue;
      }

      if (char === ".") {
        this.advance();
        tokens.push(this.token("dot", ".", start));
        continue;
      }

      if (char === "=") {
        this.advance();
        if (this.peek() === "=") {
          this.advance();
          tokens.push(this.token("eqeq", "==", start));
        } else {
          tokens.push(this.token("equal", "=", start));
        }
        continue;
      }

      if (char === "!") {
        this.advance();
        if (this.peek() !== "=") {
          throw new EvermoreDiagnosticError([
            {
              code: "E0003",
              severity: "error",
              message: 'Expected "=" after "!".',
              span: { start, end: this.position() },
              help: 'Use "!=" for inequality.',
            },
          ]);
        }
        this.advance();
        tokens.push(this.token("neq", "!=", start));
        continue;
      }

      if (char === ">") {
        this.advance();
        if (this.peek() === "=") {
          this.advance();
          tokens.push(this.token("gte", ">=", start));
        } else {
          tokens.push(this.token("gt", ">", start));
        }
        continue;
      }

      if (char === "<") {
        this.advance();
        if (this.peek() === "=") {
          this.advance();
          tokens.push(this.token("lte", "<=", start));
        } else {
          tokens.push(this.token("lt", "<", start));
        }
        continue;
      }

      if (char === "+") {
        this.advance();
        tokens.push(this.token("plus", "+", start));
        continue;
      }

      if (char === "-") {
        this.advance();
        tokens.push(this.token("minus", "-", start));
        continue;
      }

      if (char === "*") {
        this.advance();
        tokens.push(this.token("star", "*", start));
        continue;
      }

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

      if (char === "/") {
        this.advance();
        tokens.push(this.token("slash", "/", start));
        continue;
      }

      if (char === '"') {
        tokens.push(this.scanString(start));
        continue;
      }

      if (/[0-9]/.test(char)) {
        tokens.push(this.scanNumber(start));
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

  private scanNumber(start: SourcePosition): Token {
    while (!this.atEnd() && /[0-9]/.test(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(start.offset, this.index);
    return {
      kind: "number",
      lexeme,
      value: lexeme,
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
      ...(kind === "identifier" ? { value: lexeme } : {}),
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
