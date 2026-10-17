import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Local database binding `DB` is unavailable. Check the D1 configuration in vite.config.ts."
    );
  }

  return drizzle(env.DB, { schema });
}
