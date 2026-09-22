
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
program          ::= "app" string declaration* EOF ;

declaration      ::= protocol
                   | data
                   | choice
                   | function
                   | component
                   | screen ;

protocol         ::= "protocol" identifier protocol_body ;
protocol_body    ::= "{" data_field* "}"
                   | data_field* "end" ;

data             ::= "data" identifier data_body ;
data_body        ::= "{" data_item* "}"
                   | data_item* "end" ;
data_item        ::= conformance | data_field ;
conformance      ::= "conforms" identifier ;
data_field       ::= identifier type_annotation ;

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
                   | return_statement ;
generic_parameter ::= "generic" identifier ("conforms" identifier)? ;
parameter        ::= "takes" identifier type_annotation ;
return_type      ::= "returns" type_annotation ;
let_statement    ::= "let" identifier "=" expression ;
return_statement ::= "return" expression ;

type_annotation  ::= "optional" type_annotation
                   | "list" "of" type_annotation
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
match_case       ::= "case" identifier "then" expression ;

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
                   | list_literal
                   | identifier
                   | identifier "." identifier
                   | identifier "(" arguments? ")"
                   | "(" expression ")" ;

list_literal     ::= "[" arguments? "]" ;
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

The checker currently supports:

- primitive `text`, `number`, `boolean` and `id`;
- nominal `data` and payload-free nominal `choice` types;
- field-contract `protocol` declarations with statically checked `data` conformances;
- inferred generic function type parameters declared with `generic T`;
- recursive `list of T` and `optional T` type annotations;
- `none` with optional lifting;
- homogeneous list-literal inference;
- contextual typing of empty lists when a list type is already expected;
- generic-call inference from arguments and expected result context;
- typed pure function signatures and forward calls;
- local immutable `let` inference;
- numeric arithmetic and ordering;
- compatible equality comparisons;
- typed `if` expressions;
- exhaustive `match` expressions over choices.

A `match` fails semantic analysis when a choice case is missing, repeated or unknown. Branch result types must have a compatible common type.

### M1 component rule

Reusable components remain deliberately **stateless** in M1. They may contain text, buttons, navigation, stacks and other components. Reading or mutating screen-local state from a component is rejected until typed component inputs/bindings are designed.

### Executable evidence

The test suite requires natural and explicit forms to lower to equivalent generated artifacts for overlapping syntax. Generated Vue/Vite applications are then type-checked with `vue-tsc` and built in CI.

This grammar remains intentionally narrower than the long-term language. Executable semantics take priority over aspirational syntax.

---

## 4. Planned semantic families

These are design targets, not implemented claims.

### Values and functions — partially implemented

Immutable local `let` bindings and pure typed functions are executable today:

~~~evermore
function add

  takes a number
  takes b number
  returns number

  let total = a + b
  return total

end
~~~

Broader value lifetimes, mutable variables and richer expression families remain M2 work.

### Protocol contracts — partially implemented

Field contracts are executable today:

~~~evermore
protocol Named
  name text
end

data User
  conforms Named
  name text
  age number
end
~~~

The compiler verifies conformance before lowering to a target. Protocol-typed values and field member access are executable, and protocols can constrain generic function parameters. Method requirements remain M2 work.

### Algebraic data — partially implemented

Nominal `data` records and payload-free `choice` types are executable today. Payload-carrying algebraic cases and generic choices remain future M2 work.

~~~evermore
data User
  id id
  name text
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

Generic function parameters are declared once and inferred at call sites. They may also be constrained by a protocol:

~~~evermore
protocol Identified
  id id
end

function identifier
  generic T conforms Identified
  takes value T
  returns id
  return value.id
end
~~~

Evermore infers generic substitutions from arguments and, where unambiguous, from the expected result type. A constrained generic exposes the fields guaranteed by its protocol, and generated TypeScript preserves the constraint with an `extends` clause. Generic data and choice declarations remain later M2 work.

### Collections — partially implemented

`list of T`, list literals, homogeneous element inference and contextual empty-list typing are executable today.

~~~evermore
function names
  returns list of text
  return ["Ada", "Grace"]
end

function emptyNames
  returns list of text
  return []
end
~~~

Set, map, queue, tree, graph and broader collection APIs remain future work.

### Object-oriented programming

Evermore will support encapsulation and interface-driven design without forcing inheritance as the default abstraction.

~~~evermore
interface Repository<T>
  function find id -> T?
  function save value T

class UserService
  private users Repository<User>

  function create input CreateUser -> User
~~~

Composition should remain easier than deep inheritance.

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
