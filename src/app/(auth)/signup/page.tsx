import type { Metadata } from "next";
import { AuthForm } from "@/components/social/auth-form";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next) : undefined;
  return <AuthForm mode="signup" next={next} />;
}
