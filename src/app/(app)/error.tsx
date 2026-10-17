"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      body="We couldn't load this page. It may be a temporary problem — try again in a moment."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
