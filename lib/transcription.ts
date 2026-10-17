import { env } from "cloudflare:workers";

export type TranscriptJob = { status: "not_started"|"queued"|"running"|"complete"|"failed"; model?: string; transcript?: string; error?: string };

export async function transcriptionRequest(path: string, init: RequestInit = {}) {
  if (!env.TRANSCRIPTION_SERVICE_URL || !env.TRANSCRIPTION_SERVICE_TOKEN) throw new Error("Local transcription is not configured. Run npm run transcription:setup.");
  const base = new URL(env.TRANSCRIPTION_SERVICE_URL);
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("This transcription setup supports only your local Mac.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${env.TRANSCRIPTION_SERVICE_TOKEN}`);
  let response: Response;
  try { response = await fetch(new URL(path, base), { ...init, headers, signal: AbortSignal.timeout(60000) }); }
  catch { throw new Error("Whisper Small is offline. Start it with npm run transcription:start. Your saved audio is unchanged."); }
  let result: TranscriptJob & { ready?: boolean };
  try { result = await response.json() as typeof result; }
  catch { throw new Error("The local transcription service returned an invalid response."); }
  if (!response.ok && !(response.status === 404 && result.status === "not_started")) throw new Error(result.error || "Local transcription failed");
  return result;
}

export async function submitRecording(id: string, object: R2ObjectBody) {
  if (object.size > 100 * 1024 * 1024) throw new Error("Automatic transcription supports recordings up to 100 MB.");
  return transcriptionRequest(`/jobs/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "content-type": object.httpMetadata?.contentType ?? "audio/webm" },
    body: object.body,
  });
}
