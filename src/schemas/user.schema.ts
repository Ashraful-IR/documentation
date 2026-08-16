import { z } from "zod";

export const emailSchema = z.string().email().max(254);

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
