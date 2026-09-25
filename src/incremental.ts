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

export type IncrementalCompilerOptions = {
  /** Maximum number of cached results. Defaults to 64. */
  readonly maxEntries?: number;
};

/**
 * Bounded LRU cache. Failed compilations are never cached.
 * Cache hits update recency so repeatedly used sources stay resident.
 */
export class IncrementalCompiler {
  private readonly cache = new Map<string, CompileResult>();
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(options: IncrementalCompilerOptions = {}) {
    const maxEntries = options.maxEntries ?? 64;
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive safe integer.");
    }
    this.maxEntries = maxEntries;
  }

  compile(
    source: string,
    options: { readonly target?: CompileTarget } = {},
  ): CompileResult {
    const target = options.target ?? "vue";
    const key = target + "\u0000" + source;
    const cached = this.cache.get(key);

    if (cached) {
      this.hits += 1;
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    this.misses += 1;
    const result = compile(source, { target });
    this.cache.set(key, result);
    if (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
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
