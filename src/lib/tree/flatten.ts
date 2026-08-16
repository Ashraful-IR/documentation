import type { NavigationNode } from "@/types";

/**
 * The sidebar renders the tree as a flat, depth-annotated list (the approach
 * used by dnd-kit's own sortable-tree example). All drag & drop math happens
 * on this flat representation; on drop the server receives the resolved
 * { parentId, prevId, nextId } and moves the real subtree.
 *
 * Invariant: a node's descendants are always contiguous in the flat list,
 * immediately after the node itself.
 */

export interface FlatItem {
  id: string;
  parentId: string | null;
  depth: number;
  type: NavigationNode["type"];
  title: string;
  slug: string;
  documentId: string | null;
  linkUrl: string | null;
  isVisible: boolean;
  effectivelyHidden: boolean;
  hasChildren: boolean;
}

/** Flattens a tree, skipping collapsed folders and hidden nodes. */
export function flattenTree(nodes: NavigationNode[], collapsed: ReadonlySet<string>): FlatItem[] {
  const out: FlatItem[] = [];
  const walk = (children: NavigationNode[], depth: number) => {
    for (const n of children) {
      if (n.effectivelyHidden) continue;
      out.push({
        id: n.id,
        parentId: n.parentId,
        depth,
        type: n.type,
        title: n.title,
        slug: n.slug,
        documentId: n.documentId,
        linkUrl: n.linkUrl,
        isVisible: n.isVisible,
        effectivelyHidden: n.effectivelyHidden,
        hasChildren: n.children.some((c) => !c.effectivelyHidden),
      });
      if (n.children.length > 0 && !collapsed.has(n.id)) {
        walk(n.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return out;
}

export function indentWidth(): number {
  return 16;
}

/** Index of the first item after the node's contiguous descendant block. */
function blockEnd(items: FlatItem[], startIndex: number): number {
  const depth = items[startIndex].depth;
  let end = startIndex + 1;
  while (end < items.length && items[end].depth > depth) end++;
  return end;
}

/**
 * Clamps a candidate depth so the item always has a valid parent:
 * depth must be ≤ (nearest preceding item with a shallower depth) + 1,
 * and 0 when nothing precedes it.
 */
function clampDepth(items: FlatItem[], index: number, candidate: number): number {
  let depth = Math.max(0, candidate);
  for (;;) {
    let maxAllowed = 0;
    for (let i = index - 1; i >= 0; i--) {
      if (items[i].depth < depth) {
        maxAllowed = items[i].depth + 1;
        break;
      }
    }
    if (depth <= maxAllowed) return depth;
    depth = maxAllowed;
  }
}

/**
 * Applies a drag-over: moves the active item (with its descendant block) to
 * the over item's position and re-computes depth from the horizontal delta
 * (drag right to indent, left to outdent). Returns a new array; returns the
 * same reference when nothing changes.
 */
export function applyDragOver(
  items: FlatItem[],
  activeId: string,
  overId: string,
  deltaX: number,
): FlatItem[] {
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const overIndex = items.findIndex((i) => i.id === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return items;

  const active = items[activeIndex];
  const end = blockEnd(items, activeIndex);
  // Dropping onto your own subtree is a no-op.
  if (overIndex > activeIndex && overIndex < end) return items;

  const block = items.slice(activeIndex, end);
  const offsets = block.map((i) => i.depth - active.depth);

  const next = [...items];
  next.splice(activeIndex, end - activeIndex);
  const newOverIndex = next.findIndex((i) => i.id === overId);
  if (newOverIndex < 0) return items;
  const overItem = next[newOverIndex];

  // Drag right over a folder ⇒ drop into it as its last child.
  const intoFolder = overItem.hasChildren && deltaX >= indentWidth() / 2;
  let insertAt: number;
  let depth: number;
  if (intoFolder) {
    insertAt = blockEnd(next, newOverIndex);
    depth = overItem.depth + 1;
  } else {
    insertAt = newOverIndex;
    depth = clampDepth(next, insertAt, active.depth + Math.round(deltaX / indentWidth()));
  }
  next.splice(insertAt, 0, ...block);
  return next.map((item) => {
    const idx = block.findIndex((b) => b.id === item.id);
    return idx < 0 ? item : { ...item, depth: depth + offsets[idx] };
  });
}

/**
 * Resolves the drop target from the final flattened order:
 * parent = nearest preceding item at a shallower depth,
 * prev/next = adjacent siblings at the same depth.
 */
export function computeDropTarget(
  items: FlatItem[],
  activeId: string,
): { parentId: string | null; prevId: string | null; nextId: string | null } {
  const index = items.findIndex((i) => i.id === activeId);
  if (index < 0) return { parentId: null, prevId: null, nextId: null };
  const depth = items[index].depth;

  let parentId: string | null = null;
  let prevId: string | null = null;
  let nextId: string | null = null;

  for (let i = index - 1; i >= 0; i--) {
    if (items[i].depth === depth && prevId === null) prevId = items[i].id;
    if (items[i].depth < depth) {
      parentId = items[i].id;
      break;
    }
  }
  for (let i = index + 1; i < items.length; i++) {
    if (items[i].depth === depth) {
      nextId = items[i].id;
      break;
    }
  }
  return { parentId, prevId, nextId };
}

/** True when the target parent is the item itself or one of its descendants. */
export function wouldCreateCycle(items: FlatItem[], activeId: string, targetParentId: string | null): boolean {
  if (!targetParentId || targetParentId === activeId) return targetParentId === activeId;
  const activeIndex = items.findIndex((i) => i.id === activeId);
  if (activeIndex < 0) return false;
  const parentIndex = items.findIndex((i) => i.id === targetParentId);
  if (parentIndex < 0) return false;
  return parentIndex > activeIndex && parentIndex < blockEnd(items, activeIndex);
}
