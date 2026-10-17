import { env } from "cloudflare:workers";
import { materialsDb } from "../../../../../lib/materials-db";
import { submitRecording, transcriptionRequest, type TranscriptJob } from "../../../../../lib/transcription";

type MaterialRow = { kind:string; storage_key:string|null; transcript:string|null };
type Context = {params:Promise<{id:string}>};
async function handle(request:Request,{params}:Context) {
  try {
    const {id}=await params;
    if(!/^[a-zA-Z0-9-]{8,55}$/.test(id))return Response.json({error:"Invalid material"},{status:400});
    const db=await materialsDb();
    const material=await db.prepare("SELECT kind, storage_key, transcript FROM materials WHERE id = ?").bind(id).first<MaterialRow>();
    if(!material)return Response.json({error:"Material not found"},{status:404});
    if(!["audio","video"].includes(material.kind))return Response.json({error:"Upload an audio or video file to transcribe. PDFs and bookmarked links are not speech recordings."},{status:422});
    if(material.transcript)return Response.json({status:"complete",transcript:material.transcript,model:"small"});
    const key=`material-${id}`;
    let job:TranscriptJob;
    if(request.method==="POST"){
      const object=material.storage_key?await env.RECORDINGS?.get(material.storage_key):null;
      if(!object)return Response.json({error:"The uploaded recording is missing."},{status:404});
      job=await submitRecording(key,object);
    }else job=await transcriptionRequest(`/jobs/${encodeURIComponent(key)}`);
    if(job.status==="complete"){
      if(typeof job.transcript!=="string")throw new Error("The completed transcript is missing.");
      await db.prepare("UPDATE materials SET transcript = ?, status = 'Transcript ready', error = NULL WHERE id = ?").bind(job.transcript,id).run();
    }
    return Response.json(job,{status:["queued","running"].includes(job.status)?202:200});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to transcribe material"},{status:503})}
}
export const GET=handle;
export const POST=handle;
