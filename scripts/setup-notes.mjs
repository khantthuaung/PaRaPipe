import { createHash,randomBytes } from "node:crypto";
import { createReadStream,createWriteStream } from "node:fs";
import { access,chmod,mkdir,readFile,rename,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const filename="Qwen3-4B-Instruct-2507-Q4_K_M.gguf";
const model=resolve(".transcription/models",filename);
const expected="3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597";
async function checksum(path){const hash=createHash("sha256");for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest("hex")}
await mkdir(resolve(".transcription/models"),{recursive:true});
if(await checksum(model).catch(()=>"")!==expected){
  console.log("Downloading the 2.5 GB Qwen3-4B-Instruct-2507 Q4_K_M model…");
  const response=await fetch(`https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/${filename}`);
  if(!response.ok||!response.body)throw new Error("Notes model download failed");
  await pipeline(Readable.fromWeb(response.body),createWriteStream(`${model}.download`));
  if(await checksum(`${model}.download`)!==expected)throw new Error("Model checksum mismatch. The download will not be used.");
  await rename(`${model}.download`,model);
}
const keyFile=resolve(".transcription/notes-model-key");
if(!await access(keyFile).then(()=>true).catch(()=>false))await writeFile(keyFile,randomBytes(32).toString("hex"),{mode:0o600});
await chmod(keyFile,0o600);
let environment=await readFile(".env.local","utf8").catch(()=>"");
if(!/^TRANSCRIPTION_SERVICE_TOKEN=.+$/m.test(environment)){
  environment+=`\nTRANSCRIPTION_SERVICE_TOKEN=${randomBytes(32).toString("hex")}\n`;
}
environment=environment.replace(/^NOTES_SERVICE_URL=.*\n?/gm,"");
await writeFile(".env.local",`${environment.trim()}\nNOTES_SERVICE_URL=http://127.0.0.1:8181\n`,{mode:0o600});
await chmod(".env.local",0o600);
console.log("Qwen 4B checksum verified. Local model authentication configured; no credentials displayed.");
