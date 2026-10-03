/**
 * Publish gate for opencode-smart-compact. Verifies the package metadata shape
 * and the exact `npm pack` payload before a release. Exits non-zero on any
 * failure so `prepublishOnly` blocks a broken publish.
 *
 * Run: node scripts/verify-package.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

// 1. Required repository files.
for (const file of ["src/index.ts", "src/plan.ts", "README.md", "LICENSE", "CHANGELOG.md"]) {
  check(existsSync(file), `missing required file: ${file}`);
}

// 2. package.json shape.
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
check(typeof pkg.name === "string" && pkg.name.length > 0, "package.json: name is required");
check(/^\d+\.\d+\.\d+/.test(pkg.version ?? ""), "package.json: version must be semver");
check(pkg.license === "MIT", "package.json: license must be MIT");
check(pkg.exports?.["."]?.import === "./src/index.ts", "package.json: '.' export must point at ./src/index.ts");
check(Array.isArray(pkg.files) && pkg.files.includes("src"), "package.json: files must include src");
check(typeof pkg.peerDependencies?.["@opencode/plugin"] === "string", "package.json: @opencode/plugin peerDependency required");
check(typeof pkg.scripts?.["prepublishOnly"] === "string", "package.json: prepublishOnly script required");

// 3. npm pack payload.
let packed;
try {
  const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
  packed = JSON.parse(raw);
} catch (error) {
  errors.push(`npm pack --dry-run failed: ${error.message}`);
}

if (packed?.[0]?.files) {
  const files = packed[0].files.map((entry) => entry.path);
  const has = (path) => files.includes(path);
  check(has("package.json"), "pack payload missing package.json");
  check(has("README.md"), "pack payload missing README.md");
  check(has("LICENSE"), "pack payload missing LICENSE");
  check(files.some((f) => f === "src/index.ts"), "pack payload missing src/index.ts");
  for (const bad of ["tests/", ".test-build/", "node_modules/", "tsconfig.test.json"]) {
    check(!files.some((f) => f.startsWith(bad)), `pack payload must not include ${bad}`);
  }
}

if (errors.length) {
  console.error("verify-package: FAILED");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`verify-package: OK (${packed?.[0]?.files?.length ?? 0} files)`);
