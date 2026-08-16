import type { DocumentRow, NavigationRow, UserRow } from "@/db/schema";

export type NavType = "FOLDER" | "DOCUMENT" | "LINK";
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";
export type DocumentStatus = "DRAFT" | "PUBLISHED";
export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "failed";

/** Navigation node as exposed to the UI (tree shape). */
export interface NavigationNode {
  id: string;
  parentId: string | null;
  type: NavType;
  title: string;
  slug: string;
  documentId: string | null;
  linkUrl: string | null;
  icon: string | null;
  description: string | null;
  isVisible: boolean;
  sortKey: string;
  deletedAt: string | null;
  children: NavigationNode[];
  /** True when the item itself or an ancestor is hidden. */
  effectivelyHidden: boolean;
}

export interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  currentVersion: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: unknown;
  contentText: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface DocumentVersionSummary {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface SearchResult {
  type: "document" | "navigation";
  id: string;
  title: string;
  excerpt: string;
  url: string;
  rank?: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
}

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export type { NavigationRow, DocumentRow, UserRow };
