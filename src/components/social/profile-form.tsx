"use client";

/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { updateProfile, type ProfileState } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { COUNTRIES } from "@/lib/constants";
import type { Profile } from "@/lib/types";

const field = "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] placeholder:text-subtle focus:border-accent focus:outline-none";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-4">
        {preview ? (
          <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <Avatar user={profile} size={80} />
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold hover:border-fg/60">
          <ImagePlus className="h-4 w-4" aria-hidden />
          Change photo
          <input
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2 * 1024 * 1024) {
                setFileError("Image must be 2 MB or smaller.");
                e.target.value = "";
                return;
              }
              setFileError(null);
              setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
      </div>
      {fileError && <p className="text-sm text-down">{fileError}</p>}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Display name</span>
        <input name="display_name" defaultValue={profile.display_name ?? ""} maxLength={50} className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Username</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">@</span>
          <input name="username" defaultValue={profile.username} required pattern="[A-Za-z0-9_]{3,24}" maxLength={24} className={`${field} pl-8`} />
        </div>
        <span className="mt-1 block text-xs text-subtle">3–24 letters, numbers or underscores.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-medium">
          Bio <span className="font-normal text-subtle">{bio.length}/280</span>
        </span>
        <textarea name="bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={3} className={`${field} resize-none`} placeholder="What do you listen to?" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Country</span>
        <select name="country" defaultValue={profile.country ?? ""} className={field}>
          <option value="">Prefer not to say</option>
          {Object.entries(COUNTRIES).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-subtle">Used for regional trending charts.</span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
      <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent font-semibold text-black disabled:opacity-50">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
