import { env } from "cloudflare:workers";
import { materialsDb } from "../../../../../lib/materials-db";
import { readMlResponse } from "../../../../../lib/ml-response";

type MaterialRow={id:string;name:string;kind:string;source_url:string|null;storage_key:string|null};

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!env.ML_SERVICE_URL)return Response.json({error:"ML processor is not configured yet."},{status:503});
  try{
    const db=await materialsDb();
    const row=await db.prepare("SELECT id, name, kind, source_url, storage_key FROM materials WHERE id = ?").bind(id).first<MaterialRow>();
    if(!row)return Response.json({error:"Material not found"},{status:404});
    await db.prepare("UPDATE materials SET status = 'Processing', error = NULL WHERE id = ?").bind(id).run();
    const form=new FormData();form.set("kind",row.kind);form.set("name",row.name);
    if(row.source_url)form.set("url",row.source_url);
    if(row.storage_key){const object=await env.RECORDINGS.get(row.storage_key);if(!object)throw new Error("Uploaded source is missing");form.set("file",new File([await object.arrayBuffer()],row.name,{type:object.httpMetadata?.contentType??"application/octet-stream"}))}
    const response=await fetch(`${env.ML_SERVICE_URL.replace(/\/$/,"")}/process`,{method:"POST",headers:env.ML_SERVICE_TOKEN?{"authorization":`Bearer ${env.ML_SERVICE_TOKEN}`}:{},body:form});
    const result=await readMlResponse(response);
    if(!response.ok)throw new Error(result.error||result.detail||"Processing failed");
    await db.prepare("UPDATE materials SET status = 'Complete', transcript = ?, summary = ?, error = NULL WHERE id = ?").bind(result.transcript??"",result.summary??"",id).run();
    return Response.json({...row,status:"Complete",transcript:result.transcript??"",summary:result.summary??""});
  }catch(error){const message=error instanceof Error?error.message:"Processing failed";const db=await materialsDb().catch(()=>null);await db?.prepare("UPDATE materials SET status = 'Failed', error = ? WHERE id = ?").bind(message.slice(0,500),id).run().catch(()=>undefined);return Response.json({error:message},{status:500})}
}
