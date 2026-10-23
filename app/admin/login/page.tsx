"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requested = searchParams.get("next") ?? "/admin";
  const destination = requested.startsWith("/admin") && !requested.startsWith("//") && !requested.startsWith("/admin/login") ? requested : "/admin";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to sign in.");
        return;
      }
      setPassword("");
      window.location.assign(data.role === "staff" && destination.startsWith("/admin/settings") ? "/admin" : destination);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-7 border border-white/20 bg-black p-7 sm:p-9">
        <Link href="/" className="text-sm text-red-400">← Big Iron Country Swing</Link>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wide">Admin Login</h1>
          <p className="mt-2 text-sm text-white/60">Enter your owner or authorized staff password.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="admin-password" className="block text-sm font-semibold">Password</label>
          <input id="admin-password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded border border-white/30 bg-[#171717] px-4 py-3 outline-none focus:border-[#c4202f]" />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#c4202f] px-4 py-3 font-bold uppercase disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#0d0d0d]" />}>
    <LoginForm />
  </Suspense>;
}
