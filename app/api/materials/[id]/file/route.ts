import { env } from "cloudflare:workers";
import { materialsDb } from "../../../../../lib/materials-db";

type StoredMaterial = { name: string; storage_key: string | null };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await materialsDb();
    const material = await db.prepare("SELECT name, storage_key FROM materials WHERE id = ?")
      .bind(id).first<StoredMaterial>();
    if (!material?.storage_key) return new Response("File not found", { status: 404 });
    if (!env.RECORDINGS) return new Response("Storage unavailable", { status: 503 });
    const object = await env.RECORDINGS.get(material.storage_key);
    if (!object) return new Response("File not found", { status: 404 });
    const filename = encodeURIComponent(material.name).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-disposition", `attachment; filename="material"; filename*=UTF-8''${filename}`);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("x-content-type-options", "nosniff");
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch {
    return new Response("Unable to load file", { status: 500 });
  }
}
