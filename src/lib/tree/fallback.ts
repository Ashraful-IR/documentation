import type { NavigationNode } from "@/types";

/**
 * Post-delete fallback navigation.
 *
 * When a node is deleted from the sidebar while its page is open (or its URL
 * is requested later), the app should show the next document instead of a
 * stale page or a 404. Soft-delete cascades to the whole subtree, so the
 * candidates are computed from display order (depth-first, sibling order):
 *
 *   1. the first node after the deleted subtree (next sibling, or the nearest
 *      ancestor's next sibling),
 *   2. otherwise the last node before it (previous sibling / ancestor),
 *   3. otherwise null — nothing left, caller falls back to the docs root.
 */

/** Display-order ids for a tree (depth-first, siblings in order, hidden nodes skipped). */
function flattenIds(nodes: NavigationNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.effectivelyHidden) continue;
    out.push(n.id);
    flattenIds(n.children, out);
  }
  return out;
}

/** The node's own id plus every descendant id. */
function subtreeIds(nodes: NavigationNode[], id: string): Set<string> {
  const gone = new Set<string>();
  const walk = (list: NavigationNode[], inside: boolean) => {
    for (const n of list) {
      const inSubtree = inside || n.id === id;
      if (inSubtree) gone.add(n.id);
      walk(n.children, inSubtree);
    }
  };
  walk(nodes, false);
  return gone;
}

/**
 * Returns the id of the node to show after `deletedId` is removed from
 * `tree` (which still contains it), or null when nothing remains.
 */
export function findFallbackAfterDelete(tree: NavigationNode[], deletedId: string): string | null {
  const order = flattenIds(tree);
  const index = order.indexOf(deletedId);
  if (index < 0) return null;
  // Descendants are soft-deleted along with the node, so skip them.
  const gone = subtreeIds(tree, deletedId);
  for (let i = index + 1; i < order.length; i++) {
    if (!gone.has(order[i])) return order[i];
  }
  for (let i = index - 1; i >= 0; i--) {
    if (!gone.has(order[i])) return order[i];
  }
  return null;
}

/**
 * Inserts a node back into its parent's children (or the root list) sorted
 * by `sortKey`. Used server-side to reconstruct the tree position of a node
 * that is no longer in the visible tree so the fallback can be computed.
 */
export function insertNodeAtSortKey(nodes: NavigationNode[], node: NavigationNode): NavigationNode[] {
  const sorted = (list: NavigationNode[]) =>
    [...list, node].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  if (!node.parentId) return sorted(nodes);

  const walk = (list: NavigationNode[]): NavigationNode[] =>
    list.map((n) =>
      n.id === node.parentId
        ? { ...n, children: sorted(n.children) }
        : { ...n, children: walk(n.children) },
    );

  return walk(nodes);
}
