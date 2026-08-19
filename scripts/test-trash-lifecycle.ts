import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { navigation, documents, users } from "../src/db/schema";
import * as navService from "../src/services/navigation.service";
import * as docService from "../src/services/document.service";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
}

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@local.dev")).limit(1);
  if (!admin) throw new Error("Seed user not found");
  const actor = { id: admin.id, role: "ADMIN" as const };

  console.log("--- 1. Create Folder and Child Documents ---");
  const folder = await navService.createNode(actor, {
    parentId: null,
    type: "FOLDER",
    title: "Trash Test Folder",
    slug: "trash-test-folder",
  });

  const doc1 = await navService.createNode(actor, {
    parentId: folder.id,
    type: "DOCUMENT",
    title: "Trash Child Doc 1",
    slug: "trash-child-doc-1",
  });

  const doc2 = await navService.createNode(actor, {
    parentId: folder.id,
    type: "DOCUMENT",
    title: "Trash Child Doc 2",
    slug: "trash-child-doc-2",
  });

  check(!!folder.id && !!doc1.id && !!doc2.id, "Created folder and child documents");

  console.log("--- 2. Soft-delete ONLY Child Doc 1 (Parent folder remains live) ---");
  await navService.softDeleteNode(actor, doc1.id);

  let trash = await navService.getTrash(actor);
  const foundDoc1InTrash = trash.some((n) => n.id === doc1.id);
  check(foundDoc1InTrash, "Child Doc 1 appears in trash even though parent is live");

  const doc1NodeInTrash = trash.find((n) => n.id === doc1.id);
  check(
    doc1NodeInTrash?.displayPath?.includes("Trash Test Folder / Trash Child Doc 1") ?? false,
    `Child Doc 1 has correct displayPath: ${doc1NodeInTrash?.displayPath}`
  );

  console.log("--- 3. Restore Child Doc 1 ---");
  await navService.restoreNode(actor, doc1.id);
  trash = await navService.getTrash(actor);
  check(!trash.some((n) => n.id === doc1.id), "Child Doc 1 removed from trash after restore");

  const liveTree = await navService.getTree(actor);
  const foundInLive = liveTree.some(
    (n) => n.id === folder.id && n.children.some((c) => c.id === doc1.id)
  );
  check(foundInLive, "Child Doc 1 restored back under its live parent folder in tree");

  console.log("--- 4. Soft-delete Folder (and subtree) ---");
  await navService.softDeleteNode(actor, folder.id);
  trash = await navService.getTrash(actor);
  const foundFolderInTrash = trash.find((n) => n.id === folder.id);
  check(!!foundFolderInTrash, "Folder appears in trash");
  check(
    foundFolderInTrash?.children.some((c) => c.id === doc1.id) ?? false,
    "Folder's children are nested under it in trash tree"
  );

  console.log("--- 5. Restore a child whose parent is still in trash ---");
  await navService.restoreNode(actor, doc2.id);
  const treeAfterOrphanRestore = await navService.getTree(actor);
  const doc2AtRoot = treeAfterOrphanRestore.some((n) => n.id === doc2.id && n.parentId === null);
  check(doc2AtRoot, "Restoring child when parent is in trash re-parents child to root seamlessly");

  console.log("--- 6. Permanently Delete (Hard Delete) doc2 ---");
  await navService.hardDeleteNode(actor, doc2.id);
  const doc2Rows = await db.select().from(navigation).where(eq(navigation.id, doc2.id));
  check(doc2Rows.length === 0, "Doc 2 is permanently deleted from database");

  console.log("--- 7. Empty Trash ---");
  const emptyRes = await navService.emptyTrash(actor);
  check(emptyRes.count >= 1, `Emptied trash (${emptyRes.count} items purged)`);

  const trashAfterEmpty = await navService.getTrash(actor);
  check(trashAfterEmpty.length === 0, "Trash is completely empty after emptyTrash");

  if (failures === 0) {
    console.log("\nALL TRASH LIFECYCLE TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
