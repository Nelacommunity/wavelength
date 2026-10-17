import type { Metadata } from "next";
import { AuthForm } from "@/components/social/auth-form";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next) : undefined;
  return (
    <>
      {sp.error === "confirm" && (
        <p role="alert" className="mb-4 rounded-xl bg-down/10 px-4 py-3 text-sm text-down">That confirmation link is invalid or has expired.</p>
      )}
      <AuthForm mode="login" next={next} />
    </>
  );
}
