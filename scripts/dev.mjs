import { spawn } from "node:child_process";
import { resolve } from "node:path";

try { process.loadEnvFile(".env.local"); } catch { /* The website can run without transcription configured. */ }
const children = [];
for(const [serviceUrl,expected,entry] of [
  [process.env.TRANSCRIPTION_SERVICE_URL,"small","services/transcription/server.mjs"],
  [process.env.NOTES_SERVICE_URL,"Qwen3-4B-Instruct-2507","scripts/notes-server.mjs"],
]){
  if(!["http://127.0.0.1:8178","http://127.0.0.1:8181"].includes(serviceUrl))continue;
  const running = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(1000) }).then(response=>response.json()).then(health=>health.model===expected).catch(()=>false);
  if (!running) children.push(spawn(process.execPath, [entry], { stdio: "inherit" }));
}
const website = spawn(resolve("node_modules/.bin/vinext"), ["dev", ...process.argv.slice(2)], { stdio: "inherit" });
children.push(website);
function stop(signal = "SIGTERM") { for (const child of children) child.kill(signal); }
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
website.on("exit", code => { stop(); process.exitCode = code ?? 1; });
