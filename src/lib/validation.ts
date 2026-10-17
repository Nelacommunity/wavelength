import { z } from "zod";

/** Strip control characters (keeping newlines), collapse blank runs, trim. */
export function cleanText(input: unknown, max: number) {
  return String(input ?? "")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export const uuid = z.string().uuid();
export const providerId = z.string().regex(/^\d{1,15}$/, "Invalid track id");

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,24}$/, "Use 3–24 letters, numbers or underscores");

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  username: usernameSchema,
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(72),
});

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: z.string().max(50),
  bio: z.string().max(280),
  country: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/)]),
});

export const REACTION_KEYS = ["fire", "heart", "headphones", "dance", "chills"] as const;

export function safeNext(next: unknown) {
  const s = String(next ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}
