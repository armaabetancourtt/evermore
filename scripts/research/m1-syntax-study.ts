import fs from "node:fs";
import path from "node:path";

import { compile } from "../../src/compiler.js";
import { formatSource } from "../../src/formatter.js";

const examples = [
  "examples/natural.ever",
  "examples/counter.ever",
  "examples/layout.ever",
  "examples/components.ever",
  "examples/showcase.ever",
];

type Metrics = {
  readonly chars: number;
  readonly lines: number;
  readonly braces: number;
  readonly endKeywords: number;
};

function metrics(source: string): Metrics {
  return {
    chars: source.length,
    lines: source.trimEnd().split("\n").length,
    braces: (source.match(/[{}]/g) ?? []).length,
    endKeywords: (source.match(/\bend\b/g) ?? []).length,
  };
}

function artifactFingerprint(source: string): string {
  const result = compile(source);
  return JSON.stringify(
    [...result.files]
      .map((file) => [file.path, file.content] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

const rows = examples.map((relativePath) => {
  const original = fs.readFileSync(path.resolve(relativePath), "utf8");
  const natural = formatSource(original, "natural");
  const explicit = formatSource(original, "explicit");
  const naturalFingerprint = artifactFingerprint(natural);
  const explicitFingerprint = artifactFingerprint(explicit);

  return {
    example: relativePath,
    equivalent: naturalFingerprint === explicitFingerprint,
    natural: metrics(natural),
    explicit: metrics(explicit),
  };
});

if (rows.some((row) => !row.equivalent)) {
  console.error(JSON.stringify(rows, null, 2));
  throw new Error(
    "M1 syntax study found natural/explicit semantic divergence.",
  );
}

const totals = rows.reduce(
  (acc, row) => ({
    naturalChars: acc.naturalChars + row.natural.chars,
    explicitChars: acc.explicitChars + row.explicit.chars,
    naturalLines: acc.naturalLines + row.natural.lines,
    explicitLines: acc.explicitLines + row.explicit.lines,
    naturalBraces: acc.naturalBraces + row.natural.braces,
    explicitBraces: acc.explicitBraces + row.explicit.braces,
    naturalEnds: acc.naturalEnds + row.natural.endKeywords,
    explicitEnds: acc.explicitEnds + row.explicit.endKeywords,
  }),
  {
    naturalChars: 0,
    explicitChars: 0,
    naturalLines: 0,
    explicitLines: 0,
    naturalBraces: 0,
    explicitBraces: 0,
    naturalEnds: 0,
    explicitEnds: 0,
  },
);

console.log(
  JSON.stringify(
    {
      corpus: rows.length,
      semanticEquivalence: true,
      totals,
      rows,
      interpretation: {
        ambiguity:
          "Both canonical surfaces compile to identical generated artifacts for every corpus program.",
        readabilityProxy:
          "Character/line counts and explicit structural punctuation are reported as source-ergonomics proxies; they are not human-subject readability measurements.",
      },
    },
    null,
    2,
  ),
);
