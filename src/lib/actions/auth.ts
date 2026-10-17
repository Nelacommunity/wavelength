"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { safeNext, signInSchema, signUpSchema } from "@/lib/validation";

export type AuthState = { error?: string; message?: string; fields?: Record<string, string> } | undefined;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", fields };
    if (/confirm/i.test(error.message)) return { error: "Confirm your email address first — check your inbox.", fields };
    return { error: "Incorrect email or password.", fields };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
  };
  const fields = { email: String(raw.email ?? ""), username: String(raw.username ?? "") };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { data: taken } = await supabase.from("profiles").select("id").eq("username", parsed.data.username).maybeSingle();
  if (taken) return { error: "That username is taken.", fields };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { username: parsed.data.username },
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });
  if (error) {
    if (error.status === 429) return { error: "Too many sign-up attempts. Try again later.", fields };
    if (/registered|exists/i.test(error.message)) return { error: "An account with that email already exists.", fields };
    if (/password/i.test(error.message)) return { error: error.message, fields };
    return { error: "Could not create your account. Please try again.", fields };
  }
  if (!data.session) {
    return { message: "Almost there — check your email to confirm your account, then log in." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
