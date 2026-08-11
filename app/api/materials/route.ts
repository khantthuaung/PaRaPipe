import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_url TEXT,
  storage_key TEXT,
  status TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  error TEXT,
  created_at TEXT NOT NULL
)`;
async function ready(){if(!env.DB)throw new Error("Database unavailable");await env.DB.prepare(createTable).run();return env.DB}
function kindFromType(type:string){if(type==="application/pdf")return "pdf";if(type.startsWith("audio/"))return "audio";if(type.startsWith("video/"))return "video";return null}

export async function GET(){try{const db=await ready();const result=await db.prepare("SELECT id, name, kind, source_url AS sourceUrl, status, transcript, summary, error, created_at AS createdAt FROM materials ORDER BY created_at DESC LIMIT 100").all();return Response.json(result.results??[])}catch{return Response.json([])}}

export async function PUT(request:Request){try{const url=new URL(request.url);const name=url.searchParams.get("name")?.trim();const type=url.searchParams.get("type")?.trim()??request.headers.get("content-type")??"";const kind=kindFromType(type);const length=Number(request.headers.get("content-length")??0);if(!name||name.length>180||!kind||!request.body)return Response.json({error:"Invalid file"},{status:400});if(length>100*1024*1024)return Response.json({error:"File too large"},{status:413});if(!env.RECORDINGS)return Response.json({error:"Storage unavailable"},{status:503});const id=crypto.randomUUID();const storageKey=`materials/${id}`;await env.RECORDINGS.put(storageKey,request.body,{httpMetadata:{contentType:type},customMetadata:{originalName:name}});const createdAt=new Date().toISOString();const status=kind==="pdf"?"Ready to extract":"Ready to transcribe";const db=await ready();await db.prepare("INSERT INTO materials (id, name, kind, source_url, storage_key, status, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?)").bind(id,name,kind,storageKey,status,createdAt).run();return Response.json({id,name,kind,status,createdAt},{status:201})}catch{return Response.json({error:"Unable to upload file"},{status:500})}}

export async function POST(request:Request){try{const body=await request.json() as {url?:string};if(!body.url)return Response.json({error:"URL required"},{status:400});let parsed:URL;try{parsed=new URL(body.url)}catch{return Response.json({error:"Invalid URL"},{status:400})}if(parsed.protocol!=="https:")return Response.json({error:"HTTPS required"},{status:400});const id=crypto.randomUUID();const createdAt=new Date().toISOString();const name=parsed.hostname.replace(/^www\./,"")+parsed.pathname.slice(0,60);const db=await ready();await db.prepare("INSERT INTO materials (id, name, kind, source_url, storage_key, status, created_at) VALUES (?, ?, 'link', ?, NULL, 'Link saved', ?)").bind(id,name,parsed.toString(),createdAt).run();return Response.json({id,name,kind:"link",sourceUrl:parsed.toString(),status:"Link saved",createdAt},{status:201})}catch{return Response.json({error:"Unable to save link"},{status:500})}}
