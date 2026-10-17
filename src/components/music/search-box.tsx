import Form from "next/form";
import { Search } from "lucide-react";

export function SearchBox({ defaultValue, type }: { defaultValue?: string; type?: string }) {
  return (
    <Form action="/discover" className="relative" role="search">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        name="q"
        defaultValue={defaultValue}
        maxLength={100}
        autoComplete="off"
        placeholder="Search songs, artists or albums"
        aria-label="Search songs, artists or albums"
        className="h-12 w-full rounded-full border border-line bg-surface-2 pl-12 pr-24 text-[15px] placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {type && type !== "songs" && <input type="hidden" name="type" value={type} />}
      <button type="submit" className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full bg-fg px-4 text-sm font-semibold text-black">
        Search
      </button>
    </Form>
  );
}
