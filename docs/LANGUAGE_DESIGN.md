
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

The executable M1 surface accepts the following EBNF-like grammar:

~~~text
program          ::= "app" string declaration* EOF ;

declaration      ::= data
                   | function
                   | component
                   | screen ;

data             ::= "data" identifier data_body ;
data_body        ::= "{" data_field* "}"
                   | data_field* "end" ;
data_field       ::= identifier type_name ;

function         ::= "function" identifier function_body ;
function_body    ::= "{" function_item* "}"
                   | function_item* "end" ;
function_item    ::= parameter
                   | return_type
                   | let_statement
                   | return_statement ;
parameter        ::= "takes" identifier type_name ;
return_type      ::= "returns" type_name ;
let_statement    ::= "let" identifier "=" expression ;
return_statement ::= "return" expression ;

expression       ::= additive ;
additive         ::= multiplicative
                     (("+" | "-") multiplicative)* ;
multiplicative   ::= primary
                     (("*" | "/") primary)* ;
primary          ::= integer
                   | string
                   | "true"
                   | "false"
                   | identifier
                   | identifier "(" arguments? ")"
                   | "(" expression ")" ;
arguments        ::= expression ("," expression)* ;

type_name        ::= "text" | identifier ;

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

Whitespace and indentation are trivia. They improve readability but do not determine block ownership.

Natural nested constructs that cannot be terminated by a following top-level declaration use the explicit word:

~~~evermore
end
~~~

This keeps the human-facing surface readable without importing Python-style indentation semantics.

### M1 component rule

Reusable components are deliberately **stateless** in M1. They may contain text, buttons, navigation, stacks and other components. Reading or mutating screen-local state from a component is rejected until typed component inputs/bindings are designed.

### Executable equivalence

The test suite requires natural and explicit forms to lower to equivalent generated artifacts for overlapping syntax. The Vue/Vite target is then compiled in CI.

The current type checker recognizes primitive types `text`, `number`, `boolean` and `id`, plus nominal user-defined `data` types. Function signatures are checked before bodies, enabling forward calls and recursive references at the signature level. Local `let` values infer their type from expressions.

This grammar remains intentionally narrow. A small executable language is more valuable than a broad fictional one.

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

### Algebraic data

~~~evermore
structure User
  id id
  name text
  email email

choice Result<T, E>
  success T
  failure E
~~~

### Collections

~~~evermore
List<T>
Set<T>
Map<K, V>
Queue<T>
Stack<T>
Tree<T>
Graph<N, E>
~~~

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
