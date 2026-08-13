import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_url TEXT,
  storage_key TEXT,
  status TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  error TEXT,
  created_at TEXT NOT NULL
)`;

const optionalColumns = [
  ["source_url", "TEXT"],
  ["storage_key", "TEXT"],
  ["transcript", "TEXT"],
  ["summary", "TEXT"],
  ["error", "TEXT"],
] as const;

export async function materialsDb() {
  if (!env.DB) throw new Error("Database unavailable");
  await env.DB.prepare(createTable).run();
  const columns = await env.DB.prepare("PRAGMA table_info(materials)").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  for (const [name, type] of optionalColumns) {
    if (!existing.has(name)) await env.DB.prepare(`ALTER TABLE materials ADD COLUMN ${name} ${type}`).run();
  }
  return env.DB;
}
