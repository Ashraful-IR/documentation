"use client";

import { useCallback, useEffect, useState } from "react";

import { Api, ClientError } from "@/lib/api/client";
import type { NavigationNode } from "@/types";

export interface TreeMutations {
  refresh: () => Promise<void>;
  createNode: (input: { parentId: string | null; type: "FOLDER" | "DOCUMENT" | "LINK"; title: string; slug: string; linkUrl?: string | null }) => Promise<void>;
  updateNode: (id: string, patch: Record<string, unknown>) => Promise<void>;
  moveNode: (id: string, target: { parentId: string | null; prevId?: string | null; nextId?: string | null }) => Promise<void>;
  deleteNode: (id: string, permanent?: boolean) => Promise<void>;
  restoreNode: (id: string) => Promise<void>;
  duplicateNode: (id: string) => Promise<void>;
}

export function useNavigation() {
  const [tree, setTree] = useState<NavigationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await Api.getTree();
      setTree(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "Failed to load navigation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutations: TreeMutations = {
    refresh,
    createNode: async (input) => {
      await Api.createNode(input);
      await refresh();
    },
    updateNode: async (id, patch) => {
      await Api.updateNode(id, patch);
      await refresh();
    },
    moveNode: async (id, target) => {
      await Api.moveNode(id, target);
      await refresh();
    },
    deleteNode: async (id, permanent = false) => {
      await Api.deleteNode(id, permanent);
      await refresh();
    },
    restoreNode: async (id) => {
      await Api.restoreNode(id);
      await refresh();
    },
    duplicateNode: async (id) => {
      await Api.duplicateNode(id);
      await refresh();
    },
  };

  return { tree, loading, error, ...mutations };
}
