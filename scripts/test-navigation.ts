/**
 * Integration tests for navigation.service.ts against the local database.
 * Run: npm run db:start && npx tsx scripts/test-navigation.ts
 *
 * Expects a seeded database (npm run db:seed). Creates and hard-deletes its
 * own sandbox nodes so the seed tree stays intact.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { navigation, users } from "../src/db/schema";
import * as navService from "../src/services/navigation.service";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@local.dev")).limit(1);
  if (!admin) throw new Error("Seed the database first (npm run db:seed)");
  const actor = { id: admin.id, role: "ADMIN" as const };

  const tree = await navService.getTree(actor);
  const find = (title: string) => {
    const walk = (nodes: typeof tree): (typeof tree)[number] | null => {
      for (const n of nodes) {
        if (n.title === title) return n;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    const node = walk(tree);
    if (!node) throw new Error(`node "${title}" not found in seed tree`);
    return node;
  };

  const arch = find("Architecture");
  const frontend = find("Frontend");
  const backend = find("Backend");
  const database = find("Database");
  const overview = find("Overview");

  // --- 1. Move Backend under Database (re-parent) ---
  await navService.moveNode(actor, backend.id, { parentId: database.id });
  {
    const rows = await db
      .select({ title: navigation.title, path: navigation.path, parentId: navigation.parentId })
      .from(navigation)
      .where(eq(navigation.id, backend.id))
      .limit(1);
    const row = rows[0];
    const dbPath = (
      await db.select({ path: navigation.path }).from(navigation).where(eq(navigation.id, database.id)).limit(1)
    )[0].path;
    check(row.parentId === database.id, "Backend parent updated");
    check(row.path.startsWith(dbPath + "."), `Backend path reparented: ${row.path} vs parent ${dbPath}`);
  }
  // Move it back.
  await navService.moveNode(actor, backend.id, { parentId: arch.id });

  // --- 2. Cycle rejection: Architecture under its descendant Frontend ---
  let cycleRejected = false;
  try {
    await navService.moveNode(actor, arch.id, { parentId: frontend.id });
  } catch (err) {
    cycleRejected = err instanceof Error && err.message.includes("descendant");
  }
  check(cycleRejected, "cycle move rejected");

  // Self-parent rejection.
  let selfRejected = false;
  try {
    await navService.moveNode(actor, arch.id, { parentId: arch.id });
  } catch {
    selfRejected = true;
  }
  check(selfRejected, "self-move rejected");

  // --- 3. Reorder Overview after Architecture ---
  await navService.moveNode(actor, overview.id, { parentId: null, prevId: arch.id });
  {
    const roots = (await navService.getTree(actor)).filter((n) => n.parentId === null);
    const titles = roots.map((n) => n.title);
    check(
      titles.indexOf("Architecture") === 0 && titles.indexOf("Overview") === 1,
      `Overview reordered after Architecture: ${titles.join(", ")}`,
    );
  }
  // Move Overview back to the front.
  await navService.moveNode(actor, overview.id, { parentId: null, nextId: arch.id });

  // --- 4. Soft delete subtree + restore ---
  await navService.softDeleteNode(actor, arch.id);
  {
    const rows = await db
      .select({ title: navigation.title, deletedAt: navigation.deletedAt })
      .from(navigation)
      .where(eq(navigation.parentId, arch.id));
    check(rows.length === 3, "subtree still exists (soft delete)");
    check(rows.every((r) => r.deletedAt !== null), "subtree soft-deleted");
    const liveTree = await navService.getTree(actor);
    check(!liveTree.some((n) => n.id === arch.id), "deleted folder hidden from tree");
  }
  await navService.restoreNode(actor, arch.id);
  {
    const rows = await db
      .select({ deletedAt: navigation.deletedAt })
      .from(navigation)
      .where(eq(navigation.parentId, arch.id));
    check(rows.every((r) => r.deletedAt === null), "subtree restored");
  }

  // --- 5. Stress: many insertions at one spot then verify order ---
  {
    const sandbox = await navService.createNode(actor, {
      parentId: null,
      type: "FOLDER",
      title: "Test Sandbox",
      slug: "test-sandbox",
    });
    const created: string[] = [];
    for (let i = 0; i < 60; i++) {
      const node = await navService.createNode(actor, {
        parentId: sandbox.id,
        type: "FOLDER",
        title: `Child ${i}`,
        slug: `child-${i}`,
      });
      created.push(node.id);
    }
    const rows = await db
      .select({ title: navigation.title, sortKey: navigation.sortKey })
      .from(navigation)
      .where(eq(navigation.parentId, sandbox.id))
      .orderBy(navigation.sortKey);
    const keys = rows.map((r) => r.sortKey);
    const sorted = [...keys].sort();
    check(JSON.stringify(keys) === JSON.stringify(sorted), "60 children keep strict order");
    check(keys.every((k) => k.length <= 24), "keys stay short (rebalance works)");
    check(keys.every((k, i) => i === 0 || keys[i - 1] < k), "keys strictly increasing");

    await navService.hardDeleteNode(actor, sandbox.id);
    const after = await navService.getTree(actor);
    check(!after.some((n) => n.id === sandbox.id), "sandbox hard-deleted");
  }

  if (failures === 0) {
    console.log("All navigation integration tests passed.");
  } else {
    console.error(`${failures} failure(s).`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
