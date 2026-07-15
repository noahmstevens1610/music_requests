"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LineDance = {
  id: string;
  name: string;
  also_known_as: string | null;
  created_at: string;
  updated_at: string;
};

export default function LineDancesPage() {
  const router = useRouter();

  const [lineDances, setLineDances] = useState<LineDance[]>([]);
  const [name, setName] = useState("");
  const [alsoKnownAs, setAlsoKnownAs] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadLineDances() {
    try {
      setError("");

      const response = await fetch("/api/admin/line-dances", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load line dances."
        );
      }

      setLineDances(data.lineDances ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load line dances."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createLineDance(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setError("");
      setMessage("");
      setSaving(true);

      const response = await fetch("/api/admin/line-dances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          alsoKnownAs,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to create line dance."
        );
      }

      const newLineDance = data.lineDance as LineDance;

      setLineDances((current) =>
        [...current, newLineDance].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setName("");
      setAlsoKnownAs("");
      setMessage(`"${newLineDance.name}" was created.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create line dance."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeLineDance(lineDance: LineDance) {
    const confirmed = window.confirm(
      `Remove "${lineDance.name}"? This may also remove its associated song connections.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setDeletingId(lineDance.id);

      const response = await fetch("/api/admin/line-dances", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineDanceId: lineDance.id,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to remove line dance."
        );
      }

      setLineDances((current) =>
        current.filter((item) => item.id !== lineDance.id)
      );

      setMessage(`"${lineDance.name}" was removed.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to remove line dance."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    window.location.href = "/admin/login";
  }

  useEffect(() => {
    void loadLineDances();
  }, []);

  return (
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <header className="mx-auto mb-8 flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">
            Line Dance Manager
          </h1>

          <p className="mt-2 text-neutral-400">
            Create dances and manage their associated songs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:bg-neutral-800"
          >
            Back
          </button>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:bg-neutral-800"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-500/40 bg-green-950/40 p-4 text-green-200">
            {message}
          </div>
        )}

        <section className="mb-10 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
          <h2 className="text-2xl font-bold">
            Line Dance Choreography Name
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Create the dance first. Songs will then be assigned to it.
          </p>

          <form
            onSubmit={createLineDance}
            className="mt-6 grid gap-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-300">
                Line Dance Choreography Name
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Dance Name Here"
                required
                className="w-full rounded-xl border border-neutral-700 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-300">
                Also Known As
              </span>

              <input
                type="text"
                value={alsoKnownAs}
                onChange={(event) =>
                  setAlsoKnownAs(event.target.value)
                }
                placeholder="Alternate Name 1, Alternate Name 2"
                className="w-full rounded-xl border border-neutral-700 bg-black px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              />

              <span className="mt-2 block text-sm text-neutral-500">
                Separate each alternate name with a comma.
              </span>
            </label>

            <div>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Line Dance"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Your Line Dances
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                {lineDances.length}{" "}
                {lineDances.length === 1 ? "dance" : "dances"}
              </p>
            </div>

            <button
              type="button"
              onClick={loadLineDances}
              disabled={loading}
              className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-neutral-400">
              Loading line dances...
            </p>
          ) : lineDances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
              <p className="text-lg font-semibold text-neutral-300">
                No line dances yet
              </p>

              <p className="mt-2 text-neutral-500">
                Create your first dance using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {lineDances.map((lineDance) => (
                <article
                  key={lineDance.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
                >
                  <h3 className="text-xl font-bold">
                    {lineDance.name}
                  </h3>

                  {lineDance.also_known_as ? (
                    <div className="mt-3">
                      <p className="mb-2 text-sm text-neutral-400">
                        Also known as:
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {lineDance.also_known_as
                          .split(",")
                          .map((alternateName) =>
                            alternateName.trim()
                          )
                          .filter(Boolean)
                          .map((alternateName) => (
                            <span
                              key={alternateName}
                              className="rounded-full border border-neutral-700 bg-black px-3 py-1 text-sm text-neutral-300"
                            >
                              {alternateName}
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-600">
                      No alternate names
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/admin/line-dances/${lineDance.id}`
                        )
                      }
                      className="rounded-xl bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500"
                    >
                      Manage Songs
                    </button>

                    <button
                      type="button"
                      onClick={() => removeLineDance(lineDance)}
                      disabled={deletingId === lineDance.id}
                      className="rounded-xl border border-red-500/50 px-4 py-2 font-semibold text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === lineDance.id
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}