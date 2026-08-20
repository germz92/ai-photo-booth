import { redirect } from "next/navigation";

export default async function BrandingSettingsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/events/${id}/settings?tab=branding`);
}
