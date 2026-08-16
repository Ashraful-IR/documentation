import { z } from "zod";
import type { TiptapJson } from "@/db/schema";

/**
 * Lightweight structural check — the editor owns deep JSON validation.
 * Typed as TiptapJson so parsed values flow straight into services.
 */
const tiptapJson: z.ZodType<TiptapJson> = z.custom<TiptapJson>((v) => {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { type?: unknown }).type === "doc"
  );
});

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  content: tiptapJson.optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: tiptapJson.optional(),
  // Server always recomputes contentText from content; nothing to pass here.
});

export const publishDocumentSchema = z.object({
  changeSummary: z.string().max(500).nullable().optional(),
});

export const checkpointSchema = z.object({
  changeSummary: z.string().max(500).nullable().optional(),
});

export const restoreVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
