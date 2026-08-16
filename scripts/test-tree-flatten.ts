/**
 * Tests for src/lib/tree/flatten.ts.
 * Run: npx tsx scripts/test-tree-flatten.ts
 */
import { flattenTree, applyDragOver, computeDropTarget, wouldCreateCycle } from "../src/lib/tree/flatten";
import type { NavigationNode } from "../src/types";

function node(id: string, title: string, children: NavigationNode[] = []): NavigationNode {
  return {
    id,
    parentId: null,
    type: children.length ? "FOLDER" : "DOCUMENT",
    title,
    slug: id,
    documentId: null,
    linkUrl: null,
    icon: null,
    description: null,
    isVisible: true,
    sortKey: "",
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

const tree: NavigationNode[] = [
  node("a", "A", [
    node("a1", "A1"),
    node("a2", "A2"),
  ]),
  node("b", "B", [
    node("b1", "B1", [node("b1x", "B1X")]),
  ]),
  node("c", "C"),
];
setParents(tree);

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

// flatten
{
  const items = flattenTree(tree, new Set());
  check(items.length === 7, "flatten length 7");
  check(JSON.stringify(items.map((i) => [i.id, i.depth])) === JSON.stringify([["a", 0], ["a1", 1], ["a2", 1], ["b", 0], ["b1", 1], ["b1x", 2], ["c", 0]]), "flatten order + depth");

  const collapsed = flattenTree(tree, new Set(["a"]));
  check(collapsed.length === 5, "collapsed folder hides children");
}

// applyDragOver: move b under A (indent)
{
  let items = flattenTree(tree, new Set());
  items = applyDragOver(items, "b", "a", 20); // deltaX > 16 → indent
  const b = items.find((i) => i.id === "b")!;
  check(b.depth === 1, `b indented to depth 1 (got ${b.depth})`);
  const target = computeDropTarget(items, "b");
  check(target.parentId === "a", `b's parent is a (got ${target.parentId})`);
}

// applyDragOver: reorder a2 before a1 at same depth
{
  let items = flattenTree(tree, new Set());
  items = applyDragOver(items, "a2", "a1", 0);
  const order = items.map((i) => i.id);
  check(order.indexOf("a2") < order.indexOf("a1"), `a2 moved before a1: ${order.join(",")}`);
  const target = computeDropTarget(items, "a2");
  check(target.parentId === "a", "a2 stays under a");
  check(target.nextId === "a1", "a2 drops before a1");
}

// cycle protection
{
  const items = flattenTree(tree, new Set());
  check(wouldCreateCycle(items, "a", "a1") === true, "a under its child a1 rejected");
  check(wouldCreateCycle(items, "a", "a2") === true, "a under its descendant a2 rejected");
  check(wouldCreateCycle(items, "a", "a") === true, "a under itself rejected");
  check(wouldCreateCycle(items, "a1", "a") === false, "a1 under its own parent a allowed (no-op)");
  check(wouldCreateCycle(items, "b", "a") === false, "b under sibling folder a allowed");
}

// drop-into-folder: b dragged right over folder a becomes a's last child
{
  let items = flattenTree(tree, new Set());
  items = applyDragOver(items, "b", "a", 20);
  const b = items.find((i) => i.id === "b")!;
  check(b.depth === 1, `b dropped into a at depth 1 (got ${b.depth})`);
  const order = items.map((i) => i.id);
  check(order.indexOf("a2") < order.indexOf("b"), `b placed after a's children: ${order.join(",")}`);
  const target = computeDropTarget(items, "b");
  check(target.parentId === "a", `b's parent is a (got ${target.parentId})`);
}

// deep nesting: c → under b, then under b1 (folder)
{
  let items = flattenTree(tree, new Set());
  items = applyDragOver(items, "c", "b", 20); // into b
  items = applyDragOver(items, "c", "b1", 20); // into b1
  const c = items.find((i) => i.id === "c")!;
  check(c.depth === 2, `c nested two levels deep (got ${c.depth})`);
  const target = computeDropTarget(items, "c");
  check(target.parentId === "b1", `c's parent is b1 (got ${target.parentId})`);
  check(target.prevId === "b1x", `c drops after b1x (got ${target.prevId})`);
}

if (failures === 0) {
  console.log("All tree-flatten tests passed.");
} else {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
