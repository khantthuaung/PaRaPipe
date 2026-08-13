import { env } from "cloudflare:workers";
import { lecturesDb } from "../../../lib/lectures-db";

export async function GET() {
  try {
    const db = await lecturesDb();
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
    const db = await lecturesDb();
    await db.prepare("INSERT OR REPLACE INTO lectures (id, subject, title, transcript, summary, created_at, duration, audio_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(lecture.id, lecture.subject, lecture.title, lecture.transcript, lecture.summary, lecture.createdAt, Number(lecture.duration) || 0, lecture.audioKey ?? null).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save lecture", error);
    return Response.json({ error: "Unable to save lecture" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Lecture required" }, { status: 400 });
    const db = await lecturesDb();
    await db.prepare("DELETE FROM lectures WHERE id = ?").bind(id).run();
    if (env.RECORDINGS) await env.RECORDINGS.delete(`lectures/${id}`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to delete lecture" }, { status: 500 });
  }
}
