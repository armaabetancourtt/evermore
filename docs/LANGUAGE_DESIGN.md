
# Evermore Language Design

## Status

**Draft 0.1 — executable foundation + forward language design**

This document distinguishes:

- **implemented syntax** — accepted by the current compiler;
- **reserved design direction** — part of the language model but not executable yet;
- **research questions** — deliberately unresolved.

The language must never confuse aspiration with implementation.

---

## 1. Design goals

Evermore optimizes for five properties simultaneously:

1. **Approachability** — source should be readable by someone who understands the product before they understand the framework.
2. **Semantic rigor** — programs must have deterministic syntax and analyzable meaning.
3. **Progressive disclosure** — advanced control should appear only when required.
4. **Portability of intent** — application meaning should outlive specific frameworks.
5. **Interoperability** — existing ecosystems remain available through explicit boundaries.

Evermore is not English executed by an LLM.

Natural-looking syntax is parsed by an ordinary compiler.

---

## 2. Surface philosophy

Evermore supports two conceptual surface levels.

### Natural form

~~~evermore
screen Home

  title "Build what you imagine"

  button "Continue"
    opens Dashboard
~~~

This is the intended human-first direction.

### Explicit form

~~~evermore
screen Home {
  title "Build what you imagine"

  button "Continue" {
    opens Dashboard
  }
}
~~~

Both natural and explicit forms are implemented for the M1 surface. Explicit delimiters remain useful for tooling and advanced editing, while natural blocks use deterministic terminators such as `end` where a boundary cannot be inferred from a top-level declaration.

Both forms lower into equivalent semantic representations.

### Indentation

Indentation communicates hierarchy to humans but is not intended to carry semantic meaning.

This avoids a class of accidental syntax errors while preserving clean formatting.

---

## 3. Implemented grammar

The executable M1 + current M2 surface accepts the following EBNF-like grammar:

~~~text
program          ::= app_unit | module_unit ;
app_unit         ::= "app" string import_decl* declaration* EOF ;
module_unit      ::= "module" identifier import_decl* declaration* EOF ;
import_decl      ::= "import" string ;

declaration      ::= protocol
                   | data
                   | class
                   | choice
                   | function
                   | component
                   | screen ;

protocol         ::= "protocol" identifier protocol_body ;
protocol_body    ::= "{" protocol_item* "}"
                   | protocol_item* "end" ;
protocol_item    ::= data_field | function ;

data             ::= "data" identifier data_body ;
data_body        ::= "{" data_item* "}"
                   | data_item* "end" ;
data_item        ::= conformance | data_field | function ;
conformance      ::= "conforms" identifier ;
data_field       ::= identifier type_annotation ;

class            ::= "class" identifier class_body ;
class_body       ::= "{" class_item* "}"
                   | class_item* "end" ;
class_item       ::= conformance | class_field | function ;
class_field      ::= ("public" | "private")? identifier type_annotation ;

choice           ::= "choice" identifier choice_body ;
choice_body      ::= "{" choice_case* "}"
                   | choice_case* "end" ;
choice_case      ::= identifier ;

function         ::= "function" identifier function_body ;
function_body    ::= "{" function_item* "}"
                   | function_item* "end" ;
function_item    ::= generic_parameter
                   | parameter
                   | return_type
                   | let_statement
                   | var_statement
                   | set_statement
                   | return_statement ;
generic_parameter ::= "generic" identifier ("conforms" identifier)? ;
parameter        ::= "takes" identifier type_annotation ;
return_type      ::= "returns" type_annotation ;
let_statement    ::= "let" identifier "=" expression ;
var_statement    ::= "var" identifier "=" expression ;
set_statement    ::= "set" identifier "=" expression ;
return_statement ::= "return" expression ;

type_annotation  ::= "optional" type_annotation
                   | "list" "of" type_annotation
                   | "set" "of" type_annotation
                   | "map" "of" type_annotation "to" type_annotation
                   | "result" "of" type_annotation "error" type_annotation
                   | type_atom ;
type_atom        ::= "text" | identifier ;

expression       ::= if_expression
                   | match_expression
                   | comparison ;

if_expression    ::= "if" comparison
                     "then" expression
                     "else" expression ;

match_expression ::= "match" comparison
                     match_case*
                     "end" ;
match_case       ::= "case" (identifier | "ok" | "error")
                     identifier? "then" expression ;

comparison       ::= additive
                     (("==" | "!=" | ">" | ">=" | "<" | "<=")
                     additive)* ;

additive         ::= multiplicative
                     (("+" | "-") multiplicative)* ;

multiplicative   ::= primary
                     (("*" | "/") primary)* ;

primary          ::= integer
                   | string
                   | "true"
                   | "false"
                   | "none"
                   | "ok" "(" expression ")"
                   | "error" "(" expression ")"
                   | list_literal
                   | set_literal
                   | map_literal
                   | identifier
                   | identifier "." identifier
                   | identifier "." identifier "(" arguments? ")"
                   | identifier "(" arguments? ")"
                   | "(" expression ")" ;

list_literal     ::= "[" arguments? "]" ;
set_literal      ::= "set" "[" arguments? "]" ;
map_literal      ::= "map" "[" map_entries? "]" ;
map_entries      ::= expression ":" expression
                     ("," expression ":" expression)* ;
arguments        ::= expression ("," expression)* ;

component        ::= "component" identifier component_body ;
component_body   ::= "{" visual_statement* "}"
                   | visual_statement* "end" ;

screen           ::= "screen" identifier screen_body ;
screen_body      ::= "{" screen_statement* "}"
                   | screen_statement*
                     // natural screen ends at next top-level declaration / EOF
                   ;

screen_statement ::= state
                   | title
                   | visual_statement ;

state            ::= "state" identifier "starts" integer ;
title            ::= "title" string ;

visual_statement ::= text
                   | show
                   | button
                   | stack
                   | use ;

text             ::= "text" string ;
show             ::= "show" identifier ;
use              ::= "use" identifier ;

button           ::= "button" string
                     ("{" button_action "}" | button_action)? ;

button_action    ::= "opens" identifier
                   | "increases" identifier ;

stack            ::= "stack" stack_direction stack_body ;
stack_direction  ::= "vertical" | "horizontal" ;
stack_body       ::= "{" visual_statement* "}"
                   | visual_statement* "end" ;

identifier       ::= letter (letter | digit | "_" | "-")* ;
integer          ::= digit+ ;
string           ::= '"' character* '"' ;
~~~

### Structural rule

Whitespace and indentation are trivia. They improve readability but do not determine block ownership. Natural nested constructs that cannot be terminated by a following top-level declaration use the explicit word `end`.

### Current type semantics

The compiler supports relative multi-file modules and local package imports. An entry file begins with `app "Name"`, imported files begin with `module Name`, and imports appear immediately after the header. Relative imports use paths such as `import "./relative.ever"`. When compiling through an `evermore.json` manifest, bare imports such as `import "shared/models"` resolve through declared exact local package dependencies. Imported declarations are composed into one project-wide semantic scope before typechecking and lowering.

The checker currently supports:

- primitive `text`, `number`, `boolean` and `id`;
- nominal `data`, encapsulated nominal `class`, and payload-free nominal `choice` types;
- field-contract `protocol` declarations with statically checked `data` conformances;
- protocol-typed values and member access through protocol contracts;
- inferred generic function type parameters, including `generic T conforms Protocol`;
- nominal `data` and `class` construction through `Type(field1, field2, ...)` in declaration order;
- recursive `list of T`, `set of T`, `map of K to V` and `optional T` type annotations;
- `none` with optional lifting;
- homogeneous list/set literal inference and compatible key/value inference for maps;
- contextual typing of empty lists, sets and maps when the collection type is already expected;
- bidirectional generic-call inference from arguments and expected result context, including context flowing back into ambiguous generic arguments;
- typed pure function signatures and forward calls;
- local immutable `let` inference and mutable `var` initializer inference;
- mutable local `var` storage with type-preserving `set` assignment;
- numeric arithmetic and ordering;
- compatible equality comparisons;
- typed `if` expressions;
- exhaustive `match` expressions over choices and typed results;
- explicit `result of T error E` values with contextual `ok(...)` and `error(...)`;
- payload bindings for result branches such as `case ok value then ...`.

A `match` fails semantic analysis when a choice/result case is missing, repeated or unknown. Branch result types must have a compatible common type. Result constructors are intentionally contextual: the surrounding declared result type determines the opposite side of the result instead of silently inventing it.

### M1 component rule

Reusable components remain deliberately **stateless** in M1. They may contain text, buttons, navigation, stacks and other components. Reading or mutating screen-local state from a component is rejected until typed component inputs/bindings are designed.

### Executable evidence

The test suite requires natural and explicit forms to lower to equivalent generated artifacts for overlapping syntax. Generated Vue/Vite applications are then type-checked with `vue-tsc` and built in CI.

This grammar remains intentionally narrower than the long-term language. Executable semantics take priority over aspirational syntax.

---

## 4. Planned semantic families

These are design targets, not implemented claims.

### Values and functions — implemented local storage core

Immutable `let`, explicitly mutable `var`, type-preserving `set` assignment and pure typed functions are executable today:

~~~evermore
function add

  takes a number
  takes b number
  returns number

  var total = a + b
  set total = total + 1
  return total

end
~~~

`let` is immutable by default. `var` opts into mutation, and every `set` must remain assignable to the variable's inferred storage type. Parameters remain immutable. Broader module/global lifetimes are deliberately deferred to module semantics rather than being implicit mutable globals.

### Protocol contracts — implemented core

Field and method contracts are executable today:

~~~evermore
protocol Named
  name text

  function display
    returns text
  end
end

data User
  conforms Named
  name text
  age number

  function display
    returns text
    return name
  end
end
~~~

The compiler verifies field and method conformance before lowering to a target. Protocol-typed values can read declared fields and call declared methods, including through protocol-constrained generics. Data methods are executable and may read their own fields directly as immutable values. Protocol methods are signature-only requirements; generic methods are deliberately deferred while top-level protocol-constrained generics remain the supported generic behavior boundary.

### Algebraic data — partially implemented

Nominal `data` records and payload-free `choice` types are executable today. Data declarations are also executable constructors: calling the data type name creates a value in field declaration order, with arity and field types checked before lowering. Payload-carrying general choices and generic nominal choices remain post-M2 language extensions.

~~~evermore
data User
  name text
  active boolean
end

function makeUser
  takes name text
  returns User
  return User(name, true)
end

choice Status
  draft
  active
  archived
end
~~~

Exhaustive choice matching is also executable:

~~~evermore
return match status
  case draft then "Draft"
  case active then "Active"
  case archived then "Archived"
end
~~~

### Generics — implemented for functions

Generic function parameters are declared once and inferred at call sites:

~~~evermore
function identity
  generic T
  takes value T
  returns T
  return value
end
~~~

Evermore infers generic substitutions from arguments and, where unambiguous, from the expected result type. Generic parameters may be constrained by declared protocols with `generic T conforms Named`. Generic data and choice declarations remain post-M2 language extensions.

### Type inference — implemented M2 boundary

Evermore uses bidirectional inference when the available evidence determines a unique type. Context flows both from arguments into generic parameters and from an expected result type back through a generic call into its arguments.

~~~evermore
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
~~~

The declared return type establishes `T = list of text`, which then provides the element context needed by the empty list. Repeated generic evidence is unified with the same common-type rules used by branches and collections, so compatible values such as `none` and `text` can infer `optional text`.

Inference deliberately stops when evidence is ambiguous. A standalone `let values = []` remains an error rather than receiving a guessed element type.

### Collections — implemented core families

Evermore has three typed collection families: `list of T`, `set of T`, and `map of K to V`. Their literals infer compatible element/key/value types, and empty literals use contextual typing.

~~~evermore
function names
  returns list of text
  return ["Ada", "Grace"]
end

function tags
  returns set of text
  return set["compiler", "language"]
end

function scores
  returns map of text to number
  return map["Ada": 100, "Grace": 99]
end

function emptyNames
  returns list of text
  return []
end
~~~

Higher-level collection APIs and specialized structures such as queues, trees and graphs remain standard-library/ecosystem work rather than blockers for the M2 core collection families.

### Modules — implemented core

Evermore projects may split declarations across files without falling through to target-language imports:

~~~evermore
app "Atlas"
import "./domain.ever"

function greeting
  returns text
  let user = makeUser("Ada")
  return user.display()
end
~~~

~~~evermore
module Domain
import "./contracts.ever"

data User
  conforms Named
  name text

  function display
    returns text
    return name
  end
end
~~~

The `app` file is the single project entrypoint. Imported files must use a `module` header. Relative imports are resolved from the importing file, optional `.ever` extensions are normalized, repeated physical imports are deduplicated, cycles are rejected, and all declarations participate in one semantic/typechecking pass.

M2 modules deliberately use a project-wide declaration namespace. Namespaced imports, visibility/export controls, external package lookup and version resolution belong to package semantics rather than being silently approximated here.

### Package semantics — implemented local core

M2 packages use a small explicit JSON manifest:

~~~json
{
  "name": "atlas-app",
  "version": "0.1.0",
  "entry": "main.ever",
  "dependencies": {
    "shared": {
      "path": "../shared",
      "version": "1.2.3"
    }
  }
}
~~~

Package names are stable lowercase identities and package versions are exact semantic versions. Dependencies are intentionally local and exact in M2: each dependency declares a relative path and the exact version expected at that path. The compiler validates package name/version identity before source loading.

A package-aware source may import a dependency entrypoint:

~~~evermore
import "shared"
~~~

or a module inside the dependency:

~~~evermore
import "shared/models"
~~~

Dependencies may themselves declare dependencies. The compiler resolves the complete local package graph, rejects package cycles, undeclared package imports, identity/version mismatches and paths that escape a dependency root, then composes all reachable source modules into one typed project.

Package compilation emits `src/generated/evermore.package.json`, a deterministic package graph containing every resolved package identity and its exact dependency versions. Network registries, version ranges, publishing, integrity hashes and remote fetching are deliberately deferred to later registry/tooling milestones rather than hidden behind M2 behavior.

### Error model — implemented core

Failures are ordinary typed values rather than implicit exceptions:

~~~evermore
function findUser
  takes exists boolean
  returns result of User error text
  return if exists then ok(User("Ada")) else error("user-not-found")
end

function displayUser
  takes outcome result of User error text
  returns text
  return match outcome
    case ok user then user.name
    case error reason then reason
  end
end
~~~

`result of T error E` preserves both success and failure types through function signatures, generics, collections and generated TypeScript. `ok(...)` and `error(...)` are checked against contextual result types. Matching a result is exhaustive over exactly `ok` and `error`, and each branch may bind its typed payload.

The M2 model deliberately favors explicit propagation through return values and matching. Implicit exception throwing/catching and automatic propagation syntax are not required for the core error contract.

### Classes and encapsulation — implemented core

Classes are nominal reference-like values with constructor fields, methods, protocol conformance, and enforced field visibility.

~~~evermore
class Account
  conforms Named
  public name text
  private accessToken text

  function display
    returns text
    return name
  end

  function credential
    returns text
    return accessToken
  end
end
~~~

Public fields participate in the externally visible class type. Private fields remain constructor state captured by generated method closures and are rejected by external member access. Class methods may read both public and private fields directly as immutable instance state. Protocol field requirements must be satisfied by public fields; protocol methods may be implemented by class methods.

Inheritance is intentionally not part of the M2 core. Evermore favors protocol conformance and composition before inheritance hierarchies. Mutable instance fields and private methods are later design work and are not required for the current encapsulation contract.

### Generics

~~~evermore
function first<T> values List<T> -> T?
~~~

### Effects

~~~evermore
function loadProfile id UserId -> User
  effects network, database.read
~~~

Effects are part of the semantic model, not comments.

---

## 5. AI-native constructs

AI behavior requires more structure than arbitrary prompt strings.

A future agent declaration:

~~~evermore
agent Researcher

  accepts ResearchQuestion
  returns ResearchReport

  can
    search web
    read project files

  requires approval to
    send email

  context
    budget 24000 tokens
    summarize overflow
~~~

is intended to lower into:

- typed input/output contracts;
- explicit tool capabilities;
- effect declarations;
- resource budgets;
- approval boundaries;
- provider-neutral execution plans;
- traceable runtime events.

Model vendors are configuration. They are not language semantics.

---

## 6. Security types

Planned confidentiality classes:

~~~text
public ⊑ internal ⊑ sensitive ⊑ secret
~~~

A value should not implicitly flow downward in confidentiality.

Example:

~~~evermore
data Account
  email email internal
  passwordHash secret
~~~

Potential invalid operation:

~~~evermore
log account.passwordHash
~~~

Expected diagnostic:

~~~text
Security error

passwordHash is Secret.
Secret values cannot flow into logs.

Consider logging authentication status instead.
~~~

---

## 7. Capability model

Some operations require authority, not only a type.

~~~evermore
capability Camera
capability Location
capability Payments
~~~

Functions and agents may require capabilities:

~~~evermore
function scanReceipt using Camera -> Receipt
~~~

This creates a shared abstraction for:

- mobile permissions;
- server credentials;
- agent tools;
- filesystem access;
- cloud operations;
- sensitive data access.

---

## 8. Foreign-language interoperability

Interop must be explicit and typed.

Research targets:

~~~evermore
use python from "./risk_model.py"
use java class com.example.PaymentEngine
use javascript package "zod"
~~~

Native platform extensions:

~~~evermore
capability Health

  ios uses HealthKit with Swift
  android uses HealthConnect with Kotlin
~~~

Evermore should make ecosystem boundaries visible rather than pretending they do not exist.

---

## 9. Diagnostics

Diagnostics are part of the language UX.

Bad:

~~~text
Unexpected token: }
~~~

Preferred:

~~~text
ERROR E2002

Button "Continue" opens unknown screen "Dashboard".

help:
Declare screen Dashboard or change the navigation target.
~~~

Every diagnostic should aim to provide:

1. what happened;
2. where it happened;
3. why it matters;
4. the smallest useful next action.

---

## 10. Formatting

Evermore ships a canonical formatter for the implemented surface.

The formatter should:

- preserve semantic equivalence;
- eliminate formatting debates;
- make generated and human-authored code visually consistent;
- support both natural and explicit syntax when both are available.

---

## 11. Compatibility

Language evolution must be versioned independently from target frameworks.

A future module may declare:

~~~evermore
language 1.0
~~~

Framework adapters may evolve without changing source semantics.

The language specification, IR version and target backend versions should be independently identifiable.

---

## 12. Non-goals

Evermore is not trying to:

- parse unrestricted natural language as source code;
- replace Python's scientific ecosystem;
- replace Swift/Kotlin for every native edge case;
- hide infrastructure until it becomes impossible to debug;
- generate code that developers are forbidden to inspect;
- make all platforms identical.

The goal is **portable intent with explicit escape hatches**.
