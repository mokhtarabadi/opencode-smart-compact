/**
 * On-disk store for pruned tool-output originals.
 *
 * Session state used to carry the full text of every omission, so a session
 * with hundreds of pruned results rewrote megabytes on every save. Originals
 * now live in one file per omission under a per-session directory, and state
 * keeps only the id-to-path mapping. The store is bounded (file count plus
 * total bytes) and evicts oldest-first, so it cannot grow without limit; a
 * record whose file was evicted fails closed in `read_omitted_content` instead
 * of restoring a phantom.
 *
 * Everything here is best-effort and never throws into the prune pass: a write
 * failure returns to the caller as an exception it catches and logs, falling
 * back to keeping the original inline so nothing is lost.
 */
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OmissionRecord } from "./types.js";

/** Environment override, used by the test suite and for unusual installs. */
const DATA_DIR_ENV = "SMART_COMPACT_DATA_DIR";

/** Maximum omission files kept per session. */
export const DEFAULT_OMISSION_MAX_FILES = 500;

/** Maximum total bytes kept per session (about 8 MiB). */
export const DEFAULT_OMISSION_MAX_BYTES = 8 * 1024 * 1024;

/** Maximum characters a single `read_omitted_content` response may return. */
export const MAX_OMISSION_RESPONSE_CHARS = 20_000;

export interface OmissionStoreLimits {
  maxFiles: number;
  maxBytes: number;
}

export const DEFAULT_OMISSION_LIMITS: OmissionStoreLimits = {
  maxFiles: DEFAULT_OMISSION_MAX_FILES,
  maxBytes: DEFAULT_OMISSION_MAX_BYTES,
};

/** Root directory for plugin-owned data (not the project, not plugin storage). */
export function omissionDataDir(): string {
  const override = process.env[DATA_DIR_ENV];
  if (typeof override === "string" && override.trim() !== "") return override;
  const xdg = process.env.XDG_DATA_HOME;
  const base =
    typeof xdg === "string" && xdg.trim() !== ""
      ? xdg
      : join(homedir(), ".local", "share");
  return join(base, "opencode", "smart-compact");
}

/** Stable hash so two session ids that sanitize alike stay separated. */
function sessionHash(sessionID: string): string {
  return createHash("sha256").update(sessionID).digest("hex").slice(0, 16);
}

/** Per-session directory; the id is sanitized and hashed so it cannot escape. */
export function sessionOmissionDir(sessionID: string): string {
  const safe =
    sessionID.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64) || "session";
  return join(
    omissionDataDir(),
    "omissions",
    `${safe}-${sessionHash(sessionID)}`,
  );
}

/** Absolute path a Content ID's original occupies for one session. */
export function omissionFilePath(sessionID: string, id: string): string {
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(sessionOmissionDir(sessionID), `${safeId}.txt`);
}

/** Minimal file listing used by the cap; unreadable entries are skipped. */
function listStoreFiles(
  dir: string,
): Array<{ name: string; path: string; size: number; mtimeMs: number }> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // A missing directory means nothing is stored yet, which is not an error.
    return [];
  }
  const files: Array<{
    name: string;
    path: string;
    size: number;
    mtimeMs: number;
  }> = [];
  for (const name of names) {
    if (!name.endsWith(".txt")) continue;
    const path = join(dir, name);
    try {
      const stat = statSync(path);
      if (!stat.isFile()) continue;
      files.push({ name, path, size: stat.size, mtimeMs: stat.mtimeMs });
    } catch {
      // A file that vanished or is unreadable is already not consuming space
      // we can account for; skip it rather than failing the whole prune pass.
    }
  }
  return files;
}

/**
 * Enforce the per-session cap by evicting oldest-first. Best-effort: an
 * unlink failure is logged and the sweep continues, because a full disk must
 * not turn into a crash. The newly written file is the newest (the ids are
 * monotonic), so it is never the first eviction candidate.
 */
export function enforceOmissionStoreCap(
  dir: string,
  limits: OmissionStoreLimits = DEFAULT_OMISSION_LIMITS,
): void {
  const maxFiles = Number.isFinite(limits.maxFiles)
    ? Math.max(0, Math.floor(limits.maxFiles))
    : 0;
  const maxBytes = Number.isFinite(limits.maxBytes)
    ? Math.max(0, Math.floor(limits.maxBytes))
    : 0;
  const files = listStoreFiles(dir).sort((a, b) =>
    a.mtimeMs === b.mtimeMs
      ? a.name.localeCompare(b.name)
      : a.mtimeMs - b.mtimeMs,
  );
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let count = files.length;
  for (let index = 0; index < files.length; index += 1) {
    if (count <= maxFiles && totalBytes <= maxBytes) break;
    const file = files[index]!;
    // Keep the newest original even when it alone exceeds the byte cap: it was
    // just written, so deleting it would evict the only copy of the freshest
    // output while older, less relevant files survive. The next write's eviction
    // pass then removes it once something newer exists.
    if (index === files.length - 1) {
      console.warn(
        `[smart-compact] omission store over cap, keeping newest readable: ${file.path}`,
      );
      break;
    }
    try {
      unlinkSync(file.path);
      count -= 1;
      totalBytes -= file.size;
    } catch (error) {
      console.warn(
        `[smart-compact] could not evict omission file ${file.path}: ${(error as Error)?.message ?? error}`,
      );
    }
  }
}

/**
 * Write one original to its per-session file and return the absolute path.
 * The write is atomic (temp file plus rename), so a crash cannot leave a
 * half-written original that `read_omitted_content` would return as truth.
 * Throws only when the directory or file cannot be written; the caller keeps
 * the text inline in that case.
 */
export function writeOmissionOriginal(
  sessionID: string,
  id: string,
  content: string,
  limits: OmissionStoreLimits = DEFAULT_OMISSION_LIMITS,
): string {
  const dir = sessionOmissionDir(sessionID);
  mkdirSync(dir, { recursive: true });
  const path = omissionFilePath(sessionID, id);
  const temp = `${path}.tmp`;
  writeFileSync(temp, content, "utf8");
  renameSync(temp, path);
  enforceOmissionStoreCap(dir, limits);
  return path;
}

/**
 * Read the original behind an omission record. A missing file returns
 * undefined so the caller can print the fail-closed notice; a legacy inline
 * `content` (not yet migrated, or kept because the file write failed) is
 * returned as a last resort.
 */
export function readOmissionOriginal(
  record: Pick<OmissionRecord, "path" | "content"> | undefined,
): string | undefined {
  if (!record) return undefined;
  if (typeof record.path === "string" && record.path.length > 0) {
    try {
      return readFileSync(record.path, "utf8");
    } catch {
      // Evicted or moved: fail closed to the caller's missing-original notice.
      return typeof record.content === "string" ? record.content : undefined;
    }
  }
  return typeof record.content === "string" ? record.content : undefined;
}

/**
 * Move inline originals from an older state blob into files. Called once on
 * load; returns true when the state changed and should be persisted. A record
 * whose write fails keeps its inline text, so migration never loses content.
 */
export function migrateLegacyOmissions(
  sessionID: string,
  omissions: Record<string, OmissionRecord>,
): boolean {
  let changed = false;
  for (const [id, record] of Object.entries(omissions)) {
    if (!record || typeof record !== "object") continue;
    if (typeof record.content !== "string") continue;
    if (typeof record.path === "string" && record.path.length > 0) {
      // Already migrated but the old copy lingered: drop the duplicate.
      delete record.content;
      changed = true;
      continue;
    }
    try {
      record.path = writeOmissionOriginal(sessionID, id, record.content);
      delete record.content;
      changed = true;
    } catch (error) {
      console.warn(
        `[smart-compact] could not migrate omission ${id} to a file: ` +
          `${(error as Error)?.message ?? error}; keeping it inline for this session.`,
      );
    }
  }
  return changed;
}

/**
 * Bound a single retrieval. Replaying a megabyte original re-inflates exactly
 * the context pruning relieved, so the response is capped and says so plainly,
 * naming the Content ID and both sizes.
 */
export function boundOmissionResponse(
  id: string,
  text: string,
  maxChars: number = MAX_OMISSION_RESPONSE_CHARS,
): string {
  const limit =
    typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0
      ? Math.floor(maxChars)
      : MAX_OMISSION_RESPONSE_CHARS;
  if (text.length <= limit) return text;
  return (
    `${text.slice(0, limit)}\n\n` +
    `[smart-compact] TRUNCATED: showing the first ${limit} of ${text.length} characters. ` +
    `The full original remains cached under Content ID ${id}, but this tool always returns ` +
    `the same capped view — reproduce any missing portion with the source tool if it is essential.]`
  );
}
