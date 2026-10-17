import { env } from "cloudflare:workers";
import { lecturesDb } from "../../../../../lib/lectures-db";
import { submitRecording, transcriptionRequest, type TranscriptJob } from "../../../../../lib/transcription";

type LectureRow = { audio_key: string|null; transcript: string };
type Context = { params: Promise<{id:string}> };
async function persist(db: D1Database, id: string, job: TranscriptJob) {
  if (job.status === "complete") {
    if (typeof job.transcript !== "string") throw new Error("The completed transcript is missing.");
    // Only update the raw transcript. Never replace the student's typed notes.
    await db.prepare("UPDATE lectures SET transcript = ? WHERE id = ?").bind(job.transcript, id).run();
  }
  return Response.json(job, { status: ["queued", "running"].includes(job.status) ? 202 : 200 });
}
export async function POST(_request: Request, {params}: Context) {
  try {
    const {id} = await params;
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return Response.json({error:"Invalid lecture"},{status:400});
    const db = await lecturesDb();
    const lecture = await db.prepare("SELECT audio_key, transcript FROM lectures WHERE id = ?").bind(id).first<LectureRow>();
    if (!lecture) return Response.json({error:"Save this lecture before transcribing it."},{status:404});
    if (lecture.transcript) return Response.json({status:"complete",transcript:lecture.transcript,model:"small"});
    if (!lecture.audio_key) return Response.json({error:"This lecture has no saved recording."},{status:400});
    const object = await env.RECORDINGS?.get(lecture.audio_key);
    if (!object) return Response.json({error:"The saved recording is missing. Your local copy may still be available."},{status:404});
    return await persist(db,id,await submitRecording(id,object));
  } catch (error) { return Response.json({error:error instanceof Error?error.message:"Unable to start transcription"},{status:503}); }
}
export async function GET(_request: Request, {params}: Context) {
  try {
    const {id} = await params;
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return Response.json({error:"Invalid lecture"},{status:400});
    const db = await lecturesDb();
    const lecture = await db.prepare("SELECT audio_key, transcript FROM lectures WHERE id = ?").bind(id).first<LectureRow>();
    if (!lecture) return Response.json({error:"Lecture not found"},{status:404});
    if (lecture.transcript) return Response.json({status:"complete",transcript:lecture.transcript,model:"small"});
    return await persist(db,id,await transcriptionRequest(`/jobs/${encodeURIComponent(id)}`));
  } catch (error) { return Response.json({error:error instanceof Error?error.message:"Unable to check transcription"},{status:503}); }
}
