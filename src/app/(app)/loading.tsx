import { Skeleton } from "@/components/ui/misc";
import { FeedSkeleton, ShelfSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <ShelfSkeleton />
      <div className="max-w-2xl">
        <FeedSkeleton count={2} />
      </div>
    </div>
  );
}
