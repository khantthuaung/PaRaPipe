import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const base = "http://localhost:3000";
const id = `whisper-qa-${crypto.randomUUID()}`;
const title = "Temporary Whisper Small QA sample";
const notes = "QA typed notes: preserve this exact text.\nNo summary generation.";
async function json(path, init) {
  const response = await fetch(base + path, { ...init, signal: AbortSignal.timeout(60000) });
  let data;
  try { data = await response.json(); } catch { throw new Error(`Non-JSON response: ${response.status}`); }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
let created = false;
try {
  let audio;
  try { audio = await readFile(".transcription/jfk.wav"); }
  catch {
    const sample = await fetch("https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav");
    if (!sample.ok) throw new Error("Unable to download the public speech sample");
    audio = Buffer.from(await sample.arrayBuffer());
    await writeFile(".transcription/jfk.wav", audio);
  }
  await json(`/api/recordings?id=${id}`, { method: "PUT", headers: { "content-type": "audio/wav" }, body: audio });
  await json("/api/lectures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, subject: "Transcription QA", title, transcript: "", summary: notes, createdAt: new Date().toISOString(), duration: 11, audioKey: `lectures/${id}` }) });
  created = true;
  const started = performance.now();
  const job = await json(`/api/lectures/${id}/transcript`, { method: "POST" });
  console.log(JSON.stringify({ sampleJob: job.status, model: job.model }));
  let complete = false;
  for (let count = 0; count < 120; count++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const result = await json(`/api/lectures/${id}/transcript`);
    if (result.status === "failed") throw new Error(result.error);
    if (result.status !== "complete") continue;
    assert.match(result.transcript, /ask not/i);
    const lectures = await json("/api/lectures");
    const lecture = lectures.find(value => value.id === id);
    assert.equal(lecture.summary, notes);
    assert.equal(lecture.transcript, result.transcript);
    console.log(JSON.stringify({ endToEnd: "passed", rawTranscriptSaved: true, typedNotesUnchanged: true, sampleSeconds: Math.round((performance.now() - started) / 1000) }));
    complete = true; break;
  }
  assert.ok(complete, "Timed out waiting for local sample transcription");
} finally {
  if (created) {
    const lectures = await json("/api/lectures");
    if (lectures.find(value => value.id === id)?.title === title) {
      await json(`/api/lectures?id=${id}`, { method: "DELETE" });
      console.log("Removed only the temporary QA lecture, audio, and local job.");
    }
  }
}
