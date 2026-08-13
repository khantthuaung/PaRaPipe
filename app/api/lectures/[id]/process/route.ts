import { env } from "cloudflare:workers";
import { lecturesDb } from "../../../../../lib/lectures-db";

type LectureRow = {
  id: string;
  title: string;
  audio_key: string | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!env.ML_SERVICE_URL) return Response.json({ error: "Automatic transcription is not configured yet." }, { status: 503 });

  try {
    const db = await lecturesDb();
    const row = await db.prepare("SELECT id, title, audio_key FROM lectures WHERE id = ?").bind(id).first<LectureRow>();
    if (!row) return Response.json({ error: "Lecture not found" }, { status: 404 });
    if (!row.audio_key) return Response.json({ error: "This lecture has no saved recording." }, { status: 400 });

    const object = await env.RECORDINGS.get(row.audio_key);
    if (!object) return Response.json({ error: "The saved recording could not be found." }, { status: 404 });

    const contentType = object.httpMetadata?.contentType ?? "audio/webm";
    const extension = contentType.includes("mp4") ? "m4a" : contentType.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    form.set("kind", "audio");
    form.set("name", `${row.title}.${extension}`);
    form.set("file", new File([await object.arrayBuffer()], `${row.title}.${extension}`, { type: contentType }));

    const response = await fetch(`${env.ML_SERVICE_URL.replace(/\/$/, "")}/process`, {
      method: "POST",
      headers: env.ML_SERVICE_TOKEN ? { authorization: `Bearer ${env.ML_SERVICE_TOKEN}` } : {},
      body: form,
    });
    const result = await response.json() as { transcript?: string; summary?: string; error?: string; detail?: string };
    if (!response.ok) throw new Error(result.error || result.detail || "Transcription failed");

    const transcript = result.transcript?.trim() ?? "";
    const summary = result.summary?.trim() ?? "";
    await db.prepare("UPDATE lectures SET transcript = ?, summary = ? WHERE id = ?").bind(transcript, summary, id).run();
    return Response.json({ transcript, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
