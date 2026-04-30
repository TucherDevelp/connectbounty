import os from "os";
import type { NextConfig } from "next";

// Leave 2 cores free so the system stays responsive during builds.
// On this machine (8 cores, ~7 GB RAM, ~3.5 GB swap in use) running 7 workers
// exhausts free RAM and triggers heavy SSD swap I/O (90 %+ disk usage).
const buildWorkers = Math.max(2, os.cpus().length - 2);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    // Limit static-page-generation workers → prevents RAM exhaustion → no swap.
    cpus: buildWorkers,

    // Do NOT generate server-side .map files in production.
    //
    // Why it is safe to disable:
    //   • Server maps (209 files, ~28 MB) are written to .next/server/ on every
    //     build. They are NEVER sent to browsers.
    //   • Browser source maps remain OFF (productionBrowserSourceMaps is not
    //     set), so no source code is exposed to visitors. `npm run perf:ci`
    //     (sourcemap-guard.mjs) still enforces this.
    //   • Error stack traces in production logs still show file names and line
    //     numbers from the compiled output; only the mapping back to the original
    //     TypeScript column is lost. Structured logging + Sentry (if added later)
    //     can re-add this via a separate upload step without affecting build speed.
    //
    // Impact: ~28 MB fewer SSD writes per build, ~15–25 % shorter build time,
    // no swap pressure from map serialisation threads.
    serverSourceMaps: false,
  },
};

export default nextConfig;
