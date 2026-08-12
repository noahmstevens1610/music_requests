"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setError("Enter the admin password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to sign in.");
      }

      const requestedDestination = searchParams.get("next");

      const destination =
        requestedDestination?.startsWith("/admin-dashboard") &&
        !requestedDestination.startsWith("/admin-login")
          ? requestedDestination
          : "/admin-dashboard";

      router.replace(destination);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md border border-[#c4202f]/55 bg-[#0d0d0d] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/35">
          Big Iron
        </p>

        <h1 className="font-heading mt-3 text-4xl uppercase tracking-[0.06em]">
          DJ Dashboard Login
        </h1>

        <p className="mt-2 text-white/45">
          Enter the host password to manage song requests.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/70">
              Password
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              autoFocus
              placeholder="Enter password"
              className="w-full  border border-white/15 bg-black px-4 py-3 text-white outline-none transition focus:border-[#c4202f]"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-4  border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="font-heading mt-6 w-full border border-[#c4202f] bg-[#c4202f] px-4 py-3 text-xl uppercase tracking-[0.08em] text-white transition hover:bg-[#d9293a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Signing in..." : "Open Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <p className="text-white/45">Loading login...</p>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}