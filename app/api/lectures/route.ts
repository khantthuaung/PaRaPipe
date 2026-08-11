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

async function ready() {
  if (!env.DB) throw new Error("Database binding is unavailable");
  await env.DB.prepare(createTable).run();
  return env.DB;
}

export async function GET() {
  try {
    const db = await ready();
    const result = await db.prepare("SELECT id, subject, title, transcript, summary, created_at AS createdAt, duration, audio_key AS audioKey FROM lectures ORDER BY created_at DESC LIMIT 100").all();
    return Response.json(result.results ?? []);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const lecture = await request.json() as Record<string, unknown>;
    const required = ["id", "subject", "title", "transcript", "summary", "createdAt"];
    if (required.some((key) => typeof lecture[key] !== "string")) return Response.json({ error: "Invalid lecture" }, { status: 400 });
    const db = await ready();
    await db.prepare("INSERT OR REPLACE INTO lectures (id, subject, title, transcript, summary, created_at, duration, audio_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(lecture.id, lecture.subject, lecture.title, lecture.transcript, lecture.summary, lecture.createdAt, Number(lecture.duration) || 0, lecture.audioKey ?? null).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to save lecture" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Lecture required" }, { status: 400 });
    const db = await ready();
    await db.prepare("DELETE FROM lectures WHERE id = ?").bind(id).run();
    if (env.RECORDINGS) await env.RECORDINGS.delete(`lectures/${id}`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to delete lecture" }, { status: 500 });
  }
}
