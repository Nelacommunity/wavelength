import { Segmented } from "@/components/ui/misc";

export function InsightsTabs({ active }: { active: "trending" | "stats" }) {
  return (
    <Segmented
      items={[
        { href: "/trending", label: "Rankings", active: active === "trending" },
        { href: "/stats", label: "Listener stats", active: active === "stats" },
      ]}
    />
  );
}
