import { spawn } from "node:child_process";
import { access,mkdir,open,readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startServer } from "../services/transcription/server.mjs";
import { generateStudyNotes,MODEL } from "../services/notes/generate.mjs";

try{process.loadEnvFile(".env.local")}catch{}
const model=resolve(".transcription/models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf");
await access(model).catch(()=>{throw new Error("Run npm run notes:setup first.")});
const keyFile=resolve(".transcription/notes-model-key");
const key=(await readFile(keyFile,"utf8")).trim();
await mkdir(resolve(".transcription/notes"),{recursive:true,mode:0o700});
const log=await open(".transcription/notes/model.log","a",0o600);
const modelProcess=spawn("llama-server",["--model",model,"--alias",MODEL,"--host","127.0.0.1","--port","8179","--ctx-size","16384","--parallel","1","--threads","6","--n-gpu-layers","99","--api-key-file",keyFile,"--no-webui","--jinja"],{stdio:["ignore",log.fd,log.fd]});
let modelError="";
modelProcess.on("error",()=>{modelError="llama-server is unavailable. Install llama.cpp with Homebrew."});
modelProcess.on("exit",code=>{modelError=`The Qwen runtime stopped (${code}). See .transcription/notes/model.log.`});
async function readyCheck(){
  if(modelError)throw new Error(modelError);
  const ready=await fetch("http://127.0.0.1:8179/health",{signal:AbortSignal.timeout(2000)}).then(response=>response.ok).catch(()=>false);
  if(!ready)throw new Error("Qwen 4B is starting. Try again shortly.");
}
const runtime=await startServer({
  port:8181,directory:resolve(".transcription/notes"),modelName:MODEL,resultField:"notes",
  mimePattern:/^application\/json(?:;|$)/,maxInputBytes:4*1024*1024,readyCheck,
  runner:async(path,signal)=>{
    const input=JSON.parse(await readFile(path,"utf8"));
    return generateStudyNotes(input.transcript,{key,signal});
  },
});
console.log("Qwen 4B notes queue: http://127.0.0.1:8181 (local only; model warming up)");
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await runtime.close();modelProcess.kill("SIGTERM");await log.close();process.exit(0)}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
