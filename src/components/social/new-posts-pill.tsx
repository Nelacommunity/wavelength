"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Listens for new posts via Supabase Realtime and offers a refresh. */
export function NewPostsPill({ since }: { since?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "music_posts" }, (payload) => {
        const created = (payload.new as { created_at?: string }).created_at;
        if (!since || !created || created > since) setCount((c) => c + 1);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [since]);

  if (count === 0) return null;
  return (
    <div className="sticky top-16 z-20 flex justify-center lg:top-4">
      <button
        type="button"
        onClick={() => {
          setCount(0);
          router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/50"
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
        {count} new {count === 1 ? "post" : "posts"}
      </button>
    </div>
  );
}
