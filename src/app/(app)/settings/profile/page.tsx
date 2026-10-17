import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/social/profile-form";
import { StorageCard } from "@/components/pwa/storage-card";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireUser("/settings/profile");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Edit profile" subtitle="This is how other listeners see you." />
      <ProfileForm profile={user.profile} />
      <StorageCard />
    </div>
  );
}
