import {
  compile,
  type CompileResult,
  type CompileTarget,
} from "./compiler.js";

export type IncrementalCompilerStats = {
  readonly hits: number;
  readonly misses: number;
  readonly entries: number;
};

export class IncrementalCompiler {
  private readonly cache = new Map<string, CompileResult>();
  private hits = 0;
  private misses = 0;

  compile(
    source: string,
    options: { readonly target?: CompileTarget } = {},
  ): CompileResult {
    const target = options.target ?? "vue";
    const key = target + "\u0000" + source;
    const cached = this.cache.get(key);

    if (cached) {
      this.hits += 1;
      return cached;
    }

    this.misses += 1;
    const result = compile(source, { target });
    this.cache.set(key, result);
    return result;
  }

  invalidate(): void {
    this.cache.clear();
  }

  stats(): IncrementalCompilerStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size,
    };
  }
}
