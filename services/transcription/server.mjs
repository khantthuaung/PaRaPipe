import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { delimiter, join, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export function transcriptFromResult(result) {
  if (!Array.isArray(result.transcription)) throw new Error("Invalid transcription output");
  return result.transcription.map(segment => {
    if (typeof segment.text !== "string") throw new Error("Invalid transcript segment");
    const seconds = Math.floor(Math.max(0, Number(segment.offsets?.from) || 0) / 1000);
    const time = seconds >= 3600
      ? `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds / 60 % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
      : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
    return segment.text.trim() ? `[${time}] ${segment.text.trim()}` : "";
  }).filter(Boolean).join("\n");
}

export async function startServer({ port = 8178, directory = resolve(".transcription"), token = process.env.TRANSCRIPTION_SERVICE_TOKEN, runner, readyCheck, modelName = "small", resultField = "transcript", mimePattern = /^(audio|video)\//, maxInputBytes = 100 * 1024 * 1024 } = {}) {
  if (!token) throw new Error("Run npm run transcription:setup before starting transcription");
  const jobsDirectory = join(directory, "jobs");
  const model = join(directory, "models", "ggml-small.bin");
  const jobs = new Map();
  const queue = [];
  let active = false;
  let stopping = false;
  await mkdir(jobsDirectory, { recursive: true, mode: 0o700 });
  const folder = id => join(jobsDirectory, id);
  const publicJob = job => ({ id: job.id, status: job.status, model: modelName, [resultField]: job.status === "complete" ? job[resultField] : undefined, error: job.error });
  async function persist(job) {
    if (jobs.get(job.id) !== job) return;
    await writeFile(join(folder(job.id), "state.tmp"), JSON.stringify(publicJob(job)), { mode: 0o600 });
    await rename(join(folder(job.id), "state.tmp"), join(folder(job.id), "state.json"));
  }
  function command(binary, args, signal, timeout = 7200000) {
    return new Promise((resolveCommand, reject) => {
      const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"], signal, timeout });
      let detail = "";
      child.stderr.on("data", chunk => { detail = `${detail}${chunk}`.slice(-4000); });
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolveCommand() : reject(new Error(`${binary} failed${detail.includes("metal") ? " (GPU initialization may have failed)" : ""}`)));
    });
  }
  async function ready() {
    if (readyCheck) return readyCheck();
    if (runner) return;
    await access(model).catch(() => { throw new Error("Whisper Small is missing. Run npm run transcription:setup."); });
    // Even --help initializes Metal in some builds. Check executable access
    // without loading the GPU on every health check or upload.
    for (const binary of ["whisper-cli", "ffmpeg"]) {
      await Promise.any((process.env.PATH ?? "").split(delimiter).filter(Boolean).map(path => access(join(path, binary), constants.X_OK)))
        .catch(() => { throw new Error(`${binary} is unavailable. Install whisper-cpp and ffmpeg with Homebrew.`); });
    }
  }
  async function transcribe(job) {
    if (runner) return runner(join(folder(job.id), "input"), job.controller.signal);
    const wav = join(folder(job.id), "audio.wav");
    const output = join(folder(job.id), "result");
    await command("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-i", join(folder(job.id), "input"), "-map", "0:a:0", "-vn", "-t", "14401", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], job.controller.signal, 300000);
    if ((await stat(wav)).size > 14400 * 16000 * 2 + 4096) throw new Error("Recordings must be four hours or shorter");
    await command("whisper-cli", ["-m", model, "-f", wav, "-l", "auto", "-t", "6", "-oj", "-of", output, "-np"], job.controller.signal);
    return transcriptFromResult(JSON.parse(await readFile(`${output}.json`, "utf8")));
  }
  async function pump() {
    if (active || stopping) return;
    const id = queue.shift();
    const job = jobs.get(id);
    if (!job) { if (queue.length) void pump(); return; }
    active = true;
    try {
      job.status = "running"; await persist(job);
      job[resultField] = await transcribe(job);
      job.status = "complete"; delete job.error;
    } catch (error) {
      job.status = "failed";
      job.error = error.name === "AbortError" ? "Transcription interrupted. Try again." : error.message;
    } finally {
      if (jobs.get(id) === job) {
        await persist(job).catch(() => { job.status = "failed"; job.error = "Unable to persist transcript. Check disk space."; });
        for (const file of ["input", "audio.wav", "result.json"]) await rm(join(folder(id), file), { force: true }).catch(() => {});
      }
      active = false;
      void pump();
    }
  }
  // Keep finished transcripts and resume queued work across local service restarts.
  for (const id of await readdir(jobsDirectory)) {
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) continue;
    try {
      const stored = JSON.parse(await readFile(join(folder(id), "state.json"), "utf8"));
      if (stored.id !== id || !["queued", "running", "complete", "failed"].includes(stored.status)) continue;
      const job = { ...stored, controller: new AbortController() };
      jobs.set(id, job);
      if (["queued", "running"].includes(job.status)) {
        await access(join(folder(id), "input")); job.status = "queued"; queue.push(id);
      }
    } catch { jobs.delete(id); }
  }
  function reply(response, code, data) {
    response.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify(data));
  }
  const server = createServer(async (request, response) => {
    try {
      // Bind only to loopback and reject DNS rebinding/cross-origin browser calls.
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? "") || request.headers.origin) return reply(response, 403, { error: "Local server requests only" });
      const path = new URL(request.url, "http://127.0.0.1").pathname;
      if (path === "/health" && request.method === "GET") {
        try { await ready(); return reply(response, 200, { ready: true, model: modelName, active, queued: queue.length }); }
        catch (error) { return reply(response, 503, { ready: false, model: modelName, error: error.message }); }
      }
      const provided = Buffer.from(request.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return reply(response, 401, { error: "Unauthorized" });
      const match = path.match(/^\/jobs\/([a-zA-Z0-9-]{8,64})$/);
      if (!match) return reply(response, 404, { error: "Not found" });
      const id = match[1];
      const existing = jobs.get(id);
      if (request.method === "GET") return reply(response, existing ? 200 : 404, existing ? publicJob(existing) : { status: "not_started" });
      if (request.method === "DELETE") {
        existing?.controller.abort(); jobs.delete(id);
        for (let index = queue.length - 1; index >= 0; index--) if (queue[index] === id) queue.splice(index, 1);
        await rm(folder(id), { recursive: true, force: true });
        return reply(response, 200, { ok: true });
      }
      if (request.method !== "POST") return reply(response, 405, { error: "Method not allowed" });
      if (existing && existing.status !== "failed") { request.resume(); return reply(response, 202, publicJob(existing)); }
      if (queue.length >= 20) return reply(response, 429, { error: "Transcription queue is full. Try again later." });
      if (!mimePattern.test(request.headers["content-type"] ?? "")) return reply(response, 415, { error: "Unsupported input format" });
      await ready();
      await mkdir(folder(id), { recursive: true, mode: 0o700 });
      const job = { id, status: "queued", controller: new AbortController() };
      jobs.set(id, job);
      let bytes = 0;
      const limiter = new Transform({ transform(chunk, _encoding, done) {
        bytes += chunk.length;
        if (bytes > maxInputBytes) done(new Error("Input exceeds the allowed size")); else done(null, chunk);
      } });
      try {
        await pipeline(request, limiter, createWriteStream(join(folder(id), "upload.tmp"), { mode: 0o600 }));
        if (!bytes) throw new Error("Recording is empty");
        await rename(join(folder(id), "upload.tmp"), join(folder(id), "input"));
        await persist(job); queue.push(id); reply(response, 202, publicJob(job)); void pump();
      } catch (error) {
        job.status = "failed"; job.error = error.message; await persist(job);
        await rm(join(folder(id), "upload.tmp"), { force: true });
        reply(response, bytes > maxInputBytes ? 413 : 400, publicJob(job));
      }
    } catch (error) { reply(response, 503, { error: error.message || "Transcription unavailable" }); }
  });
  await new Promise((resolveListening, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolveListening); });
  void pump();
  return { server, async close() { stopping = true; for (const job of jobs.values()) job.controller.abort(); await new Promise(resolveClosing => server.close(resolveClosing)); while (active) await new Promise(resolveIdle => setTimeout(resolveIdle, 10)); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(".env.local"); } catch { /* Report missing configuration below. */ }
  const runtime = await startServer();
  console.log("Whisper Small transcription: http://127.0.0.1:8178 (local only)");
  process.on("SIGINT", async () => { await runtime.close(); process.exit(0); });
  process.on("SIGTERM", async () => { await runtime.close(); process.exit(0); });
}
