# Evermore: real-provider adapter and evaluations (experimental)

The `ai` compiler target now emits a real OpenAI-compatible provider in addition to its deterministic runtime. Tool calls pass through the existing capability allowlist, typed input/output validation and human-approval gate. The adapter validates provider usage and checks token budgets before requests and after responses; optional monetary checks require **explicit current prices**. Cost estimates cannot guarantee actual billed spend. No retry is attempted after side-effecting tool calls.

## Reproduce without secrets

```bash
npm install
npm test
npm run evermore -- build examples/ai-native.ever --target ai --out /tmp/evermore-ai
cd /tmp/evermore-ai
npm install
npm test
```

## Opt-in live run (incurs provider charges)

```bash
export OPENAI_API_KEY=... # provide privately, never commit
export EVERMORE_MODEL=your-json-and-tools-capable-model-id
export EVERMORE_INPUT_USD_PER_MILLION=your-current-input-price
export EVERMORE_OUTPUT_USD_PER_MILLION=your-current-output-price
npm run test:live
```

This runner produces per-case errors, exact-match comparison to the declared reference fixture, token usage, estimated cost and latency, plus aggregate exact-match rate and p95 latency. It does **not** assert that string equality is factuality, grounding, or retrieval quality. The example evaluation is deliberately small. No live result is claimed until the command is executed with genuine credentials.

### Remaining limitations

Context overflow now requires an explicit `summarize(source, value, maxTokens)` callback and verifies the summary against the remaining budget; absent or oversized summaries fail closed. This callback must itself enforce privacy and handle untrusted content. The adapter's system prompt marks external/tool text untrusted, but genuine protection requires least-privilege tools, network isolation and adversarial end-to-end testing. The tool must itself enforce authorization. Provider responses can exceed estimates; the adapter stops subsequent calls when a budget is exceeded, but cannot undo an already-billed request. Add an independently labeled benchmark, retrieval references, advanced prompt-injection tests and a deployed application before calling the system production-ready.
