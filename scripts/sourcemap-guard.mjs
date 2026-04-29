#!/usr/bin/env node
/**
 * sourcemap-guard.mjs
 *
 * CI safety check: ensures productionBrowserSourceMaps is NOT set to true
 * in next.config.ts/js. Exposing source maps in production leaks original
 * source code to any visitor and must be an explicit opt-in only.
 *
 * Usage:  node scripts/sourcemap-guard.mjs
 * Exit 0: safe (no browser source maps)
 * Exit 1: unsafe (browser source maps would be shipped to clients)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const CONFIG_FILES = ["next.config.ts", "next.config.mjs", "next.config.js"];
const root = process.cwd();

let configContent = null;
for (const name of CONFIG_FILES) {
  const p = resolve(root, name);
  if (existsSync(p)) {
    configContent = readFileSync(p, "utf-8");
    console.log(`Checking ${name} …`);
    break;
  }
}

if (!configContent) {
  console.error("No next.config file found.");
  process.exit(1);
}

// Detect patterns that would enable browser source maps
const UNSAFE_PATTERNS = [
  /productionBrowserSourceMaps\s*:\s*true/,
];

const violations = UNSAFE_PATTERNS.filter((re) => re.test(configContent));

if (violations.length > 0) {
  console.error(
    "❌  sourcemap-guard: productionBrowserSourceMaps is set to TRUE.\n" +
    "    This ships original source code to every browser visitor.\n" +
    "    Remove the option or set it to false before merging."
  );
  process.exit(1);
}

// Check .next/static for leaked .map files (only relevant in CI after build)
import { readdirSync } from "fs";
const staticDir = resolve(root, ".next", "static");
if (existsSync(staticDir)) {
  const maps = readdirSync(staticDir, { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".js.map"));
  if (maps.length > 0) {
    console.error(
      `❌  sourcemap-guard: Found ${maps.length} .js.map file(s) in .next/static/.\n` +
      "    These would be publicly downloadable. Disable productionBrowserSourceMaps."
    );
    process.exit(1);
  }
}

console.log("✅  sourcemap-guard: No browser source maps will be shipped.");
process.exit(0);
