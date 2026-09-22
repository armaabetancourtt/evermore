import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Protocol Methods"

protocol Displayable
  function display
    returns text
  end
end

protocol Renamable
  function renamed
    takes next text
    returns text
  end
end

data User
  conforms Displayable
  conforms Renamable
  name text

  function display
    returns text
    return name
  end

  function renamed
    takes next text
    returns text
    return next
  end
end

function displayValue
  takes value Displayable
  returns text
  return value.display()
end

function displayUser
  takes user User
  returns text
  return user.display()
end

function renameUser
  takes user User
  returns text
  return user.renamed("Grace")
end

function genericDisplay
  generic T conforms Displayable
  takes value T
  returns text
  return value.display()
end

function makeAndDisplay
  returns text
  let user = User("Ada")
  return user.display()
end

screen Home
  title "Protocol methods"
`;

test("parses protocol/data methods and member method calls", () => {
  const program = parse(source);

  assert.equal(program.protocols[0]?.methods.length, 1);
  assert.equal(program.data[0]?.methods.length, 2);
  assert.equal(program.data[0]?.methods[0]?.body[0]?.kind, "ReturnStatement");

  const statement = program.functions[0]?.body[0];
  assert.equal(statement?.kind, "ReturnStatement");
  if (statement?.kind === "ReturnStatement") {
    assert.equal(statement.expression.kind, "MethodCallExpression");
  }
});

test("formatter preserves nested method contracts and implementations", () => {
  const formatted = formatSource(source);

  assert.match(
    formatted,
    /protocol Displayable[\s\S]*function display[\s\S]*returns text[\s\S]*end[\s\S]*end/,
  );
  assert.match(
    formatted,
    /data User[\s\S]*function display[\s\S]*return name[\s\S]*end/,
  );
  assert.match(formatted, /return value\.display\(\)/);
  assert.match(formatted, /return user\.renamed\("Grace"\)/);
});

test("accepts protocol method conformance and constrained generic calls", () => {
  assert.doesNotThrow(() => compile(source));
});

test("generates protocol method signatures and executable closures", () => {
  const result = compile(source);
  const models = result.files.find(
    (file) => file.path === "src/generated/models.ts",
  );
  const functions = result.files.find(
    (file) => file.path === "src/generated/functions.ts",
  );

  assert.ok(models);
  assert.ok(functions);

  assert.match(models.content, /readonly "display": \(\) => string;/);
  assert.match(
    models.content,
    /readonly "renamed": \(arg_0: string\) => string;/,
  );
  assert.match(
    functions.content,
    /\(arg_0\)\["display"\]\(\)/,
  );
  assert.match(
    functions.content,
    /"display": \(\): string => \{ return field_0; \}/,
  );
  assert.match(
    functions.content,
    /"renamed": \(method_arg_0: string\): string => \{ return method_arg_0; \}/,
  );
});

test("rejects missing protocol method implementations", () => {
  const invalid = String.raw`
app "Broken"

protocol Displayable
  function display
    returns text
  end
end

data User
  conforms Displayable
  name text
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2409"),
      );
      return true;
    },
  );
});

test("rejects protocol method signature mismatches", () => {
  const invalid = String.raw`
app "Broken"

protocol Renamable
  function renamed
    takes next text
    returns text
  end
end

data User
  conforms Renamable
  name text

  function renamed
    takes next number
    returns text
    return name
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2410"),
      );
      return true;
    },
  );
});

test("rejects executable bodies inside protocol method requirements", () => {
  const invalid = String.raw`
app "Broken"

protocol Displayable
  function display
    returns text
    return "wrong"
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2412"),
      );
      return true;
    },
  );
});

test("typechecks data method bodies against implicit fields", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text

  function score
    returns number
    return name
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2206"),
      );
      return true;
    },
  );
});

test("rejects calls to unknown methods", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text
end

function wrong
  takes user User
  returns text
  return user.missing()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2324"),
      );
      return true;
    },
  );
});

test("rejects wrong method call arity", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text

  function renamed
    takes next text
    returns text
    return next
  end
end

function wrong
  takes user User
  returns text
  return user.renamed()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2325"),
      );
      return true;
    },
  );
});

test("rejects wrong method argument types", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text

  function renamed
    takes next text
    returns text
    return next
  end
end

function wrong
  takes user User
  returns text
  return user.renamed(42)
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2326"),
      );
      return true;
    },
  );
});

test("requires optionals to be resolved before method calls", () => {
  const invalid = String.raw`
app "Broken"

data User
  name text

  function display
    returns text
    return name
  end
end

function wrong
  takes user optional User
  returns text
  return user.display()
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2322"),
      );
      return true;
    },
  );
});

test("rejects generic methods until method generics have target semantics", () => {
  const invalid = String.raw`
app "Broken"

data Box
  value text

  function identity
    generic T
    takes item T
    returns T
    return item
  end
end

screen Home
  title "Broken"
`;

  assert.throws(
    () => compile(invalid),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2413"),
      );
      return true;
    },
  );
});
