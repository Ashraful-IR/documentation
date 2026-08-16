import type { UserRow } from "@/db/schema";
import { ApiError } from "../http";

export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";

export const PERMISSIONS = {
  READ: "documentation.read",
  CREATE: "documentation.create",
  UPDATE: "documentation.update",
  PUBLISH: "documentation.publish",
  DELETE: "documentation.delete",
  NAV_CREATE: "navigation.create",
  NAV_UPDATE: "navigation.update",
  NAV_DELETE: "navigation.delete",
  MANAGE_USERS: "users.manage",
  MANAGE_MEDIA: "media.manage",
  VIEW_AUDIT: "audit.view",
} as const;

const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  ADMIN: [
    PERMISSIONS.READ,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.PUBLISH,
    PERMISSIONS.DELETE,
    PERMISSIONS.NAV_CREATE,
    PERMISSIONS.NAV_UPDATE,
    PERMISSIONS.NAV_DELETE,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_MEDIA,
    PERMISSIONS.VIEW_AUDIT,
  ],
  EDITOR: [
    PERMISSIONS.READ,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.PUBLISH,
    PERMISSIONS.DELETE,
    PERMISSIONS.NAV_CREATE,
    PERMISSIONS.NAV_UPDATE,
    PERMISSIONS.NAV_DELETE,
    PERMISSIONS.MANAGE_MEDIA,
  ],
  VIEWER: [PERMISSIONS.READ],
};

export interface Actor {
  id: string;
  role: UserRole;
}

export function can(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Throws ApiError(403) unless the actor holds the permission. */
export function requirePermission(actor: Actor, permission: string): void {
  if (!can(actor.role, permission)) {
    throw new ApiError("FORBIDDEN", `Missing permission: ${permission}`, 403);
  }
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === "ADMIN";
}

export function toActor(user: Pick<UserRow, "id" | "role">): Actor {
  return { id: user.id, role: user.role };
}
