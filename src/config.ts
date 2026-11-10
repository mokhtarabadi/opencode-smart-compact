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
  /**
   * Explicit absolute emergency budget in tokens. `0` (the default) derives
   * the budget from the resolved context window instead, so the warning scales
   * with the model rather than firing forever on a large window.
   */
  emergencyBudgetTokens: number;
  /** Fraction of the resolved window used when the budget is derived. */
  emergencyBudgetRatio: number;
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
  /**
   * Fallback context window in tokens, and a HARD CAP when the model registry
   * reports a larger window (`min(registry, configured)`). Used exactly as the
   * denominator when the registry entry carries no usable `limit.context`.
   * `0` (the default) means "not configured": the registry stands alone, and
   * with no registry limit awareness stays silent rather than guessing.
   *
   * The cap exists because a ratio threshold is unreachable on a very large
   * window: on a 1M-token model, `warnRatio 0.5` needs ~500K visible tokens,
   * which pruning keeps out of reach, so the reminder and the auto-trim never
   * fire. Capping the denominator makes the ratio meaningful again.
   */
  contextWindowTokens: number;
  /**
   * Absolute measured-token count that raises the first reminder. `0` (the
   * default) disables the line. The fired level is the stronger of this and
   * `warnRatio`, because a ratio alone cannot express "this session is already
   * too big" when the window is a million tokens wide.
   */
  warnAtTokens: number;
  /**
   * Absolute measured-token count that raises the escalated reminder. `0`
   * disables the line. When both absolute lines are set, the emergency one must
   * not be smaller than the warn one.
   */
  emergencyAtTokens: number;
}

export interface SmartCompactConfig {
  enabled: boolean;
  pruning: PruningConfig;
  strategies: StrategiesConfig;
  tokens: TokensConfig;
  awareness: AwarenessConfig;
}

/** Default share of the resolved window used as the emergency budget. */
export const DEFAULT_EMERGENCY_BUDGET_RATIO = 0.6;

export const DEFAULT_CONFIG: SmartCompactConfig = {
  enabled: true,
  pruning: {
    maxChars: 1024,
    maxWords: 128,
    taskMaxChars: 4096,
    taskMaxWords: 512,
    protectedTools: ["question", "skill"],
    alwaysPruneTools: ["read"],
    discardTools: {
      todowrite: "Successfully updated todos.",
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
  tokens: {
    enabled: false,
    emergencyBudgetTokens: 0,
    emergencyBudgetRatio: DEFAULT_EMERGENCY_BUDGET_RATIO,
  },
  awareness: {
    enabled: true,
    warnRatio: 0.5,
    emergencyRatio: 0.8,
    rearmStep: 0.05,
    autoTrimRatio: 0.55,
    contextWindowTokens: 0,
    warnAtTokens: 0,
    emergencyAtTokens: 0,
  },
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
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/"))
        i += 1;
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
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1
  );
}

/** A re-arm step must be a finite number strictly inside (0, 0.5). */
function isValidRearmStep(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 0.5
  );
}

/** A derived-budget fraction must be finite and inside (0, 1]; 0 disables. */
function isValidBudgetRatio(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

/** A configured fallback window must be a positive whole number of tokens. */
function isValidWindowTokens(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** An absolute token threshold must be 0 (disabled) or a finite count. */
function isValidTokenThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Merge the awareness section. Every key is validated on its own, and each
 * threshold pair is checked together: an inverted warn/emergency pair would
 * make the escalation unreachable, so both members of an inverted pair fall
 * back to the base values together. The ratio pair and the absolute token pair
 * are independent — arming one never resets the other. Sibling keys survive a
 * partial update.
 */
function mergeAwareness(
  base: AwarenessConfig,
  patch: unknown,
): AwarenessConfig {
  const record = asRecord(patch);
  if (!record) return base;
  const enabled =
    typeof record.enabled === "boolean" ? record.enabled : base.enabled;
  const warnRatio = isValidRatio(record.warnRatio)
    ? record.warnRatio
    : base.warnRatio;
  const emergencyRatio = isValidRatio(record.emergencyRatio)
    ? record.emergencyRatio
    : base.emergencyRatio;
  const rearmStep = isValidRearmStep(record.rearmStep)
    ? record.rearmStep
    : base.rearmStep;
  // 0 is a valid value here: it means "never auto-trim", the shipped default.
  const autoTrimRatio =
    record.autoTrimRatio === 0
      ? 0
      : isValidRatio(record.autoTrimRatio)
        ? record.autoTrimRatio
        : base.autoTrimRatio;
  // 0 means "no configured denominator"; a positive integer is accepted. A
  // positive value is also a cap: see `resolveAwarenessWindow`.
  const contextWindowTokens =
    record.contextWindowTokens === 0
      ? 0
      : isValidWindowTokens(record.contextWindowTokens)
        ? record.contextWindowTokens
        : base.contextWindowTokens;
  // 0 is the shipped "line disabled" value, so it must survive the merge.
  const warnAtTokens = isValidTokenThreshold(record.warnAtTokens)
    ? record.warnAtTokens
    : base.warnAtTokens;
  const emergencyAtTokens = isValidTokenThreshold(record.emergencyAtTokens)
    ? record.emergencyAtTokens
    : base.emergencyAtTokens;
  // Ordering guards, one per pair. A pair is only inverted when both members
  // are armed; a warn line alone (emergency 0 = disabled) is valid.
  const ratiosOrdered = !(warnRatio >= emergencyRatio);
  const tokensOrdered = !(
    warnAtTokens > 0 &&
    emergencyAtTokens > 0 &&
    emergencyAtTokens < warnAtTokens
  );
  return {
    enabled,
    warnRatio: ratiosOrdered ? warnRatio : base.warnRatio,
    emergencyRatio: ratiosOrdered ? emergencyRatio : base.emergencyRatio,
    rearmStep,
    autoTrimRatio,
    contextWindowTokens,
    warnAtTokens: tokensOrdered ? warnAtTokens : base.warnAtTokens,
    emergencyAtTokens: tokensOrdered ? emergencyAtTokens : base.emergencyAtTokens,
  };
}

function mergeConfig(
  base: SmartCompactConfig,
  patch: unknown,
): SmartCompactConfig {
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
      maxChars:
        typeof pruning?.maxChars === "number"
          ? pruning.maxChars
          : base.pruning.maxChars,
      maxWords:
        typeof pruning?.maxWords === "number"
          ? pruning.maxWords
          : base.pruning.maxWords,
      taskMaxChars:
        typeof pruning?.taskMaxChars === "number"
          ? pruning.taskMaxChars
          : base.pruning.taskMaxChars,
      taskMaxWords:
        typeof pruning?.taskMaxWords === "number"
          ? pruning.taskMaxWords
          : base.pruning.taskMaxWords,
      protectedTools: Array.isArray(pruning?.protectedTools)
        ? (pruning.protectedTools as string[])
        : base.pruning.protectedTools,
      alwaysPruneTools: Array.isArray(pruning?.alwaysPruneTools)
        ? (pruning.alwaysPruneTools as string[])
        : base.pruning.alwaysPruneTools,
      discardTools: (() => {
        const baseTools = { ...base.pruning.discardTools };
        const entries = Object.entries(
          (asRecord(pruning?.discardTools) as
            | Record<string, string | null>
            | undefined) ?? {},
        );
        for (const [k, v] of entries) {
          if (v === null) delete baseTools[k];
          else if (typeof v === "string") baseTools[k] = v;
        }
        return baseTools;
      })(),
      preserveRecentTurns:
        typeof pruning?.preserveRecentTurns === "number"
          ? pruning.preserveRecentTurns
          : base.pruning.preserveRecentTurns,
      truncateToolsChars:
        typeof pruning?.truncateToolsChars === "number"
          ? pruning.truncateToolsChars
          : base.pruning.truncateToolsChars,
      useTokens:
        typeof pruning?.useTokens === "boolean"
          ? pruning.useTokens
          : base.pruning.useTokens,
    },
    strategies: {
      deduplication: {
        enabled:
          typeof dedup?.enabled === "boolean"
            ? dedup.enabled
            : base.strategies.deduplication.enabled,
        protectedTools: Array.isArray(dedup?.protectedTools)
          ? (dedup.protectedTools as string[])
          : base.strategies.deduplication.protectedTools,
      },
      purgeErrors: {
        enabled:
          typeof purge?.enabled === "boolean"
            ? purge.enabled
            : base.strategies.purgeErrors.enabled,
        turns:
          typeof purge?.turns === "number"
            ? purge.turns
            : base.strategies.purgeErrors.turns,
        protectedTools: Array.isArray(purge?.protectedTools)
          ? (purge.protectedTools as string[])
          : base.strategies.purgeErrors.protectedTools,
      },
      stripReasoning: {
        enabled:
          typeof strip?.enabled === "boolean"
            ? strip.enabled
            : base.strategies.stripReasoning.enabled,
        thresholdChars:
          typeof strip?.thresholdChars === "number"
            ? strip.thresholdChars
            : base.strategies.stripReasoning.thresholdChars,
      },
    },
    tokens: {
      enabled:
        typeof tokens?.enabled === "boolean"
          ? tokens.enabled
          : base.tokens.enabled,
      emergencyBudgetTokens:
        typeof tokens?.emergencyBudgetTokens === "number" &&
        Number.isFinite(tokens.emergencyBudgetTokens) &&
        tokens.emergencyBudgetTokens >= 0
          ? tokens.emergencyBudgetTokens
          : base.tokens.emergencyBudgetTokens,
      emergencyBudgetRatio: isValidBudgetRatio(tokens?.emergencyBudgetRatio)
        ? tokens.emergencyBudgetRatio
        : base.tokens.emergencyBudgetRatio,
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
  tokens: ["enabled", "emergencyBudgetTokens", "emergencyBudgetRatio"],
  awareness: [
    "enabled",
    "warnRatio",
    "emergencyRatio",
    "rearmStep",
    "autoTrimRatio",
    "contextWindowTokens",
    "warnAtTokens",
    "emergencyAtTokens",
  ],
};

/** Collect one warning per unknown key, naming its exact dotted path. */
function collectUnknown(
  record: Record<string, unknown>,
  section: string,
  out: string[],
): void {
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
  if (tokens) {
    collectUnknown(tokens, "tokens", warnings);
    warnings.push(...validateTokens(tokens));
  }
  const awareness = asRecord(root.awareness);
  if (awareness) {
    collectUnknown(awareness, "awareness", warnings);
    warnings.push(...validateAwareness(awareness));
  }
  return warnings;
}

/**
 * Range checks for the token section. An explicit budget may be 0 (derive)
 * or any non-negative number; the derived fraction must be inside (0, 1], or
 * 0 to disable the window-scaled warning.
 */
export function validateTokens(raw: unknown): string[] {
  const warnings: string[] = [];
  const record = asRecord(raw);
  if (!record) return warnings;
  const budget = record.emergencyBudgetTokens;
  if (
    budget !== undefined &&
    (typeof budget !== "number" || !Number.isFinite(budget) || budget < 0)
  ) {
    warnings.push(
      "Invalid config value: tokens.emergencyBudgetTokens must be 0 (derive from the window) or a positive token count",
    );
  }
  const ratio = record.emergencyBudgetRatio;
  if (ratio !== undefined && !isValidBudgetRatio(ratio)) {
    warnings.push(
      "Invalid config value: tokens.emergencyBudgetRatio must be 0 (disabled) or a number greater than 0 and at most 1",
    );
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
  if (
    autoTrimRatio !== undefined &&
    autoTrimRatio !== 0 &&
    !isValidRatio(autoTrimRatio)
  ) {
    warnings.push(
      "Invalid config value: awareness.autoTrimRatio must be 0 or a number greater than 0 and less than 1",
    );
  }
  const contextWindowTokens = record.contextWindowTokens;
  if (
    contextWindowTokens !== undefined &&
    contextWindowTokens !== 0 &&
    !isValidWindowTokens(contextWindowTokens)
  ) {
    warnings.push(
      "Invalid config value: awareness.contextWindowTokens must be 0 or a positive whole number of tokens",
    );
  }
  const warnAtTokens = record.warnAtTokens;
  const emergencyAtTokens = record.emergencyAtTokens;
  if (warnAtTokens !== undefined && !isValidTokenThreshold(warnAtTokens)) {
    warnings.push(
      "Invalid config value: awareness.warnAtTokens must be 0 (disabled) or a finite token count",
    );
  }
  if (emergencyAtTokens !== undefined && !isValidTokenThreshold(emergencyAtTokens)) {
    warnings.push(
      "Invalid config value: awareness.emergencyAtTokens must be 0 (disabled) or a finite token count",
    );
  }
  if (
    isValidTokenThreshold(warnAtTokens) &&
    isValidTokenThreshold(emergencyAtTokens) &&
    warnAtTokens > 0 &&
    emergencyAtTokens > 0 &&
    emergencyAtTokens < warnAtTokens
  ) {
    warnings.push(
      "Invalid config value: awareness.warnAtTokens must not exceed awareness.emergencyAtTokens when both are set",
    );
  }
  if (
    isValidRatio(warnRatio) &&
    isValidRatio(emergencyRatio) &&
    warnRatio >= emergencyRatio
  ) {
    warnings.push(
      "Invalid config value: awareness.warnRatio must be less than awareness.emergencyRatio",
    );
  }
  return warnings;
}

/**
 * The effective emergency budget in tokens.
 *
 * An explicit `tokens.emergencyBudgetTokens` (> 0) always wins, so an operator
 * can pin an exact number. Otherwise the budget is `emergencyBudgetRatio`
 * (default 60 percent) of the resolved context window. With no known window the
 * result is 0, which disables the warning: guessing a denominator is the same
 * mistake the awareness module already avoids, and an absolute default is what
 * made the old 50K warning fire forever on a 1M-token model.
 */
export function resolveEmergencyBudget(
  config: SmartCompactConfig,
  limitTokens?: number,
): number {
  const override = config?.tokens?.emergencyBudgetTokens;
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    override > 0
  ) {
    return Math.floor(override);
  }
  const ratio = config?.tokens?.emergencyBudgetRatio;
  const safeRatio = isValidBudgetRatio(ratio)
    ? ratio
    : DEFAULT_EMERGENCY_BUDGET_RATIO;
  // A zero fraction is the explicit opt-out for the derived warning.
  if (safeRatio <= 0) return 0;
  if (
    typeof limitTokens !== "number" ||
    !Number.isFinite(limitTokens) ||
    limitTokens <= 0
  ) {
    return 0;
  }
  return Math.floor(limitTokens * safeRatio);
}

/**
 * Human-readable provenance for the effective budget, so a warning says where
 * the number came from instead of repeating an opaque threshold.
 */
export function emergencyBudgetDescription(
  config: SmartCompactConfig,
  limitTokens?: number,
): string {
  const override = config?.tokens?.emergencyBudgetTokens;
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    override > 0
  ) {
    return "configured via tokens.emergencyBudgetTokens";
  }
  if (
    typeof limitTokens === "number" &&
    Number.isFinite(limitTokens) &&
    limitTokens > 0
  ) {
    const ratio = config?.tokens?.emergencyBudgetRatio;
    const safeRatio = isValidBudgetRatio(ratio)
      ? ratio
      : DEFAULT_EMERGENCY_BUDGET_RATIO;
    return `${Math.round(safeRatio * 100)}% of the ${Math.floor(limitTokens)}-token window`;
  }
  return "derived budget disabled (no context window known)";
}

/**
 * Whether the measured token cost is over the effective emergency budget.
 *
 * This is a WARNING signal, never a gate: an over-budget history is exactly the
 * history that needs compaction, so refusing to compact it deadlocks the
 * session. Callers warn (and may notify) and then continue the work they were
 * asked to do. A budget of 0 (explicit, or because no window is known)
 * disables the warning.
 */
export function isOverEmergencyBudget(
  measuredTokens: number,
  config: SmartCompactConfig,
  limitTokens?: number,
): boolean {
  const budget = resolveEmergencyBudget(config, limitTokens);
  if (budget <= 0) return false;
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
export function getBudgetState(
  usedTokens: number,
  limitTokens: number,
): BudgetState {
  // Guard non-finite or non-positive limits first — no budget means no pressure.
  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens))
    usedTokens = 0;
  if (
    typeof limitTokens !== "number" ||
    !Number.isFinite(limitTokens) ||
    limitTokens <= 0
  ) {
    // No measurable limit: report empty usage, never warn.
    return {
      usedTokens: Math.max(0, usedTokens),
      limitTokens,
      ratio: 0,
      level: "normal",
    };
  }
  // Clamp negative usage to zero, overuse to ratio 1.
  const safeUsed = Math.max(0, usedTokens);
  const raw = safeUsed / limitTokens;
  // Clamp ratio into display range.
  const ratio = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  // Fixed thresholds: emergency wins over warn.
  const level: BudgetLevel =
    ratio >= BUDGET_EMERGENCY_RATIO
      ? "emergency"
      : ratio >= BUDGET_WARN_RATIO
        ? "warn"
        : "normal";
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
    for (const warning of validateConfig(global))
      console.warn(`[smart-compact] ${warning} (global config)`);
    config = mergeConfig(config, global);
  }
  const directory = (ctx.location as { directory?: string }).directory;
  if (directory) {
    const project = await readConfigFile(
      join(directory, ".opencode", "smart-compact.jsonc"),
    );
    if (project) {
      for (const warning of validateConfig(project))
        console.warn(`[smart-compact] ${warning} (project config)`);
      config = mergeConfig(config, project);
    }
  }
  return config;
}
