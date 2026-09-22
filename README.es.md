# EVERMORE

### Humano primero. IA nativa. Diseñado para sobrevivir a los frameworks.

[English](README.md) · [Español](README.es.md)

> **Evermore es un lenguaje de programación experimental y una plataforma para construir productos, inteligencia e infraestructura reduciendo radicalmente la complejidad accidental.**

Evermore explora una pregunta sencilla:

> **¿Y si construir software serio se sintiera más parecido a describir el producto que a operar toda la maquinaria que existe debajo?**

El lenguaje se inspira en la claridad de **Swift**, la mentalidad multiplataforma de **Flutter** y la accesibilidad de **Python**, pero nace para un mundo donde una aplicación abarca web, móvil, servidores, datos, agentes de IA, código nativo e infraestructura cloud.

Evermore está actualmente en **pre-alpha**. El repositorio se construye con disciplina de investigación e ingeniería: primero el diseño del lenguaje, después fundamentos ejecutables del compilador y, posteriormente, targets cada vez más capaces. Las funciones descritas como **objetivos de diseño** se distinguen deliberadamente de las ya implementadas.

---

## La tesis

La ingeniería de software ha acumulado una capacidad enorme y, al mismo tiempo, una enorme complejidad incidental.

Un producto moderno puede requerir TypeScript, un framework web, otro móvil, backend, esquemas, autenticación, Dockerfiles, CI, manifiestos de Kubernetes, servicios cloud, notebooks de Python, SDKs de IA, prompts, infraestructura vectorial y varios modelos mentales distintos antes de que el producto siquiera sea visible.

Evermore no asume que esa complejidad sea inevitable.

Su objetivo es conservar el **poder esencial de la ingeniería** mientras elimina la mayor cantidad posible de **fricción accidental**.

~~~text
Human intent
    ↓
Evermore source
    ↓
Parser + semantic analysis
    ↓
Typed Evermore IR
    ↓
┌──────────┬─────────────┬──────────┬──────────┬──────────────┐
│ Web      │ Mobile      │ Server   │ Data/AI  │ Infrastructure│
│ Vue/Vite │ RN/Flutter  │ Node.js  │ Python   │ Docker / K8s │
│ TS       │ Swift/Kotlin│ TS       │ JVM      │ Cloud         │
└──────────┴─────────────┴──────────┴──────────┴──────────────┘
~~~

Los frameworks son **targets**, no el lenguaje.

Si mañana aparece un runtime móvil o web superior, Evermore debería poder incorporar un nuevo backend sin obligar a las aplicaciones a abandonar el lenguaje.

---

## Objetivo de diseño: software en términos humanos

La sintaxis a largo plazo pretende ser legible antes que impresionante.

~~~evermore
app "Atlas"

data Note
  title text
  body text
  owner User private

screen Home

  title "Your ideas"

  show notes

  button "New note"
    opens NewNote

agent Summarizer

  goal
    summarize a note without changing its meaning

  can
    read Note

  cannot
    delete Note
    publish Note

  output Summary

  budget
    4000 tokens
    prefer low latency

workflow NightlyInsights

  every day at 21:00

  find today's notes
  summarize them with Summarizer
  save the result

production

  web
    edge cache

  server
    autoscale from 2 to 10

  database postgres
    backup daily
~~~

Esto es un **objetivo de diseño**, no una afirmación de que cada construcción anterior ya esté implementada.

El lenguaje debe comenzar simple, pero no debe terminar siendo simple.

---

## Poder progresivo

Evermore se diseña alrededor de la revelación progresiva de complejidad.

### Modo natural

El modo por defecto debe leerse cerca de la intención de producto:

~~~evermore
button "Continue"
  opens Dashboard
~~~

### Modo explícito

Los desarrolladores avanzados deben poder expresar el mismo programa con mayor control formal:

~~~evermore
component ContinueButton {
  on tap {
    navigate Dashboard
  }
}
~~~

Ambas formas deben reducirse a la misma representación semántica.

La indentación existe para legibilidad. **La indentación no pretende determinar el significado del programa.**

---

# Ocho pilares

### 01 — Lenguaje humano primero

La primera abstracción es la intención del desarrollador, no la API de un framework.

Lo común debe ser obvio. Lo avanzado debe seguir siendo posible.

### 02 — Programación con IA nativa

La IA no se plantea como un SDK añadido al final. Agentes, herramientas, contexto, presupuestos, aprobaciones, salidas estructuradas y capacidades de modelos deben convertirse en conceptos tipados del lenguaje.

~~~evermore
agent Researcher

  accepts ResearchQuestion
  returns ResearchReport

  can
    search web
    read project files
    use python

  requires approval to
    send email

  context
    budget 24000 tokens
    summarize overflow
~~~

### 03 — Defaults obsesivos de producto y diseño

Evermore busca interfaces tranquilas, coherentes y accesibles por defecto.

La filosofía de diseño se inspira en el énfasis de Apple en claridad, jerarquía, consistencia, movimiento con propósito, accesibilidad y excelentes defaults, no en copiar una estética.

Un botón no debería requerir decenas de propiedades antes de ser usable, responsivo y accesible.

### 04 — Un lenguaje para todo el producto

El mismo modelo fuente debería poder describir:

- web interfaces;
- mobile interfaces;
- APIs and server behavior;
- domain models;
- workflows;
- agents;
- data pipelines;
- infrastructure intent.

### 05 — Ciencia de datos sin una pared entre ecosistemas

Python sigue siendo uno de los ecosistemas más fuertes para cómputo científico y machine learning. Evermore pretende interoperar con él, no reemplazarlo.

~~~evermore
dataset Housing from "housing.csv"

predict price from
  area
  bedrooms
  neighborhood

using python sklearn

validate with time split
show error distribution
~~~

Los usuarios avanzados deben poder cruzar directamente hacia Python cuando lo necesiten.

### 06 — Infraestructura como intención de producto

Desplegar no debería exigir aprender cinco lenguajes de configuración antes de poder operar responsablemente una aplicación.

~~~evermore
production

  server
    replicas 3
    health "/health"
    autoscale to 20

  database postgres
    encrypted
    backup daily

  cache redis
~~~

Evermore podrá reducir intención de infraestructura a Docker, Kubernetes y configuración específica de cloud manteniendo inspeccionables los artefactos generados.

### 07 — Interoperabilidad antes que aislamiento

Un lenguaje nuevo no debería desechar el mundo de software que ya existe.

Las fronteras de interoperabilidad planeadas incluyen:

- TypeScript / JavaScript
- Python
- Swift / SwiftUI
- Kotlin
- Java / JVM
- Dart / Flutter
- Rust and WebAssembly where appropriate

### 08 — Seguridad por construcción

La información sensible debe representarse semánticamente.

~~~evermore
data User
  email email
  password secret
~~~

Un valor tipado como **secret** no debería poder imprimirse, serializarse o devolverse por una API de manera casual. El compilador y el runtime deben participar en prevenir flujos inseguros, no depender únicamente de la disciplina del desarrollador.

---

# IA como primitiva del lenguaje

Muchas aplicaciones de IA representan hoy comportamiento importante como strings más llamadas a SDKs.

La dirección de investigación de Evermore es distinta.

Un agente puede modelarse como una computación tipada:

~~~text
Agent<I, O, T, C, B>
~~~

donde:

- **I** = input type
- **O** = output type
- **T** = available tools
- **C** = capability / permission set
- **B** = resource budget

Un presupuesto puede incluir tokens, latencia, costo monetario o tiempo de ejecución.

Esto permite que compilador, runtime y tooling razonen sobre comportamiento de IA antes de ejecutar.

### Salida estructurada y tipada

~~~evermore
structure RiskAssessment
  score percent
  reasons list of text
  confidence percent

agent RiskAnalyst
  accepts Transaction
  returns RiskAssessment
~~~

El contrato de salida es un tipo, no una sugerencia escondida en un prompt.

### Aprobación humana

~~~evermore
agent Support

  can
    read tickets
    draft responses

  requires approval to
    issue refund
    send response
~~~

La supervisión humana se vuelve parte del programa.

### Contexto y tokenización

~~~evermore
context CustomerContext

  include
    current conversation
    customer profile
    last 5 orders

  budget 12000 tokens
  prioritize recent conversation
  summarize overflow
~~~

La construcción de contexto debe ser explícita, inspeccionable y testeable.

---

# Fundamento formal

La accesibilidad no debe obtenerse sacrificando rigor semántico.

La investigación de tipos y efectos de Evermore se organiza alrededor de juicios de la forma:

~~~text
Γ ; C ⊢ e : τ ! ε
~~~

Interpretación:

- **Γ** — typing environment
- **C** — capabilities available to the computation
- **e** — expression
- **τ** — resulting type
- **ε** — observable effect set

Una transformación pura podría tener:

~~~text
ε = ∅
~~~

mientras otra computación podría tener:

~~~text
ε = { network, ai, database.write }
~~~

Esto permite que el tooling responda preguntas como:

- Can this function access the network?
- Can this agent transmit sensitive information?
- Can this workflow mutate production data?
- Can this mobile capability run offline?
- Is this function deterministic?
- Which actions require human approval?

## Dirección del flujo de información

Evermore también explora un retículo de seguridad:

~~~text
public ⊑ internal ⊑ sensitive ⊑ secret
~~~

Los datos no deberían fluir implícitamente de un nivel fuerte de confidencialidad a uno más débil.

## Modelo de recursos de IA

La ejecución de IA introduce otra superficie de optimización. Un planificador futuro podría minimizar un objetivo como:

~~~text
J = λ₁·latency + λ₂·cost + λ₃·token_usage + λ₄·energy
~~~

subject to semantic, quality and security constraints.

El propósito no es decoración matemática: ofrece un marco para volver explícitas y medibles las decisiones de enrutamiento de modelos, construcción de contexto y despliegue.

---

# Arquitectura del compilador

Evermore se diseña alrededor de un núcleo semántico estable, no de una traducción directa de código fuente a framework.

~~~text
.ever source
    ↓
lexer
    ↓
parser
    ↓
AST
    ↓
desugaring
    ↓
name resolution
    ↓
type + effect + capability analysis
    ↓
HIR
    ↓
Evermore IR
    ↓
optimization / planning
    ↓
target backends
~~~

### Por qué importa un IR

Without an intermediate representation:

~~~text
Evermore → React Native
~~~

Evermore becomes a syntax wrapper around React Native.

With a stable IR:

~~~text
                 ┌→ Vue + Vite
Evermore → IR ───┼→ React Native
                 ├→ Flutter
                 ├→ Swift / SwiftUI
                 ├→ Kotlin
                 ├→ Node.js
                 ├→ Python / JVM interop
                 └→ infrastructure planners
~~~

El lenguaje puede sobrevivir a cambios de frameworks.

---

# Arquitectura de targets

| Domain | Primary direction | Native / alternate direction |
|---|---|---|
| Web | TypeScript + Vue 3 + Vite | future additional web backend |
| Mobile | React Native + TypeScript | Flutter + Dart |
| iOS | React Native common layer | Swift + SwiftUI extensions |
| Android | React Native common layer | Kotlin extensions |
| Server | Node.js + TypeScript | future native/WASM runtimes |
| Data science | Python interoperability | native numerical work where justified |
| JVM | Java interoperability | future JVM backend |
| Infrastructure | Docker + Kubernetes planning | cloud adapters |
| AI | provider-neutral agent runtime | local / hosted model adapters |

---

# Extensiones nativas

Evermore debe ofrecer escape hatches en lugar de atrapar a desarrolladores avanzados dentro de sus abstracciones.

~~~evermore
capability health

  ios uses HealthKit with Swift
  android uses HealthConnect with Kotlin
~~~

La aplicación puede depender de la capability en lugar de duplicar intención por plataforma.

El mismo principio aplica a modelos de Python, librerías Java y futuros runtimes nativos.

---

# Sistema de diseño

La UI de Evermore debe optimizar coherencia antes que personalización.

Los objetivos de diseño incluyen:

- semantic typography;
- spacing based on a consistent scale;
- accessible contrast;
- platform-appropriate touch targets;
- keyboard and assistive-technology support;
- dark mode;
- motion with reduced-motion behavior;
- responsive layout;
- native platform conventions where they improve usability.

~~~evermore
design
  quiet
  spacious
  precise

motion
  subtle
  purposeful

accessibility
  strict
~~~

El styling avanzado seguirá siendo posible, pero belleza y usabilidad deben ser el default, no una recompensa por configurar todo manualmente.

---

# Implementación actual

Evermore está en etapa **compiler-foundation / pre-alpha**.

El primer milestone ejecutable se concentra deliberadamente en un vertical slice pequeño:

~~~text
Evermore source
   ↓
lexer
   ↓
parser
   ↓
AST
   ↓
semantic checks
   ↓
Vue-oriented prototype backend
~~~

El repositorio no afirmará soporte de frameworks, IA o infraestructura hasta que exista una implementación ejecutable.

Consulta [docs/ROADMAP.md](docs/ROADMAP.md) para las definiciones de milestones.

---

# Principios de ingeniería

**Effortless es una restricción de ingeniería, no un slogan.**

Evermore sigue estos principios:

1. **Zero-config first success.**
2. **Convention before configuration.**
3. **One semantic source of truth.**
4. **Progressive disclosure of complexity.**
5. **Human-readable diagnostics.**
6. **Secure defaults.**
7. **Beautiful defaults.**
8. **Native escape hatches.**
9. **AI assists; semantics decide.**
10. **Generated artifacts remain inspectable.**
11. **No benchmark claims without reproducible evidence.**
12. **No AI capability claims without executable tests.**

---

# Preguntas de investigación

Evermore también es un proyecto de investigación en lenguajes de programación.

Preguntas que vale la pena poner a prueba:

- Can natural-looking syntax remain deterministic and formally analyzable?
- Can effect and capability systems make AI agents safer without making the language intimidating?
- Can one semantic product model target multiple UI runtimes without collapsing to the lowest common denominator?
- Can infrastructure intent be compiled while keeping operational decisions understandable?
- Can AI context budgets become first-class resource constraints?
- Can secure information-flow defaults remain ergonomic for beginners?
- Can generated code remain debuggable enough for professional teams?
- How much framework-specific optimization can be preserved behind a portable IR?

Las respuestas deben venir de prototipos, benchmarks, estudios de usuarios y experimentos reproducibles, no de branding.

---

# Dirección del repositorio

~~~text
evermore/
├── src/                    # compiler foundation
├── tests/                  # executable language tests
├── examples/               # small programs
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FORMAL_MODEL.md
│   ├── LANGUAGE_DESIGN.md
│   └── ROADMAP.md
└── .github/workflows/      # continuous integration
~~~

Conforme crezca la implementación, las etapas del compilador y los backends se separarán en paquetes dedicados.

---

# Roadmap

### M0 — Foundation
Language principles, bilingual documentation, grammar experiments, lexer, parser, diagnostics and AST.

### M1 — First vertical slice
Screens, text, buttons, navigation and a minimal Vue/Vite target.

### M2 — Type system
Data declarations, functions, collections, optionals, generics, interfaces, classes and effect tracking.

### M3 — Full-stack semantics
Typed server actions, shared contracts, Node.js target and persistence abstractions.

### M4 — AI-native runtime
Typed agents, tools, structured outputs, budgets, context, approval boundaries and observable execution.

### M5 — Mobile
React Native target, native Swift/Kotlin capability extensions and Flutter backend experiments.

### M6 — Data
Python bridge, datasets, reproducible pipelines, numerical semantics and model evaluation primitives.

### M7 — Infrastructure
Docker packaging, deployment planning, Kubernetes generation, health, observability and secrets.

### M8 — Optimization and research
IR optimization, performance studies, security analysis, language-server tooling and broader backend research.

---

# Lo que Evermore no es

Evermore no pretende ser:

- English text sent to an LLM and executed blindly;
- a no-code system disguised as a language;
- a replacement for every existing ecosystem;
- a framework-specific DSL;
- an excuse to hide unsafe infrastructure decisions;
- a repository full of architecture diagrams with no executable compiler.

La ambición es alta. El estándar de implementación debe ser todavía mayor.

---

## Nombre

**Evermore** refleja el objetivo arquitectónico central:

> Las aplicaciones deberían sobrevivir a los frameworks de hoy.

El código fuente debe describir intención duradera de producto y sistema. Los targets pueden evolucionar por debajo.

---

## Estado

**Experimental · Pre-alpha · Diseño del lenguaje y fundamentos del compilador**

Todavía no uses Evermore para sistemas de producción.

El proyecto prioriza actualmente corrección, semántica, calidad de investigación y evidencia ejecutable por encima de cantidad de features.

---

<div align="center">

### Construye software como lo piensas.

**Fácil para comenzar. Poderoso para crecer. Diseñado para perdurar.**

</div>
