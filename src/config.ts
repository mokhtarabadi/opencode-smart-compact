/**
 * Configuration for smart-compact. Project config (`.opencode/smart-compact.jsonc`)
 * overrides the global config (`~/.config/opencode/smart-compact.jsonc`), which
 * overrides the built-in defaults. Invalid or missing files fall back silently.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Ctx } from "./store.js";

export interface PruningConfig {
  maxChars: number;
  maxWords: number;
  taskMaxChars: number;
  taskMaxWords: number;
  protectedTools: string[];
  alwaysPruneTools: string[];
  discardTools: Record<string, string>;
  /** Recent turns that are never pruned, on top of the last user message. */
  preserveRecentTurns: number;
  /** Tool result texts longer than this are truncated with a cached record. */
  truncateToolsChars: number;
  /** Route prune measurements through the tokenizer module when true. */
  useTokens: boolean;
}

export interface StrategiesConfig {
  deduplication: { enabled: boolean; protectedTools: string[] };
  purgeErrors: { enabled: boolean; turns: number; protectedTools: string[] };
  /** Drop reasoning parts over the threshold while keeping error text. */
  stripReasoning: { enabled: boolean; thresholdChars: number };
}

export interface TokensConfig {
  /** Enable measured counting; false keeps the dependency-free fallback. */
  enabled: boolean;
  /** Abort a compaction run above this measured cost. 0 disables the guard. */
  emergencyBudgetTokens: number;
}

export interface SmartCompactConfig {
  enabled: boolean;
  pruning: PruningConfig;
  strategies: StrategiesConfig;
  tokens: TokensConfig;
}

export const DEFAULT_CONFIG: SmartCompactConfig = {
  enabled: true,
  pruning: {
    maxChars: 1024,
    maxWords: 128,
    taskMaxChars: 4096,
    taskMaxWords: 512,
    protectedTools: ["question"],
    alwaysPruneTools: ["read"],
    discardTools: {
      todowrite: "Successfully updated todos.",
      skill: "Skill contents omitted after compaction; recall the skill if needed.",
    },
    preserveRecentTurns: 2,
    truncateToolsChars: 1024,
    useTokens: false,
  },
  strategies: {
    deduplication: { enabled: true, protectedTools: ["question"] },
    purgeErrors: { enabled: true, turns: 4, protectedTools: ["question"] },
    stripReasoning: { enabled: true, thresholdChars: 500 },
  },
  tokens: { enabled: false, emergencyBudgetTokens: 50000 },
};

/** Strip JSONC comments and trailing commas. Best-effort; never throws. */
function stripJsonc(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConfig {
  const p = asRecord(patch);
  if (!p) return base;
  const pruning = asRecord(p.pruning);
  const strategies = asRecord(p.strategies);
  const tokens = asRecord(p.tokens);
  const dedup = asRecord(strategies?.deduplication);
  const purge = asRecord(strategies?.purgeErrors);
  const strip = asRecord(strategies?.stripReasoning);
  return {
    enabled: typeof p.enabled === "boolean" ? p.enabled : base.enabled,
    pruning: {
      maxChars: typeof pruning?.maxChars === "number" ? pruning.maxChars : base.pruning.maxChars,
      maxWords: typeof pruning?.maxWords === "number" ? pruning.maxWords : base.pruning.maxWords,
      taskMaxChars: typeof pruning?.taskMaxChars === "number" ? pruning.taskMaxChars : base.pruning.taskMaxChars,
      taskMaxWords: typeof pruning?.taskMaxWords === "number" ? pruning.taskMaxWords : base.pruning.taskMaxWords,
      protectedTools: Array.isArray(pruning?.protectedTools)
        ? (pruning.protectedTools as string[])
        : base.pruning.protectedTools,
      alwaysPruneTools: Array.isArray(pruning?.alwaysPruneTools)
        ? (pruning.alwaysPruneTools as string[])
        : base.pruning.alwaysPruneTools,
      discardTools: { ...base.pruning.discardTools, ...(asRecord(pruning?.discardTools) as Record<string, string> | undefined) },
      preserveRecentTurns:
        typeof pruning?.preserveRecentTurns === "number"
          ? pruning.preserveRecentTurns
          : base.pruning.preserveRecentTurns,
      truncateToolsChars:
        typeof pruning?.truncateToolsChars === "number"
          ? pruning.truncateToolsChars
          : base.pruning.truncateToolsChars,
      useTokens: typeof pruning?.useTokens === "boolean" ? pruning.useTokens : base.pruning.useTokens,
    },
    strategies: {
      deduplication: {
        enabled: typeof dedup?.enabled === "boolean" ? dedup.enabled : base.strategies.deduplication.enabled,
        protectedTools: Array.isArray(dedup?.protectedTools)
          ? (dedup.protectedTools as string[])
          : base.strategies.deduplication.protectedTools,
      },
      purgeErrors: {
        enabled: typeof purge?.enabled === "boolean" ? purge.enabled : base.strategies.purgeErrors.enabled,
        turns: typeof purge?.turns === "number" ? purge.turns : base.strategies.purgeErrors.turns,
        protectedTools: Array.isArray(purge?.protectedTools)
          ? (purge.protectedTools as string[])
          : base.strategies.purgeErrors.protectedTools,
      },
      stripReasoning: {
        enabled: typeof strip?.enabled === "boolean" ? strip.enabled : base.strategies.stripReasoning.enabled,
        thresholdChars:
          typeof strip?.thresholdChars === "number" ? strip.thresholdChars : base.strategies.stripReasoning.thresholdChars,
      },
    },
    tokens: {
      enabled: typeof tokens?.enabled === "boolean" ? tokens.enabled : base.tokens.enabled,
      emergencyBudgetTokens:
        typeof tokens?.emergencyBudgetTokens === "number"
          ? tokens.emergencyBudgetTokens
          : base.tokens.emergencyBudgetTokens,
    },
  };
}

/** Every known config key by section, used to warn on typos. */
const KNOWN_KEYS: Record<string, readonly string[]> = {
  "": ["enabled", "pruning", "strategies", "tokens"],
  pruning: [
    "maxChars",
    "maxWords",
    "taskMaxChars",
    "taskMaxWords",
    "protectedTools",
    "alwaysPruneTools",
    "discardTools",
    "preserveRecentTurns",
    "truncateToolsChars",
    "useTokens",
  ],
  strategies: ["deduplication", "purgeErrors", "stripReasoning"],
  "strategies.deduplication": ["enabled", "protectedTools"],
  "strategies.purgeErrors": ["enabled", "turns", "protectedTools"],
  "strategies.stripReasoning": ["enabled", "thresholdChars"],
  tokens: ["enabled", "emergencyBudgetTokens"],
};

/** Collect one warning per unknown key, naming its exact dotted path. */
function collectUnknown(record: Record<string, unknown>, section: string, out: string[]): void {
  for (const key of Object.keys(record)) {
    const known = KNOWN_KEYS[section] ?? [];
    if (!known.includes(key)) {
      out.push(`Unknown config key: ${section ? `${section}.` : ""}${key}`);
    }
  }
}

/**
 * Validate a raw config object and return a warning per unknown key, each
 * naming its exact dotted path (e.g. `pruning.nope`). Returns an empty
 * array for valid or non-object input — callers surface warnings visibly
 * instead of silently ignoring typos.
 */
export function validateConfig(raw: unknown): string[] {
  const warnings: string[] = [];
  const root = asRecord(raw);
  if (!root) return warnings;
  collectUnknown(root, "", warnings);
  const pruning = asRecord(root.pruning);
  if (pruning) collectUnknown(pruning, "pruning", warnings);
  const strategies = asRecord(root.strategies);
  if (strategies) {
    collectUnknown(strategies, "strategies", warnings);
    for (const child of ["deduplication", "purgeErrors", "stripReasoning"]) {
      const section = asRecord(strategies[child]);
      if (section) collectUnknown(section, `strategies.${child}`, warnings);
    }
  }
  const tokens = asRecord(root.tokens);
  if (tokens) collectUnknown(tokens, "tokens", warnings);
  return warnings;
}

/**
 * Whether a compaction run must abort: true when the measured token cost
 * exceeds the configured emergency budget. A budget of 0 disables the
 * guard explicitly, and state is left unchanged on abort.
 */
export function checkBudgetGuard(measuredTokens: number, config: SmartCompactConfig): boolean {
  const budget = config.tokens.emergencyBudgetTokens;
  if (typeof budget !== "number" || budget <= 0) return false;
  return measuredTokens > budget;
}

async function readConfigFile(path: string): Promise<unknown | undefined> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(stripJsonc(text));
  } catch {
    return undefined;
  }
}

/** The global config path, honoring XDG_CONFIG_HOME. */
export function globalConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "opencode", "smart-compact.jsonc");
}

/** Load the effective config: defaults ← global ← project. */
export async function loadConfig(ctx: Ctx): Promise<SmartCompactConfig> {
  let config = DEFAULT_CONFIG;
  const global = await readConfigFile(globalConfigPath());
  if (global) {
    for (const warning of validateConfig(global)) console.warn(`[smart-compact] ${warning} (global config)`);
    config = mergeConfig(config, global);
  }
  const directory = (ctx.location as { directory?: string }).directory;
  if (directory) {
    const project = await readConfigFile(join(directory, ".opencode", "smart-compact.jsonc"));
    if (project) {
      for (const warning of validateConfig(project)) console.warn(`[smart-compact] ${warning} (project config)`);
      config = mergeConfig(config, project);
    }
  }
  return config;
}
