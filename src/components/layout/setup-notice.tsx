import { Database } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";

export function SetupNotice() {
  return (
    <EmptyState
      icon={Database}
      title="Connect Supabase to get started"
      body={
        <>
          Copy <code className="rounded bg-surface-3 px-1">.env.example</code> to{" "}
          <code className="rounded bg-surface-3 px-1">.env.local</code>, add your Supabase URL and keys, apply the migration in{" "}
          <code className="rounded bg-surface-3 px-1">supabase/migrations</code>, then restart the dev server. See the README for details.
        </>
      }
    />
  );
}
