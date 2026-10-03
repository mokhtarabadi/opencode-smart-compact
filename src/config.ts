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
}

export interface StrategiesConfig {
  deduplication: { enabled: boolean; protectedTools: string[] };
  purgeErrors: { enabled: boolean; turns: number; protectedTools: string[] };
}

export interface SmartCompactConfig {
  enabled: boolean;
  pruning: PruningConfig;
  strategies: StrategiesConfig;
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
  },
  strategies: {
    deduplication: { enabled: true, protectedTools: ["question"] },
    purgeErrors: { enabled: true, turns: 4, protectedTools: ["question"] },
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
  const dedup = asRecord(strategies?.deduplication);
  const purge = asRecord(strategies?.purgeErrors);
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
    },
  };
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
  if (global) config = mergeConfig(config, global);
  const directory = (ctx.location as { directory?: string }).directory;
  if (directory) {
    const project = await readConfigFile(join(directory, ".opencode", "smart-compact.jsonc"));
    if (project) config = mergeConfig(config, project);
  }
  return config;
}
