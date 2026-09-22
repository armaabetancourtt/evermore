import { compile } from "../../src/compiler.js";
import { EvermoreDiagnosticError } from "../../src/diagnostics.js";

type RejectCase = {
  readonly name: string;
  readonly source: string;
  readonly code: string;
};

const accepted = [
  {
    name: "explicit protocol conformance",
    source: String.raw`
app "Accepted"

protocol Named
  name text
end

data User
  conforms Named
  name text
end

function display
  takes value Named
  returns text
  return value.name
end

function example
  returns text
  return display(User("Ada"))
end

screen Home
  title "Accepted"
`,
  },
  {
    name: "context flows through generic calls",
    source: String.raw`
app "Accepted"

function identity
  generic T
  takes value T
  returns T
  return value
end

function emptyNames
  returns list of text
  return identity([])
end

screen Home
  title "Accepted"
`,
  },
  {
    name: "compatible generic evidence widens to optional",
    source: String.raw`
app "Accepted"

function choose
  generic T
  takes left T
  takes right T
  returns T
  return left
end

function maybeName
  returns optional text
  return choose(none, "Ada")
end

screen Home
  title "Accepted"
`,
  },
];

const rejected: readonly RejectCase[] = [
  {
    name: "same-shaped nominal data types remain distinct",
    code: "E2209",
    source: String.raw`
app "Rejected"

data User
  name text
end

data Customer
  name text
end

function userName
  takes user User
  returns text
  return user.name
end

function wrong
  returns text
  return userName(Customer("Ada"))
end

screen Home
  title "Rejected"
`,
  },
  {
    name: "protocol conformance is explicit rather than duck typed",
    code: "E2209",
    source: String.raw`
app "Rejected"

protocol Named
  name text
end

data User
  name text
end

function display
  takes value Named
  returns text
  return value.name
end

function wrong
  returns text
  return display(User("Ada"))
end

screen Home
  title "Rejected"
`,
  },
  {
    name: "private class state cannot escape through member access",
    code: "E2330",
    source: String.raw`
app "Rejected"

class Account
  private token text
end

function leak
  takes account Account
  returns text
  return account.token
end

screen Home
  title "Rejected"
`,
  },
  {
    name: "result payload types are preserved",
    code: "E2342",
    source: String.raw`
app "Rejected"

function wrong
  returns result of number error text
  return ok("not-a-number")
end

screen Home
  title "Rejected"
`,
  },
  {
    name: "collections reject incompatible element evidence",
    code: "E2211",
    source: String.raw`
app "Rejected"

function wrong
  returns list of number
  return [1, "two"]
end

screen Home
  title "Rejected"
`,
  },
  {
    name: "generic parameters reject incompatible evidence",
    code: "E2209",
    source: String.raw`
app "Rejected"

function same
  generic T
  takes left T
  takes right T
  returns T
  return left
end

function wrong
  returns number
  return same(1, "two")
end

screen Home
  title "Rejected"
`,
  },
];

const results: Array<{
  name: string;
  expected: "accept" | "reject";
  outcome: "accepted" | "rejected";
  diagnostic?: string;
}> = [];

for (const item of accepted) {
  compile(item.source);
  results.push({
    name: item.name,
    expected: "accept",
    outcome: "accepted",
  });
}

for (const item of rejected) {
  try {
    compile(item.source);
    throw new Error(
      'Counterexample "' + item.name + '" unexpectedly compiled.',
    );
  } catch (error) {
    if (!(error instanceof EvermoreDiagnosticError)) {
      throw error;
    }

    const diagnostic = error.diagnostics.find(
      (entry) => entry.code === item.code,
    );

    if (!diagnostic) {
      throw new Error(
        'Counterexample "' +
          item.name +
          '" rejected without expected diagnostic ' +
          item.code +
          ". Got: " +
          error.diagnostics.map((entry) => entry.code).join(", "),
      );
    }

    results.push({
      name: item.name,
      expected: "reject",
      outcome: "rejected",
      diagnostic: item.code,
    });
  }
}

console.log(
  JSON.stringify(
    {
      accepted: accepted.length,
      rejected: rejected.length,
      allExpected: true,
      results,
      interpretation: {
        soundness:
          "This is executable engineering evidence for known type boundaries, not a formal proof of type-system soundness.",
        nominalBoundary:
          "Data, class and choice identities are nominal. Protocol use requires explicit declared conformance; matching fields alone do not imply conformance.",
        effects:
          "M2 has no ambient I/O, network, persistence, process or agent operations in function semantics. Local var/set mutation is lexically contained and does not require an effect annotation. External effects are deferred to later capability-bearing milestones.",
      },
    },
    null,
    2,
  ),
);
