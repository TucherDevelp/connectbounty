import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, ".next", "app-build-manifest.json");

async function statSize(filePath) {
  try {
    const s = await fs.stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

async function main() {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const pages = manifest.pages ?? {};
  const fileSet = new Set();

  for (const files of Object.values(pages)) {
    for (const f of files) {
      if (typeof f === "string" && f.endsWith(".js")) fileSet.add(f);
    }
  }

  let totalBytes = 0;
  let largestChunk = { file: "", bytes: 0 };

  for (const rel of fileSet) {
    const abs = path.join(root, ".next", rel);
    const size = await statSize(abs);
    totalBytes += size;
    if (size > largestChunk.bytes) largestChunk = { file: rel, bytes: size };
  }

  const routeMap = Object.entries(pages).map(([route, assets]) => ({
    route,
    assetCount: Array.isArray(assets) ? assets.length : 0,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    routes: routeMap,
    totalJsBytes: totalBytes,
    totalJsKb: Number((totalBytes / 1024).toFixed(2)),
    largestChunkFile: largestChunk.file,
    largestChunkKb: Number((largestChunk.bytes / 1024).toFixed(2)),
  };

  const outPath = path.join(root, "perf", "baseline-report.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  process.stdout.write(`Baseline report written to ${outPath}\n`);
}

main().catch((err) => {
  console.error("perf-baseline failed:", err.message);
  process.exit(1);
});
