import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows } = await client.query("select filename from public._migrations");
    const applied = new Set(rows.map(r => r.filename));

    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    
    for (const f of files) {
      if (!applied.has(f)) {
        console.log(`Applying ${f}...`);
        const sql = readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
        await client.query("begin");
        try {
          await client.query(sql);
          await client.query("insert into public._migrations (filename, checksum) values ($1, $2)", [f, "bypassed"]);
          await client.query("commit");
          console.log(`Successfully applied ${f}`);
        } catch (e) {
          await client.query("rollback");
          console.error(`Failed to apply ${f}: ${e.message}`);
        }
      }
    }
  } finally {
    await client.end();
  }
}
main().catch(console.error);
