import { env } from "cloudflare:workers";

function key(request:Request){const id=new URL(request.url).searchParams.get("id");return id&&/^[a-zA-Z0-9-]{8,64}$/.test(id)?`lectures/${id}`:null}

export async function PUT(request:Request){try{const objectKey=key(request);if(!objectKey||!env.RECORDINGS||!request.body)return Response.json({error:"Invalid recording"},{status:400});await env.RECORDINGS.put(objectKey,request.body,{httpMetadata:{contentType:request.headers.get("content-type")??"audio/webm"}});return Response.json({ok:true},{status:201})}catch{return Response.json({error:"Unable to save recording"},{status:500})}}
export async function GET(request:Request){try{const objectKey=key(request);if(!objectKey||!env.RECORDINGS)return new Response("Not found",{status:404});const object=await env.RECORDINGS.get(objectKey);if(!object)return new Response("Not found",{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set("etag",object.httpEtag);headers.set("cache-control","private, max-age=3600");headers.set("accept-ranges","bytes");return new Response(object.body,{headers})}catch{return new Response("Unable to load recording",{status:500})}}
