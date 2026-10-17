import { env } from "cloudflare:workers";
import { lecturesDb } from "./lectures-db";
import { materialsDb } from "./materials-db";

export const NOTES_MODEL = "Qwen3-4B-Instruct-2507";
type Kind = "lectures"|"materials";
type Draft = {model:string;sections:Record<string,unknown[]>;warnings:string[];createdAt:string};
type Job = {status:"not_started"|"queued"|"running"|"complete"|"failed";notes?:Draft;error?:string};
class NotesError extends Error { constructor(message:string, public status=503){super(message)} }

export async function notesRequest(path:string,init:RequestInit={}) {
  if(!env.NOTES_SERVICE_URL||!env.TRANSCRIPTION_SERVICE_TOKEN)throw new NotesError("Qwen notes are not configured. Run npm run notes:setup.");
  const base=new URL(env.NOTES_SERVICE_URL);
  if(base.protocol!=="http:"||!["127.0.0.1","localhost"].includes(base.hostname))throw new NotesError("This notes setup supports only your local Mac.");
  const headers=new Headers(init.headers);headers.set("authorization",`Bearer ${env.TRANSCRIPTION_SERVICE_TOKEN}`);
  let response:Response;
  try{response=await fetch(new URL(path,base),{...init,headers,signal:AbortSignal.timeout(15000)})}
  catch{throw new NotesError("Qwen 4B is offline. Start it with npm run notes:start. Your transcript and typed notes are unchanged.")}
  let value:Job&{ready?:boolean};
  try{value=await response.json() as typeof value}catch{throw new NotesError("The notes service returned an invalid response.")}
  if(!response.ok&&!(response.status===404&&value.status==="not_started"))throw new NotesError(value.error||"Notes generation is unavailable.");
  return value;
}
async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("")}
export async function notesJobId(kind:Kind,id:string,transcript:string){return digest(`${NOTES_MODEL}:notes-v1:${kind}:${id}:${transcript}`)}
export function notesStorageKey(kind:Kind,id:string){return `study-notes/${kind}/${id}.json`}

export async function handleStudyNotes(kind:Kind,id:string,create:boolean) {
  try{
    if(!/^[a-zA-Z0-9-]{8,64}$/.test(id))throw new NotesError("Invalid source",400);
    const db=kind==="lectures"?await lecturesDb():await materialsDb();
    const source=await db.prepare(`SELECT transcript FROM ${kind} WHERE id = ?`).bind(id).first<{transcript:string|null}>();
    if(!source)throw new NotesError("Source not found",404);
    const transcript=source.transcript??"";
    if(!transcript.trim())return Response.json(create?{error:"Create the raw transcript before generating study notes."}:{status:"not_started"},{status:create?422:200});
    if(!env.RECORDINGS)throw new NotesError("Notes storage is unavailable.");
    const jobId=await notesJobId(kind,id,transcript);
    const storageKey=notesStorageKey(kind,id);
    const stored=await env.RECORDINGS.get(storageKey);
    if(stored){
      const cached=await stored.json<{jobId:string;notes:Draft}>().catch(()=>null);
      if(cached?.jobId===jobId&&cached.notes?.model===NOTES_MODEL&&cached.notes.sections)return Response.json({status:"complete",notes:cached.notes});
    }
    const job=await notesRequest(`/jobs/${jobId}`,create?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({transcript})}:{});
    if(job.status==="complete"){
      if(job.notes?.model!==NOTES_MODEL||!job.notes.sections||Object.values(job.notes.sections).some(section=>!Array.isArray(section)))throw new NotesError("The generated draft is invalid. No notes were overwritten.",502);
      // Generated files are deliberately separate from the transcript and the
      // summary column, which contains the student's own typed notes.
      await env.RECORDINGS.put(storageKey,JSON.stringify({jobId,notes:job.notes}),{httpMetadata:{contentType:"application/json"}});
    }
    return Response.json(job,{status:["queued","running"].includes(job.status)?202:200});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to create notes"},{status:error instanceof NotesError?error.status:503})}
}

export async function deleteStudyNotes(kind:Kind,id:string,transcript:string){
  await env.RECORDINGS?.delete(notesStorageKey(kind,id));
  if(transcript)await notesRequest(`/jobs/${await notesJobId(kind,id,transcript)}`,{method:"DELETE"}).catch(()=>undefined);
}
