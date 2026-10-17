export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export function friendlyError(error: { code?: string; message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code === "P0429") return error.message ?? "You're doing that too often. Try again shortly.";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501") return "You don't have permission to do that.";
  return fallback;
}
