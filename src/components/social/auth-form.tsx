"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

const field = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-[15px] placeholder:text-subtle focus:border-accent focus:outline-none";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const isLogin = mode === "login";

  if (state?.message) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Go to log in</Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-2xl font-bold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted">{isLogin ? "Log in to share, like and comment." : "Join the community and start sharing music."}</p>

      <form action={action} className="mt-6 space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {!isLogin && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Username</span>
            <input name="username" defaultValue={state?.fields?.username} required autoComplete="username" maxLength={24} placeholder="your_name" className={field} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input name="email" type="email" defaultValue={state?.fields?.email} required autoComplete="email" placeholder="you@example.com" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "••••••••" : "At least 8 characters"}
            className={field}
          />
        </label>

        {state?.error && (
          <p role="alert" className="rounded-lg bg-down/10 px-3 py-2 text-sm text-down">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent font-semibold text-black transition-opacity disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLogin ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isLogin ? "New to Wavelength? " : "Already have an account? "}
        <Link href={isLogin ? `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}` : `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-fg hover:underline">
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
