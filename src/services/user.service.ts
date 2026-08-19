import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, type NewUser } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/token";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http";

const EMAIL_TAKEN = "EMAIL_TAKEN";
const INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
export const USER_NOT_FOUND = "USER_NOT_FOUND";

export async function register(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new ApiError(EMAIL_TAKEN, "An account with this email already exists", 409);
  }
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ name: input.name.trim(), email, passwordHash, role: "VIEWER" })
    .returning();
  return { user: publicUser(user), token: createSessionToken(user.id) };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    // Same error for unknown email vs bad password — no account enumeration.
    throw new ApiError(INVALID_CREDENTIALS, "Invalid email or password", 401);
  }
  return { user: publicUser(user), token: createSessionToken(user.id) };
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(USER_NOT_FOUND, "User not found", 404);
  return user;
}

export function publicUser(user: NewUser & { id: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export async function listUsers(actor: Actor) {
  requirePermission(actor, "users.manage");
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function updateUserRole(actor: Actor, userId: string, role: "ADMIN" | "EDITOR" | "VIEWER") {
  requirePermission(actor, "users.manage");
  if (actor.id === userId && role !== "ADMIN") {
    throw new ApiError("CANNOT_DEMOTE_SELF", "You cannot remove your own admin role", 400);
  }
  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new ApiError(USER_NOT_FOUND, "User not found", 404);
  return publicUser(updated);
}

export async function updateProfile(actorId: string, input: { name?: string }) {
  const [updated] = await db
    .update(users)
    .set({
      ...(input.name ? { name: input.name.trim() } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, actorId))
    .returning();
  if (!updated) throw new ApiError(USER_NOT_FOUND, "User not found", 404);
  return publicUser(updated);
}
