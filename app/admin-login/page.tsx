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
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-neutral-500">
          Big Iron
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          DJ Dashboard Login
        </h1>

        <p className="mt-2 text-neutral-400">
          Enter the host password to manage song requests.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-300">
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
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none transition focus:border-white"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="mt-6 w-full rounded-xl bg-white px-4 py-3 font-bold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
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
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <p className="text-neutral-400">Loading login...</p>
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