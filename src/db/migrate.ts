/**
 * Minimal, deterministic migration runner.
 *
 * Applies every `drizzle/*.sql` file in filename order, tracking applied
 * migrations in `documentation.__migrations`. Each migration runs inside its
 * own transaction.
 *
 * Hand-written SQL is used (instead of drizzle-kit) because the schema uses
 * PostgreSQL features drizzle-kit introspects poorly: `ltree` columns, GIN
 * indexes on `to_tsvector`, and enums in a non-public schema.
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import postgres from "postgres";

const root = resolve(import.meta.dirname, "../..");
const migrationsDir = join(root, "drizzle");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  try {
    await client`
      CREATE SCHEMA IF NOT EXISTS documentation
    `;
    await client`
      CREATE TABLE IF NOT EXISTS documentation.__migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = new Set(
      (
        await client`
          SELECT name FROM documentation.__migrations ORDER BY id
        `
      ).map((r) => r.name as string),
    );

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = await readFile(join(migrationsDir, file), "utf8");
      await client.begin(async (tx) => {
        await tx.unsafe(sqlText);
        await tx`
          INSERT INTO documentation.__migrations (name) VALUES (${file})
        `;
      });
      console.log(`  applied ${file}`);
      count++;
    }
    console.log(count === 0 ? "Database is up to date." : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
