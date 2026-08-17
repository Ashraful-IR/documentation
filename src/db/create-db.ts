/**
 * Ensures the DATABASE_URL database exists, creating it if needed.
 *
 * Classic "create database if not exists" bootstrap: connects to the
 * maintenance `postgres` database, checks pg_catalog.pg_database, and creates
 * the target database when missing. Uses the project's `postgres`
 * (postgres.js) driver instead of `pg`, matching the rest of the codebase.
 *
 * Run standalone:  npm run db:create
 * Or imported by  src/db/migrate.ts  so `db:migrate` works on a fresh database.
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

export type EnsureDbResult = "created" | "exists";

export async function ensureDatabaseExists(url: string): Promise<EnsureDbResult> {
  const parsed = new URL(url);
  const targetDbName = parsed.pathname.replace(/^\//, "");
  if (!targetDbName) {
    throw new Error("DATABASE_URL is missing a database name");
  }

  // Connect to the default maintenance database to check/create the target one.
  parsed.pathname = "/postgres";
  const client = postgres(parsed.toString(), { max: 1 });
  try {
    const rows = await client`
      SELECT datname FROM pg_catalog.pg_database WHERE datname = ${targetDbName}
    `;
    if (rows.length === 0) {
      console.log(`Database '${targetDbName}' does not exist. Creating...`);
      // DDL can't take bind parameters; escape embedded quotes in the name.
      await client.unsafe(`CREATE DATABASE "${targetDbName.replace(/"/g, '""')}"`);
      console.log(`Database '${targetDbName}' created successfully.`);
      return "created";
    }
    console.log(`Database '${targetDbName}' already exists.`);
    return "exists";
  } finally {
    await client.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }
  try {
    await ensureDatabaseExists(url);
  } catch (error) {
    console.error("Error checking/creating database:");
    console.error(error);
    process.exit(1);
  }
}

// Run only when invoked directly (`npm run db:create`), not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
