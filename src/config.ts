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

/**
 * Context-pressure awareness: when the model-visible context crosses a
 * fraction of the model's context window, the agent is told how full the
 * window is and what to do about it. Advisory only - the plugin never
 * compacts on its own and never aborts a step.
 */
export interface AwarenessConfig {
  /** Master switch for the context-pressure reminder. */
  enabled: boolean;
  /** Fill ratio of the context window that raises the first reminder. */
  warnRatio: number;
  /** Fill ratio that raises the escalated reminder. */
  emergencyRatio: number;
  /** How much the fill must grow before the reminder re-arms. */
  rearmStep: number;
  /**
   * Fill ratio that schedules a lossless tool-output trim for the next request.
   * 0 disables it. Trimming never summarizes a turn, so the only thing it can
   * cost is a cache round-trip through `read_omitted_content`.
   */
  autoTrimRatio: number;
}

export interface SmartCompactConfig {
  enabled: boolean;
  pruning: PruningConfig;
  strategies: StrategiesConfig;
  tokens: TokensConfig;
  awareness: AwarenessConfig;
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
  awareness: { enabled: true, warnRatio: 0.7, emergencyRatio: 0.9, rearmStep: 0.05, autoTrimRatio: 0 },
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

/** A fill ratio must be a finite number strictly inside (0, 1). */
function isValidRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1;
}

/** A re-arm step must be a finite number strictly inside (0, 0.5). */
function isValidRearmStep(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 0.5;
}

/**
 * Merge the awareness section. Every key is validated on its own, and the
 * pair is checked together: an inverted warn/emergency pair would make the
 * escalation unreachable, so both fall back to the base values together.
 * Sibling keys survive a partial update.
 */
function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig {
  const record = asRecord(patch);
  if (!record) return base;
  const enabled = typeof record.enabled === "boolean" ? record.enabled : base.enabled;
  const warnRatio = isValidRatio(record.warnRatio) ? record.warnRatio : base.warnRatio;
  const emergencyRatio = isValidRatio(record.emergencyRatio)
    ? record.emergencyRatio
    : base.emergencyRatio;
  const rearmStep = isValidRearmStep(record.rearmStep) ? record.rearmStep : base.rearmStep;
  // 0 is a valid value here: it means "never auto-trim", the shipped default.
  const autoTrimRatio =
    record.autoTrimRatio === 0
      ? 0
      : isValidRatio(record.autoTrimRatio)
        ? record.autoTrimRatio
        : base.autoTrimRatio;
  // Ordering guard: the warn threshold must stay below the emergency one.
  if (warnRatio >= emergencyRatio) {
    return {
      enabled,
      warnRatio: base.warnRatio,
      emergencyRatio: base.emergencyRatio,
      rearmStep,
      autoTrimRatio,
    };
  }
  return { enabled, warnRatio, emergencyRatio, rearmStep, autoTrimRatio };
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
    awareness: mergeAwareness(base.awareness, p.awareness),
  };
}

/** Every known config key by section, used to warn on typos. */
const KNOWN_KEYS: Record<string, readonly string[]> = {
  "": ["enabled", "pruning", "strategies", "tokens", "awareness"],
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
  awareness: ["enabled", "warnRatio", "emergencyRatio", "rearmStep", "autoTrimRatio"],
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
  const awareness = asRecord(root.awareness);
  if (awareness) {
    collectUnknown(awareness, "awareness", warnings);
    warnings.push(...validateAwareness(awareness));
  }
  return warnings;
}

/**
 * Range checks for the awareness section. Returns one warning per invalid
 * value, naming the exact key path. The merge layer drops invalid values
 * back to the defaults, so a bad threshold can never break the hook.
 */
export function validateAwareness(raw: unknown): string[] {
  const warnings: string[] = [];
  const record = asRecord(raw);
  if (!record) return warnings;
  const warnRatio = record.warnRatio;
  const emergencyRatio = record.emergencyRatio;
  const rearmStep = record.rearmStep;
  if (warnRatio !== undefined && !isValidRatio(warnRatio)) {
    warnings.push(
      "Invalid config value: awareness.warnRatio must be a number greater than 0 and less than 1",
    );
  }
  if (emergencyRatio !== undefined && !isValidRatio(emergencyRatio)) {
    warnings.push(
      "Invalid config value: awareness.emergencyRatio must be a number greater than 0 and less than 1",
    );
  }
  if (rearmStep !== undefined && !isValidRearmStep(rearmStep)) {
    warnings.push(
      "Invalid config value: awareness.rearmStep must be a number greater than 0 and less than 0.5",
    );
  }
  const autoTrimRatio = record.autoTrimRatio;
  if (autoTrimRatio !== undefined && autoTrimRatio !== 0 && !isValidRatio(autoTrimRatio)) {
    warnings.push(
      "Invalid config value: awareness.autoTrimRatio must be 0 or a number greater than 0 and less than 1",
    );
  }
  if (isValidRatio(warnRatio) && isValidRatio(emergencyRatio) && warnRatio >= emergencyRatio) {
    warnings.push(
      "Invalid config value: awareness.warnRatio must be less than awareness.emergencyRatio",
    );
  }
  return warnings;
}

/**
 * Whether the measured token cost is over the configured emergency budget.
 *
 * This is a WARNING signal, never a gate: an over-budget history is exactly the
 * history that needs compaction, so refusing to compact it deadlocks the
 * session. Callers warn (and may notify) and then continue the work they were
 * asked to do. A budget of 0 disables the warning explicitly.
 */
export function isOverEmergencyBudget(measuredTokens: number, config: SmartCompactConfig): boolean {
  const budget = config.tokens.emergencyBudgetTokens;
  if (typeof budget !== "number" || budget <= 0) return false;
  return measuredTokens > budget;
}

/**
 * Budget level for the hybrid meter UI (O1 D1).
 * normal below warn ratio, warn at 70 percent, emergency at 90 percent.
 * Display only — never changes prune behavior by itself.
 */
export type BudgetLevel = "normal" | "warn" | "emergency";

/** Visible budget state: used plus limit plus clamped ratio plus level. */
export interface BudgetState {
  usedTokens: number;
  limitTokens: number;
  ratio: number;
  level: BudgetLevel;
}

/** Warn display threshold: 70 percent of budget. */
export const BUDGET_WARN_RATIO = 0.7;

/** Emergency display threshold: 90 percent of budget. */
export const BUDGET_EMERGENCY_RATIO = 0.9;

/**
 * Fixed prune weights for O1 D2 (stable, testable order).
 * Tool results prune first, old summaries second, large omissions third.
 * User turns and active decisions are never in this table — they never prune.
 */
export const PRUNE_WEIGHTS = {
  "tool-result": 100,
  summary: 50,
  omission: 10,
} as const;

/**
 * Pure budget state reader for the meter UI.
 * Returns ratio clamped 0 to 1 and level by fixed thresholds.
 * Safe divide: non-positive limit yields ratio 0 and normal level.
 */
export function getBudgetState(usedTokens: number, limitTokens: number): BudgetState {
  // Guard non-finite or non-positive limits first — no budget means no pressure.
  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens)) usedTokens = 0;
  if (typeof limitTokens !== "number" || !Number.isFinite(limitTokens) || limitTokens <= 0) {
    // No measurable limit: report empty usage, never warn.
    return { usedTokens: Math.max(0, usedTokens), limitTokens, ratio: 0, level: "normal" };
  }
  // Clamp negative usage to zero, overuse to ratio 1.
  const safeUsed = Math.max(0, usedTokens);
  const raw = safeUsed / limitTokens;
  // Clamp ratio into display range.
  const ratio = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  // Fixed thresholds: emergency wins over warn.
  const level: BudgetLevel =
    ratio >= BUDGET_EMERGENCY_RATIO ? "emergency" : ratio >= BUDGET_WARN_RATIO ? "warn" : "normal";
  return { usedTokens: safeUsed, limitTokens, ratio, level };
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
