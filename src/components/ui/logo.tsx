import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-8 w-8", className)}>
      <rect width="32" height="32" rx="9" fill="#9b7bff" />
      <path
        d="M6 17.5c2.2 0 2.2-6 4.4-6s2.2 10 4.4 10 2.2-14 4.4-14 2.2 10 4.4 10 2-4 2.4-4"
        fill="none"
        stroke="#0b0b0f"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
