import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { generateMarkdownDocumentation } from "./language-service.js";

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath) {
  console.error("Usage: npm run docs -- <file.ever> [output.md]");
  process.exitCode = 1;
} else {
  const absolute = path.resolve(sourcePath);
  const source = await readFile(absolute, "utf8");
  const markdown = generateMarkdownDocumentation(source);

  if (outputPath) {
    await writeFile(path.resolve(outputPath), markdown, "utf8");
  } else {
    process.stdout.write(markdown);
  }
}
