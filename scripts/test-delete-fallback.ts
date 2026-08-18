/**
 * Tests for the post-delete fallback navigation helpers in
 * src/lib/tree/fallback.ts.
 * Run: npm run test:fallback
 */
import { findFallbackAfterDelete, insertNodeAtSortKey } from "../src/lib/tree/fallback";
import type { NavigationNode } from "../src/types";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

function node(id: string, title: string, children: NavigationNode[] = [], sortKey = id): NavigationNode {
  return {
    id,
    parentId: null,
    type: children.length ? "FOLDER" : "DOCUMENT",
    title,
    slug: id,
    documentId: children.length ? null : `doc-${id}`,
    linkUrl: null,
    icon: null,
    description: null,
    isVisible: true,
    sortKey,
    deletedAt: null,
    effectivelyHidden: false,
    children,
  };
}

function setParents(nodes: NavigationNode[], parentId: string | null = null): void {
  for (const n of nodes) {
    n.parentId = parentId;
    setParents(n.children, n.id);
  }
}

// Tree: A(folder: A1, A2), B, C
const tree: NavigationNode[] = [node("A", "A", [node("A1", "A1"), node("A2", "A2")]), node("B", "B"), node("C", "C")];
setParents(tree);

// Deleting a middle leaf → next sibling.
check(findFallbackAfterDelete(tree, "A1") === "A2", "delete A1 → next sibling A2");

// Deleting the last leaf of a folder → the folder's next sibling.
check(findFallbackAfterDelete(tree, "A2") === "B", "delete A2 → parent's next sibling B");

// Deleting a folder → the node after its whole subtree (children are gone too).
check(findFallbackAfterDelete(tree, "A") === "B", "delete folder A → next sibling B (skips deleted children)");

// Deleting the last node → the previous node.
check(findFallbackAfterDelete(tree, "C") === "B", "delete last node C → previous node B");

// Deleting a middle root node → the next root node.
check(findFallbackAfterDelete(tree, "B") === "C", "delete B → next node C");

// Deleting a node not in the tree → null.
check(findFallbackAfterDelete(tree, "ghost") === null, "unknown id → null");

// Empty tree → null.
check(findFallbackAfterDelete([], "A") === null, "empty tree → null");

// Only node → null.
check(findFallbackAfterDelete([node("solo", "Solo")], "solo") === null, "single node deleted → null");

// insertNodeAtSortKey: root insertion between B and C.
{
  const stub = node("X", "X", [], "B1"); // sortKey between B and C
  const withX = insertNodeAtSortKey(tree, stub);
  const order = withX.map((n) => n.id);
  check(order.join(",") === "A,B,X,C", `root insert by sortKey (got ${order.join(",")})`);
  // Fallback after deleting A (folder) in the reconstructed tree → B, the
  // first node after the removed subtree.
  check(findFallbackAfterDelete(withX, "A") === "B", "reconstructed tree: delete folder A → B");
  // Fallback after deleting X → C (its next sibling).
  check(findFallbackAfterDelete(withX, "X") === "C", "reconstructed tree: delete X → C");
}

// insertNodeAtSortKey: child insertion inside a folder.
{
  const stub = node("A3", "A3", [], "A3");
  stub.parentId = "A";
  const withA3 = insertNodeAtSortKey(tree, stub);
  const a = withA3.find((n) => n.id === "A")!;
  check(a.children.map((c) => c.id).join(",") === "A1,A2,A3", `child insert by sortKey (got ${a.children.map((c) => c.id).join(",")})`);
  // Fallback after deleting A2 → A3 (next sibling).
  check(findFallbackAfterDelete(withA3, "A2") === "A3", "reconstructed tree: delete A2 → A3");
}

// Reconstructed tree: deleted last node → previous visible node.
{
  const stub = node("C", "C", [], "C");
  const withC = insertNodeAtSortKey(tree.filter((n) => n.id !== "C"), stub);
  check(findFallbackAfterDelete(withC, "C") === "B", "reconstructed tree: delete last C → B");
}

if (failures === 0) {
  console.log("All delete-fallback tests passed.");
} else {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
