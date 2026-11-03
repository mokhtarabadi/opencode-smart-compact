/**
 * Plugin version, resolved from the package manifest at load time.
 *
 * The plugin may run from the repository source (tests compile into
 * `.test-build/src`) or from an installed package, so both one and two levels
 * up are probed. A missing or malformed manifest renders "unknown": a stats
 * line must never throw because a file could not be read.
 */
import { existsSync, readFileSync } from "node:fs";

function readPackageVersion(): string {
  for (const relative of ["../package.json", "../../package.json"]) {
    const url = new URL(relative, import.meta.url);
    try {
      if (!existsSync(url)) continue;
      const parsed = JSON.parse(readFileSync(url, "utf8")) as { version?: unknown };
      if (typeof parsed.version === "string" && /^\d+\.\d+\.\d+/.test(parsed.version)) {
        return parsed.version;
      }
    } catch {
      // Try the next candidate; a broken manifest renders "unknown".
    }
  }
  return "unknown";
}

/** The version reported by `compact_stats` and `/magic-stats`. */
export const PLUGIN_VERSION = readPackageVersion();
