import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const model = resolve(".transcription/models/ggml-small.bin");
const checksum = "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b";
async function hash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
await mkdir(resolve(".transcription/models"), { recursive: true });
if (await hash(model).catch(() => "") !== checksum) {
  console.log("Downloading multilingual Whisper Small (488 MB)…");
  const response = await fetch("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin");
  if (!response.ok || !response.body) throw new Error("Whisper Small download failed");
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${model}.download`));
  if (await hash(`${model}.download`) !== checksum) throw new Error("Model checksum mismatch; the downloaded model will not be used");
  await rename(`${model}.download`, model);
}
let environment = await readFile(".env.local", "utf8").catch(() => "");
const token = environment.match(/^TRANSCRIPTION_SERVICE_TOKEN=(.+)$/m)?.[1] ?? randomBytes(32).toString("hex");
environment = environment.replace(/^TRANSCRIPTION_SERVICE_(?:URL|TOKEN)=.*\n?/gm, "");
await writeFile(".env.local", `${environment.trim()}\nTRANSCRIPTION_SERVICE_URL=http://127.0.0.1:8178\nTRANSCRIPTION_SERVICE_TOKEN=${token}\n`, { mode: 0o600 });
await chmod(".env.local", 0o600);
console.log("Whisper Small verified. Local connection configured (credentials not displayed).");
console.log("Native prerequisites: brew install whisper-cpp ffmpeg");
