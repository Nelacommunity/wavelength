"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFollow } from "@/lib/actions/social";
import { buttonClass } from "@/components/ui/button";

export function FollowButton({
  userId,
  initial,
  signedIn,
  size = "sm",
}: {
  userId: string;
  initial: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? undefined}
      aria-pressed={following}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        const next = !following;
        setFollowing(next);
        start(async () => {
          const res = await setFollow(userId, next);
          if (!res.ok) {
            setFollowing(!next);
            setError(res.error);
          } else {
            setError(null);
            router.refresh();
          }
        });
      }}
      className={buttonClass(following ? "outline" : "primary", size, "min-w-[5.5rem]")}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
