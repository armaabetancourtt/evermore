# EVERMORE

### Humano primero. IA nativa. Diseñado para sobrevivir a los frameworks.

[English](README.md) · [Español](README.es.md)

![Status](https://img.shields.io/badge/status-pre--alpha-111111)
![Compiler](https://img.shields.io/badge/compiler-TypeScript-111111?logo=typescript&logoColor=white)
![Language](https://img.shields.io/badge/language-Evermore-111111)
[![CI](https://github.com/armaabetancourtt/evermore/actions/workflows/ci.yml/badge.svg)](https://github.com/armaabetancourtt/evermore/actions/workflows/ci.yml)

> **Evermore es un lenguaje de programación experimental y una plataforma para construir productos, inteligencia e infraestructura reduciendo radicalmente la complejidad accidental.**

Evermore parte de una pregunta:

> **¿Y si construir software serio se sintiera más parecido a describir el producto que a operar toda la maquinaria que existe debajo?**

El lenguaje se inspira en la claridad de **Swift**, la mentalidad multiplataforma de **Flutter** y la accesibilidad de **Python**; pero nace para una época donde un producto real cruza web, móvil, servidores, datos, IA, código nativo e infraestructura cloud.

Evermore está en **pre-alpha**. El proyecto separa deliberadamente lo que ya funciona de lo que todavía es dirección de investigación. La ambición puede ser enorme; las afirmaciones deben estar respaldadas por código, tests o experimentos reproducibles.

---

# La tesis

La ingeniería de software moderna tiene una capacidad extraordinaria, pero también una cantidad enorme de complejidad que no pertenece al problema que el usuario quería resolver.

Para construir un solo producto hoy puedes terminar usando:

~~~text
TypeScript
Vue / React
React Native / Flutter
Swift
Kotlin
Node.js
Python
SQL
Docker
Kubernetes
CI/CD
Cloud
AI SDKs
Vector databases
YAML
Bash
~~~

Cada herramienta puede ser excelente por separado.

La pregunta de Evermore es si el desarrollador realmente debería cargar con **todas esas fronteras mentales antes de poder expresar el producto**.

La meta no es esconder la ingeniería esencial.

La meta es eliminar la ingeniería accidental.

~~~text
Intención humana
      ↓
Código Evermore
      ↓
Lexer + Parser
      ↓
AST
      ↓
Análisis semántico
      ↓
Evermore IR
      ↓
┌──────────┬─────────────┬──────────┬──────────┬──────────────┐
│ Web      │ Mobile      │ Server   │ Data/AI  │ Infra        │
│ Vue/Vite │ RN/Flutter  │ Node.js  │ Python   │ Docker / K8s │
│ TS       │ Swift/Kotlin│ TS       │ JVM      │ Cloud        │
└──────────┴─────────────┴──────────┴──────────┴──────────────┘
~~~

Los frameworks son **targets**.

No son el lenguaje.

Si dentro de cinco años existe algo mejor que React Native, Vue o incluso Node, Evermore debería poder adquirir un backend nuevo sin obligar al producto a reescribirse desde cero.

---

# Software en términos humanos

La sintaxis objetivo debe poder leerse antes de poder impresionarte.

~~~evermore
app "Atlas"

data Note
  title text
  body text
  owner User private

screen Home

  title "Tus ideas"

  show notes

  button "Nueva nota"
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

Ese ejemplo representa una **dirección de diseño**, no una promesa de que toda esa sintaxis ya compile hoy.

Evermore debe comenzar simple.

Pero no debe quedarse limitado.

---

# Poder progresivo

No quiero que Evermore sea un lenguaje para principiantes del que tengas que escapar cuando aprendes más.

Quiero que crezca contigo.

### Modo natural

~~~evermore
button "Continuar"
  opens Dashboard
~~~

### Modo explícito

~~~evermore
component ContinueButton {
  on tap {
    navigate Dashboard
  }
}
~~~

Ambas formas deben terminar en la misma representación semántica.

La indentación ayuda a leer.

**La indentación no debería decidir qué significa el programa.**

---

# Ocho pilares

## 01 — Humano primero

La primera abstracción es la intención del desarrollador, no la API de un framework.

Lo frecuente debe ser evidente.

Lo avanzado debe seguir siendo posible.

---

## 02 — IA nativa

La IA no debería entrar a Evermore como otro SDK pegado al final.

Evermore investiga convertir en conceptos reales del lenguaje:

- agentes;
- herramientas;
- modelos;
- contexto;
- presupuestos de tokens;
- memoria;
- salidas estructuradas;
- evaluaciones;
- aprobación humana;
- permisos;
- observabilidad.

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

El proveedor del modelo es configuración.

La semántica del agente pertenece a Evermore.

---

## 03 — Diseño obsesivo

Evermore debe tener excelentes defaults de producto.

No significa copiar visualmente a Apple.

Significa aprender de principios como:

- claridad;
- jerarquía;
- consistencia;
- accesibilidad;
- movimiento con propósito;
- atención al detalle;
- reducción de ruido;
- progressive disclosure;
- interfaces que no requieren configuración excesiva para ser correctas.

~~~evermore
button "Continuar"
~~~

debería producir un control usable, accesible, responsivo y coherente sin exigir veinte propiedades.

El desarrollador avanzado podrá personalizarlo.

Pero la calidad no debería empezar desde cero.

---

## 04 — Un lenguaje para el producto completo

El mismo modelo semántico debería poder describir:

- interfaces web;
- interfaces móviles;
- modelos de dominio;
- APIs;
- servidores;
- workflows;
- agentes;
- pipelines de datos;
- intención de infraestructura.

Modelas un concepto una vez.

Los targets lo entienden desde una fuente de verdad.

---

## 05 — Ciencia de datos sin abandonar el ecosistema

Python es demasiado importante para fingir que Evermore debe reemplazarlo.

Evermore pretende integrarse con Python.

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

Y cuando necesites todo el poder del ecosistema:

~~~evermore
use python from "./risk_model.py"
~~~

Evermore reduce fricción.

No levanta paredes.

---

## 06 — Infraestructura como intención

Levantar una aplicación responsable no debería requerir dominar primero Dockerfiles, YAML, Kubernetes, ingress, probes, secrets, CI y cloud networking.

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

La dirección de Evermore es convertir eso en planes inspeccionables de infraestructura.

No ocultar Kubernetes.

**Evitar que Kubernetes sea un prerrequisito para comenzar.**

---

## 07 — Interoperabilidad

Evermore no debe intentar borrar décadas de software.

Debe poder conversar con ellas.

Direcciones planeadas:

- TypeScript / JavaScript;
- Python;
- Swift / SwiftUI;
- Kotlin;
- Java / JVM;
- Dart / Flutter;
- Rust;
- WebAssembly.

Ejemplo conceptual:

~~~evermore
capability Health

  ios uses HealthKit with Swift
  android uses HealthConnect with Kotlin
~~~

El producto depende de una capability.

Cada plataforma implementa su parte nativa.

---

## 08 — Seguridad por construcción

La seguridad no debería existir solamente en documentación.

Evermore investiga llevarla al sistema semántico.

~~~evermore
data User
  email email
  password secret
~~~

Un valor Secret no debería fluir casualmente a:

- logs;
- analytics;
- UI pública;
- respuestas de API;
- modelos externos de IA.

Si escribes:

~~~evermore
log user.password
~~~

el compilador debería ser capaz de detenerte y explicar por qué.

---

# IA como primitiva del lenguaje

Hoy muchas aplicaciones de IA terminan siendo:

~~~text
prompt string
+ SDK call
+ JSON parsing
+ retries
+ tool loop
+ logging
+ context assembly
~~~

Evermore investiga otra representación.

Un agente puede modelarse abstractamente como:

~~~text
Agent<I, O, T, C, B>
~~~

donde:

- **I** = tipo de entrada;
- **O** = tipo de salida;
- **T** = herramientas;
- **C** = capabilities / permisos;
- **B** = presupuesto de recursos.

Esto permite que el compilador y el runtime razonen sobre un agente antes de ejecutarlo.

## Salidas tipadas

~~~evermore
structure RiskAssessment
  score percent
  reasons list of text
  confidence percent

agent RiskAnalyst
  accepts Transaction
  returns RiskAssessment
~~~

La salida deja de ser “por favor responde JSON”.

Es un contrato.

## Aprobación humana

~~~evermore
agent Support

  can
    read tickets
    draft responses

  requires approval to
    issue refund
    send response
~~~

La supervisión humana forma parte del programa.

## Contexto y tokens

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

El contexto se vuelve explícito, medible y testeable.

---

# Fundamento formal

Ser fácil de usar no significa ser informal.

Evermore explora un modelo de tipos, efectos y capabilities basado en juicios de la forma:

~~~text
Γ ; C ⊢ e : τ ! ε
~~~

donde:

- **Γ** es el entorno de tipos;
- **C** son las capabilities disponibles;
- **e** es una expresión;
- **τ** es el tipo resultante;
- **ε** es el conjunto de efectos observables.

Una operación pura:

~~~text
ε = ∅
~~~

Una operación de backend podría tener:

~~~text
ε = {
  network,
  database.read,
  database.write
}
~~~

Un agente:

~~~text
ε = {
  ai.infer,
  network
}
~~~

Esto abre la puerta a tooling capaz de responder:

- ¿esta función puede tocar la red?
- ¿este agente puede enviar datos privados?
- ¿este workflow modifica producción?
- ¿esta operación funciona offline?
- ¿esta función es determinista?
- ¿qué acciones requieren aprobación?

---

# Flujo de información

Evermore investiga un retículo de confidencialidad:

~~~text
public ⊑ internal ⊑ sensitive ⊑ secret
~~~

Por defecto, los datos no deberían poder bajar silenciosamente desde un nivel más confidencial hacia uno menos confidencial.

Esto puede ayudar a prevenir errores antes de producción.

---

# Matemáticas para IA y optimización

La IA introduce costos que los lenguajes tradicionales no suelen modelar directamente.

Para un plan de ejecución p podemos considerar:

~~~text
J(p) =
  λ₁ · latency(p)
+ λ₂ · cost(p)
+ λ₃ · token_usage(p)
+ λ₄ · energy(p)
~~~

sujeto a restricciones de:

- seguridad;
- capabilities;
- calidad;
- presupuesto;
- contexto;
- disponibilidad de modelos.

No existe un único óptimo universal.

Las prioridades pertenecen al producto.

## Selección de contexto

Si cada fragmento de contexto tiene costo de tokens tᵢ y utilidad uᵢ, una aproximación simple puede escribirse como:

~~~text
maximizar   Σ uᵢ zᵢ

sujeto a   Σ tᵢ zᵢ ≤ B

            zᵢ ∈ {0,1}
~~~

En un sistema real también aparecen privacidad, dependencias semánticas, frescura, orden y compresión.

La idea importante es que **la tokenización y el contexto se conviertan en recursos del programa**, no en strings accidentales.

Más detalle: [docs/FORMAL_MODEL.md](docs/FORMAL_MODEL.md).

---

# Arquitectura del compilador

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

Evermore no debería traducir directamente:

~~~text
Evermore → React Native
~~~

porque entonces sería una sintaxis bonita encima de un framework.

El objetivo es:

~~~text
                 ┌→ Vue + Vite
                 ├→ React Native
Evermore → IR ───┼→ Flutter
                 ├→ Swift / SwiftUI
                 ├→ Kotlin
                 ├→ Node.js
                 ├→ Python / JVM
                 └→ Infrastructure
~~~

Más detalle: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

# Targets

| Dominio | Dirección principal | Extensión / alternativa |
|---|---|---|
| Web | TypeScript + Vue 3 + Vite | futuros backends web |
| Mobile | React Native + TypeScript | Flutter + Dart |
| iOS | capa común RN | Swift + SwiftUI |
| Android | capa común RN | Kotlin |
| Server | Node.js + TypeScript | futuros runtimes nativos/WASM |
| Data Science | interoperabilidad Python | cómputo nativo donde tenga sentido |
| JVM | interoperabilidad Java | futuro backend JVM |
| Infraestructura | Docker + Kubernetes | adaptadores cloud |
| IA | runtime provider-neutral | modelos hosted o locales |

---

# POO, estructuras y fundamentos clásicos

Ser futurista no significa abandonar fundamentos.

Evermore pretende incluir:

~~~text
functions
classes
interfaces
composition
encapsulation
generics
pattern matching
optionals
errors
modules
async/concurrency

List<T>
Set<T>
Map<K,V>
Queue<T>
Stack<T>
Tree<T>
Graph<N,E>
~~~

Ejemplo conceptual:

~~~evermore
interface Repository<T>
  function find id -> T?
  function save value T

class UserService
  private users Repository<User>

  function create input CreateUser -> User
~~~

La composición debe sentirse natural.

La herencia no tiene que ser la única forma de reutilización.

---

# Extensiones nativas

Evermore debe tener escape hatches.

No quiero que un desarrollador avanzado quede atrapado dentro de la abstracción.

~~~evermore
use python from "./model.py"

capability Health
  ios uses HealthKit with Swift
  android uses HealthConnect with Kotlin
~~~

Código generado y bridges deben seguir siendo inspeccionables.

---

# Sistema de diseño

El sistema de UI debería optimizar coherencia antes que configuración.

Objetivos:

- tipografía semántica;
- escala de espaciado consistente;
- contraste accesible;
- touch targets correctos;
- soporte de teclado;
- tecnologías asistivas;
- dark mode;
- reduced motion;
- responsive layout;
- comportamiento nativo cuando la plataforma lo amerite.

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

---

# Lo que ya funciona

La roadmap de investigación actual de Evermore, **M0 a M9**, está implementada con evidencia ejecutable. También está completo el **bloque de cierre del core del lenguaje de M10**: el trabajo restante para una alpha usable se concentra en standard library, distribución remota de paquetes, CLI/DX y hardening. El proyecto sigue en pre-alpha: completar los milestones significa que existen y se prueban las semánticas, targets y prototipos planeados; no significa estabilidad de producción.

Implementado hoy:

- sintaxis natural y explícita con la misma semántica;
- parsing independiente de la indentación;
- formatter canónico en modo natural o explícito;
- títulos, texto y botones;
- navegación entre pantallas;
- estado entero reactivo con `state`, `show` e `increases`;
- stacks verticales y horizontales anidados;
- componentes reutilizables stateless con `component` y `use`;
- validación semántica de pantallas, estado, componentes y ciclos;
- recuperación de múltiples errores del parser;
- Evermore IR independiente del framework;
- generación completa de aplicaciones Vue 3 + Vite;
- defaults de accesibilidad: focus visible, reduced motion, tamaño táctil y anuncios live para estado;
- builds reales del target generado dentro de CI, incluyendo un showcase M1 de tres pantallas;
- declaraciones nominales `data` y `class` con construcción/acceso a miembros, parámetros genéricos, tipos aplicados como `Box<text>` y constraints por protocolo;
- funciones tipadas con parámetros, returns declarados, `let` local inferido, precedencia aritmética y llamadas tipadas;
- casos algebraicos `choice` con payload tipado, construcción validada y bindings exhaustivos de payload en `match`;
- control de flujo tipado con `while`, `for ... in`, `break` y `continue`, incluyendo validación de scope local del loop;
- lógica booleana con `and`, `or` y `not` unario tipados y precedencia explícita;
- boundaries explícitos de función para `async`, effects declarados y capabilities requeridas, con validación transitiva del call graph y sin inferencia ambiental de efectos;
- generación TypeScript estricta de modelos y funciones, validada con `vue-tsc`;
- semántica full-stack tipada con runtime de servidor Node.js generado;
- agentes y tools de IA provider-neutral con contexto, budgets, aprobación y evaluaciones deterministas;
- semántica móvil compartida con React Native, boundaries Swift/Kotlin y experimento Flutter;
- datasets, arrays, bridges de Python y pipelines científicos reproducibles;
- planeación Docker/Kubernetes inspeccionable con health/readiness, secretos externos, rollback y apply protegido;
- LSP/tooling conectado al compilador, generación de documentación, diseño de registry y prototipos de Playground/Studio;
- optimización conservadora de IR, compilación incremental instrumentada y experimento WebAssembly ejecutable para funciones numéricas puras.

Un ejemplo ejecutable completo ya puede escribirse así:

~~~evermore
app "Evermore Showcase"

component Navigation

  stack horizontal

    button "Home"
      opens Home

    button "Counter"
      opens Counter

  end

end

screen Home

  title "Build software like you think."

  text "Human-first syntax. Typed semantics. Framework-independent intent."

  use Navigation

screen Counter

  title "State without ceremony"

  state count starts 0

  stack horizontal

    show count

    button "Add"
      increases count

  end

  use Navigation
~~~

La cadena que CI valida realmente es:

~~~text
Evermore source
   ↓
lexer
   ↓
parser
   ↓
AST
   ↓
análisis semántico
   ↓
Evermore IR
   ↓
backend Vue/Vite
   ↓
npm install + build de producción
~~~

CI ya valida las superficies implementadas de web, server, IA, mobile, data, infraestructura, tooling y la investigación WebAssembly. Siguen siendo capacidades pre-alpha y no una afirmación de readiness para producción.

Consulta [examples/showcase.ever](examples/showcase.ever) y [docs/ROADMAP.md](docs/ROADMAP.md).

---

# CLI actual

Después de instalar dependencias:

~~~bash
npm install
~~~

Puedes validar:

~~~bash
npm run evermore -- check examples/showcase.ever
~~~

formatear:

~~~bash
npm run evermore -- format examples/showcase.ever
~~~

inspeccionar el AST:

~~~bash
npm run evermore -- ast examples/showcase.ever
~~~

y generar una aplicación Vue/Vite:

~~~bash
npm run evermore -- build examples/showcase.ever --out evermore-build
~~~

---

# Principios de ingeniería

**Effortless es una restricción de ingeniería, no un slogan.**

1. Zero-config para el primer éxito.
2. Convención antes que configuración.
3. Una fuente semántica de verdad.
4. Complejidad revelada progresivamente.
5. Errores escritos para humanos.
6. Seguridad por defecto.
7. Diseño de calidad por defecto.
8. Escape hatches nativos.
9. La IA ayuda; la semántica decide.
10. El código generado se puede inspeccionar.
11. No hay claims de performance sin benchmarks.
12. No hay claims de IA sin tests ejecutables.

---

# Preguntas de investigación

Evermore también es un proyecto de investigación en lenguajes.

Queremos poner a prueba preguntas como:

- ¿puede una sintaxis cercana al lenguaje humano seguir siendo determinista?
- ¿puede un sistema de efectos y capabilities volver más seguros a los agentes sin intimidar al principiante?
- ¿puede una representación semántica producir múltiples runtimes sin caer en el mínimo común denominador?
- ¿puede compilarse intención de infraestructura sin volver invisibles las decisiones operativas?
- ¿pueden los presupuestos de contexto y tokens ser recursos de primera clase?
- ¿pueden los defaults de seguridad seguir siendo ergonómicos?
- ¿puede el código generado seguir siendo depurable en equipos profesionales?
- ¿cuánta optimización específica por plataforma puede preservar un IR portable?

Las respuestas deben venir de prototipos, benchmarks, user studies y experimentos reproducibles.

No de marketing.

---

# Roadmap

~~~text
M0  Compiler Foundation
 ↓
M1  Human Syntax + Web
 ↓
M2  Core Typed Language
 ↓
M3  Full Stack
 ↓
M4  AI-native Runtime
 ↓
M5  Mobile
 ↓
M6  Data / Python
 ↓
M7  Infrastructure
 ↓
M8  Tooling / Ecosystem
 ↓
M9  Native compilation research
~~~

Roadmap completo: [docs/ROADMAP.md](docs/ROADMAP.md).

Diseño del lenguaje: [docs/LANGUAGE_DESIGN.md](docs/LANGUAGE_DESIGN.md).

Modelo formal: [docs/FORMAL_MODEL.md](docs/FORMAL_MODEL.md).

Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

# Lo que Evermore no es

Evermore no pretende ser:

- inglés libre enviado a un LLM y ejecutado ciegamente;
- no-code disfrazado de lenguaje;
- un reemplazo obligatorio para todos los ecosistemas existentes;
- un DSL atrapado en un solo framework;
- una excusa para esconder decisiones inseguras;
- un repositorio lleno de diagramas sin compilador ejecutable.

La visión es grande.

**El estándar de implementación tiene que ser todavía mayor.**

---

# Por qué Evermore

El nombre resume una decisión arquitectónica:

> **Las aplicaciones deberían sobrevivir a los frameworks de hoy.**

El código fuente debería representar intención duradera de producto y sistema.

Los targets pueden cambiar debajo.

---

## Estado

**Experimental · Pre-alpha · roadmap M0–M9 completa con evidencia ejecutable**

Todavía no uses Evermore para producción.

Hoy el proyecto prioriza:

- corrección;
- semántica;
- calidad de investigación;
- arquitectura durable;
- evidencia ejecutable;
- una experiencia de desarrollo excepcional.

---

<div align="center">

### Construye software como lo piensas.

**Fácil para comenzar. Poderoso para crecer. Diseñado para perdurar.**

</div>
