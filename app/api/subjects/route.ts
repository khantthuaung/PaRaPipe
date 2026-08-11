import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS subjects (name TEXT PRIMARY KEY, created_at TEXT NOT NULL)`;
async function ready(){if(!env.DB)throw new Error("Database unavailable");await env.DB.prepare(createTable).run();return env.DB}

export async function GET(){try{const db=await ready();const result=await db.prepare("SELECT name, created_at AS createdAt FROM subjects ORDER BY name COLLATE NOCASE").all();return Response.json(result.results??[])}catch{return Response.json([])}}
export async function POST(request:Request){try{const body=await request.json() as {name?:string};const name=body.name?.trim();if(!name||name.length>100)return Response.json({error:"Invalid subject"},{status:400});const db=await ready();await db.prepare("INSERT OR IGNORE INTO subjects (name, created_at) VALUES (?, ?)").bind(name,new Date().toISOString()).run();return Response.json({ok:true},{status:201})}catch{return Response.json({error:"Unable to add subject"},{status:500})}}
export async function DELETE(request:Request){try{const name=new URL(request.url).searchParams.get("name")?.trim();if(!name)return Response.json({error:"Subject required"},{status:400});const db=await ready();await db.prepare("DELETE FROM subjects WHERE name = ?").bind(name).run();return Response.json({ok:true})}catch{return Response.json({error:"Unable to remove subject"},{status:500})}}
