import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS lectures (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  audio_key TEXT
)`;

export async function lecturesDb() {
  if (!env.DB) throw new Error("Database binding is unavailable");
  await env.DB.prepare(createTable).run();
  const columns = await env.DB.prepare("PRAGMA table_info(lectures)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "audio_key")) {
    await env.DB.prepare("ALTER TABLE lectures ADD COLUMN audio_key TEXT").run();
  }
  return env.DB;
}
