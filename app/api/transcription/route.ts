import { transcriptionRequest } from "../../../lib/transcription";

export async function GET() {
  try {
    const health = await transcriptionRequest("/health");
    return Response.json({ ready: Boolean(health.ready), model: "small", localOnly: true });
  } catch (error) {
    return Response.json({ ready: false, model: "small", localOnly: true, error: error instanceof Error ? error.message : "Transcription unavailable" });
  }
}
