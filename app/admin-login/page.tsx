import { redirect } from "next/navigation";

export default async function LegacyAdminLogin({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/admin-dashboard") && !params.next.startsWith("//")
    ? params.next
    : "/admin-dashboard";
  redirect("/admin/login?next=" + encodeURIComponent(next));
}
