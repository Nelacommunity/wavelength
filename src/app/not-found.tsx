import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn't find that"
      body="The song, post or profile may have been removed, or the link is wrong."
      action={<ButtonLink href="/">Back to home</ButtonLink>}
    />
  );
}
