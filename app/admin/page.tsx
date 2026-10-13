import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("id,name,slug,active")
    .order("name");

  return (
    <main className="min-h-screen bg-[#0d0d0d] p-6 text-white sm:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/" className="text-red-400">← Big Iron Home</Link>
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-white/60">Choose a management page or an event.</p>
        </div>
        <nav className="grid gap-4 sm:grid-cols-2" aria-label="Admin pages">
          <Link href="/admin/settings" className="rounded-xl border border-white/20 p-5 hover:border-red-400">
            <h2 className="text-xl font-semibold">Settings</h2>
            <p className="mt-2 text-sm text-white/60">Spotify accounts and access passwords (owner only).</p>
          </Link>
          <Link href="/admin/analytics" className="rounded-xl border border-white/20 p-5 hover:border-red-400">
            <h2 className="text-xl font-semibold">Analytics</h2>
            <p className="mt-2 text-sm text-white/60">Song requests, votes and event activity.</p>
          </Link>
        </nav>
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Events</h2>
          {error ? <p role="alert" className="text-red-400">Unable to load events.</p> : null}
          {!error && !events?.length ? <p className="text-white/60">No events found.</p> : null}
          <div className="grid gap-3">
            {(events ?? []).map(event => (
              <Link key={event.id} href={`/admin/${encodeURIComponent(event.slug)}`}
                className="flex items-center justify-between rounded-lg border border-white/20 p-4 hover:border-red-400">
                <span>{event.name}</span>
                <span className="text-sm text-white/60">{event.active ? "Active" : "Inactive"} →</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
