import { z } from "zod";

const navType = z.enum(["FOLDER", "DOCUMENT", "LINK"]);

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(slugPattern, "Slug must be lowercase letters, digits, and hyphens only");

export const createNavigationSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: navType,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  documentId: z.string().uuid().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  // Insert position relative to siblings (optional — defaults to end).
  prevId: z.string().uuid().nullable().optional(),
  nextId: z.string().uuid().nullable().optional(),
});

export const updateNavigationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  linkUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
  isVisible: z.boolean().optional(),
});

export const moveNavigationSchema = z.object({
  parentId: z.string().uuid().nullable(),
  prevId: z.string().uuid().nullable().optional(),
  nextId: z.string().uuid().nullable().optional(),
});

export const createChildSchema = z.object({
  type: navType,
  title: z.string().min(1).max(200),
  slug: slugSchema,
  linkUrl: z.string().url().nullable().optional(),
  prevId: z.string().uuid().nullable().optional(),
  nextId: z.string().uuid().nullable().optional(),
});

export type CreateNavigationInput = z.infer<typeof createNavigationSchema>;
export type UpdateNavigationInput = z.infer<typeof updateNavigationSchema>;
export type MoveNavigationInput = z.infer<typeof moveNavigationSchema>;
