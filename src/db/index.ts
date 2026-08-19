import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Single connection pool shared across the app.
 * `globalThis` caching keeps hot-reload from leaking connections in dev.
 */
const globalForDb = globalThis as unknown as {
  __docuDb?: ReturnType<typeof createClient>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.main");
  }
  const client = postgres(url, {
    max: 10,
    // Keep ltree-typed params from being mangled; everything else is standard.
    onnotice: () => {},
  });
  return { client, db: drizzle(client, { schema }) };
}

export function getDb() {
  if (!globalForDb.__docuDb) {
    globalForDb.__docuDb = createClient();
  }
  return globalForDb.__docuDb;
}

export const db = getDb().db;
