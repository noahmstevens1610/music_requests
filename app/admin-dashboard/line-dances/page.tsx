"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LineDance = {
  id: string;
  name: string;
  also_known_as: string | null;
  created_at: string;
  updated_at: string;
  song_names: string[];
};

export default function LineDancesPage() {
  const router = useRouter();

  const [lineDances, setLineDances] = useState<LineDance[]>([]);
  const [name, setName] = useState("");
  const [alsoKnownAs, setAlsoKnownAs] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlsoKnownAs, setEditAlsoKnownAs] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [songSearchWarning, setSongSearchWarning] = useState("");

  async function readJsonResponse(response: Response) {
    const responseText = await response.text();

    if (!responseText.trim()) {
      return {};
    }

    try {
      return JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return {
        error:
          response.status === 404
            ? "The requested API route was not found."
            : "The server returned an invalid response.",
      };
    }
  }

  async function loadSongSearchIndex() {
    try {
      setSongSearchWarning("");

      const response = await fetch(
        "/api/admin/line-dances/search-index",
        {
          cache: "no-store",
        }
      );

      const data = await readJsonResponse(response);

      if (response.status === 401) {
        router.push("/admin-login");
        return;
      }

      if (!response.ok) {
        setSongSearchWarning(
          "Saved dances are loaded, but song-title search is temporarily unavailable."
        );
        return;
      }

      const songNamesByDance = new Map<
        string,
        string[]
      >();

      const songs = Array.isArray(data.songs)
        ? data.songs
        : [];

      for (const song of songs) {
        if (
          typeof song !== "object" ||
          song === null
        ) {
          continue;
        }

        const lineDanceId =
          "line_dance_id" in song &&
          typeof song.line_dance_id === "string"
            ? song.line_dance_id
            : null;

        const trackName =
          "track_name" in song &&
          typeof song.track_name === "string"
            ? song.track_name
            : null;

        if (!lineDanceId || !trackName) {
          continue;
        }

        const currentNames =
          songNamesByDance.get(lineDanceId) ?? [];

        currentNames.push(trackName);
        songNamesByDance.set(
          lineDanceId,
          currentNames
        );
      }

      setLineDances((current) =>
        current.map((lineDance) => ({
          ...lineDance,
          song_names:
            songNamesByDance.get(lineDance.id) ?? [],
        }))
      );
    } catch {
      setSongSearchWarning(
        "Saved dances are loaded, but song-title search is temporarily unavailable."
      );
    }
  }

  async function loadLineDances() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/line-dances",
        {
          cache: "no-store",
        }
      );

      const data = await readJsonResponse(response);

      if (response.status === 401) {
        router.push("/admin-login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Unable to load line dances."
        );
      }

      const loadedLineDances = Array.isArray(
        data.lineDances
      )
        ? data.lineDances
        : [];

      setLineDances(
        loadedLineDances.map((lineDance) => ({
          ...(lineDance as Omit<
            LineDance,
            "song_names"
          >),
          song_names: [],
        }))
      );

      void loadSongSearchIndex();
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
        router.push("/admin-login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to create line dance."
        );
      }

      const newLineDance = {
        ...(data.lineDance as Omit<
          LineDance,
          "song_names"
        >),
        song_names: [],
      };

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

  function beginEditing(lineDance: LineDance) {
    setEditingId(lineDance.id);
    setEditName(lineDance.name);
    setEditAlsoKnownAs(lineDance.also_known_as ?? "");
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditAlsoKnownAs("");
  }

  async function updateLineDance(lineDance: LineDance) {
    const cleanedName = editName.trim();

    if (!cleanedName) {
      setError("Enter a choreography name.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setUpdatingId(lineDance.id);

      const response = await fetch(
        `/api/admin/line-dances/${lineDance.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanedName,
            alsoKnownAs: editAlsoKnownAs,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        router.push("/admin-login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to update line dance."
        );
      }

      const updatedLineDance =
        data.lineDance as Omit<
          LineDance,
          "song_names"
        >;

      setLineDances((current) =>
        current
          .map((item) =>
            item.id === updatedLineDance.id
              ? {
                  ...updatedLineDance,
                  song_names: item.song_names,
                }
              : item
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setMessage(
        `"${updatedLineDance.name}" was updated.`
      );
      cancelEditing();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update line dance."
      );
    } finally {
      setUpdatingId(null);
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
        router.push("/admin-login");
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

  const filteredLineDances = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLocaleLowerCase();

    if (!normalizedQuery) {
      return lineDances;
    }

    return lineDances.filter((lineDance) => {
      const searchableValues = [
        lineDance.name,
        lineDance.also_known_as ?? "",
        ...lineDance.song_names,
      ];

      return searchableValues.some((value) =>
        value
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      );
    });
  }, [lineDances, searchQuery]);

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    window.location.href = "/admin-login";
  }

  useEffect(() => {
    void loadLineDances();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-12 pt-8 text-white sm:px-6 sm:pb-16 sm:pt-10">

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
              Dance Library
            </p>

            <h1 className="font-heading mt-2 text-5xl uppercase leading-none tracking-[0.035em] text-white sm:text-7xl">
              Line Dance Manager
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
              Create choreography entries, manage alternate names, and connect
              each dance to its Spotify songs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="font-heading  border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.07em] text-white/70 transition hover:border-white/40 hover:bg-white/5 hover:text-white"
            >
              Back
            </button>

            <button
              type="button"
              onClick={logout}
              className="font-heading  border-2 border-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.07em] text-white transition hover:bg-[#c4202f]"
            >
              Log Out
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-6 border-l-4 border-[#c4202f] bg-[#c4202f]/10 px-5 py-4 text-red-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-6 border-l-4 border-white/40 bg-white/5 px-5 py-4 text-white/80">
            {message}
          </div>
        ) : null}

        {songSearchWarning ? (
          <div className="mt-4 border-l-4 border-white/20 bg-white/[0.035] px-5 py-3 text-sm text-white/45">
            {songSearchWarning}
          </div>
        ) : null}

        <section className="mt-10 border border-[#c4202f]/50 bg-[#0d0d0d]">
          <div className="border-b border-white/15 px-5 py-5 sm:px-7">
            <p className="font-heading text-xs uppercase tracking-[0.18em] text-[#c4202f]">
              New Entry
            </p>

            <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
              Add Choreography
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Create the dance first. Songs can then be assigned from its
              management page.
            </p>
          </div>

          <form
            onSubmit={createLineDance}
            className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2"
          >
            <label className="block">
              <span className="font-heading mb-2 block text-sm uppercase tracking-[0.08em] text-white/65">
                Choreography Name
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Dance Name Here"
                required
                className="w-full border-2 border-white/15 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#c4202f]"
              />
            </label>

            <label className="block">
              <span className="font-heading mb-2 block text-sm uppercase tracking-[0.08em] text-white/65">
                Also Known As
              </span>

              <input
                type="text"
                value={alsoKnownAs}
                onChange={(event) => setAlsoKnownAs(event.target.value)}
                placeholder="Alternate Name 1, Alternate Name 2"
                className="w-full border-2 border-white/15 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#c4202f]"
              />

              <span className="mt-2 block text-xs text-white/30">
                Separate alternate names with commas.
              </span>
            </label>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="font-heading  border-2 border-[#c4202f] bg-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.07em] text-white transition hover:bg-[#df2939] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create Line Dance"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-12">
          <div className="flex items-end justify-between gap-4 border-b-2 border-[#c4202f] pb-4">
            <div>
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-[#c4202f]">
                Choreography Library
              </p>

              <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
                Your Line Dances
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-heading text-xl text-white/35">
                {lineDances.length}
              </span>

              <button
                type="button"
                onClick={loadLineDances}
                disabled={loading}
                className="font-heading  border-2 border-white/20 px-4 py-2 text-sm uppercase tracking-[0.07em] text-white/65 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="border-b border-white/15 py-5 sm:px-3">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search dance name, AKA, or song title"
                autoComplete="off"
                className="w-full border-2 border-white/15 bg-black px-4 py-3 pr-12 text-white outline-none transition placeholder:text-white/25 focus:border-[#c4202f]"
              />

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear line dance search"
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center  text-2xl text-white/45 transition hover:bg-[#c4202f] hover:text-white"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/35">
              <p>
                Search by choreography, alternate name,
                or connected song.
              </p>

              <p className="font-heading uppercase tracking-[0.08em]">
                {filteredLineDances.length} of{" "}
                {lineDances.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="border-b border-white/15 py-14 text-center">
              <p className="font-heading text-2xl uppercase tracking-[0.08em] text-white/30">
                Loading Line Dances…
              </p>
            </div>
          ) : lineDances.length === 0 ? (
            <div className="border border-dashed border-white/20 bg-[#0d0d0d] px-6 py-16 text-center">
              <p className="font-heading text-3xl uppercase tracking-[0.06em] text-white/25">
                No Line Dances
              </p>

              <p className="mt-3 text-sm text-white/35">
                Create your first dance using the form above.
              </p>
            </div>
          ) : filteredLineDances.length === 0 ? (
            <div className="border border-dashed border-white/20 bg-[#0d0d0d] px-6 py-16 text-center">
              <p className="font-heading text-3xl uppercase tracking-[0.06em] text-white/25">
                No Matches
              </p>

              <p className="mt-3 text-sm text-white/35">
                No choreography, AKA name, or connected
                song matches “{searchQuery.trim()}”.
              </p>
            </div>
          ) : (
            <div>
              {filteredLineDances.map((lineDance, index) => {
                const alternateNames =
                  lineDance.also_known_as
                    ?.split(",")
                    .map((alternateName) =>
                      alternateName.trim()
                    )
                    .filter(Boolean) ?? [];

                const isEditing =
                  editingId === lineDance.id;
                const isUpdating =
                  updatingId === lineDance.id;

                return (
                  <article
                    key={lineDance.id}
                    className="group grid gap-4 border-b border-white/15 px-1 py-6 transition hover:bg-white/[0.025] sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-start sm:gap-5 sm:px-3"
                  >
                    <div className="font-heading grid h-12 w-12 place-items-center  bg-[#c4202f] text-2xl text-white">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    {isEditing ? (
                      <div className="grid min-w-0 gap-4">
                        <label className="block">
                          <span className="font-heading mb-2 block text-xs uppercase tracking-[0.08em] text-white/50">
                            Choreography Name
                          </span>

                          <input
                            type="text"
                            value={editName}
                            onChange={(event) =>
                              setEditName(
                                event.target.value
                              )
                            }
                            disabled={isUpdating}
                            autoFocus
                            className="w-full border-2 border-white/15 bg-black px-4 py-3 text-white outline-none transition focus:border-[#c4202f] disabled:opacity-50"
                          />
                        </label>

                        <label className="block">
                          <span className="font-heading mb-2 block text-xs uppercase tracking-[0.08em] text-white/50">
                            Also Known As
                          </span>

                          <input
                            type="text"
                            value={editAlsoKnownAs}
                            onChange={(event) =>
                              setEditAlsoKnownAs(
                                event.target.value
                              )
                            }
                            disabled={isUpdating}
                            placeholder="Alternate Name 1, Alternate Name 2"
                            className="w-full border-2 border-white/15 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#c4202f] disabled:opacity-50"
                          />

                          <span className="mt-2 block text-xs text-white/30">
                            Separate alternate names
                            with commas. Delete all text
                            to remove every AKA name.
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <h3 className="font-heading truncate text-xl font-black text-white sm:text-2xl">
                          {lineDance.name}
                        </h3>

                        {alternateNames.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {alternateNames.map(
                              (alternateName) => (
                                <span
                                  key={alternateName}
                                  className="font-heading border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.06em] text-white/50"
                                >
                                  {alternateName}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-white/25">
                            No alternate names
                          </p>
                        )}

                        {lineDance.song_names.length > 0 ? (
                          <div className="mt-4">
                            <p className="font-heading text-[10px] uppercase tracking-[0.12em] text-[#c4202f]">
                              Connected Songs
                            </p>

                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/40">
                              {lineDance.song_names.join(", ")}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-white/20">
                            No connected songs
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void updateLineDance(
                                lineDance
                              )
                            }
                            disabled={
                              isUpdating ||
                              !editName.trim()
                            }
                            className="font-heading  border-2 border-[#c4202f] bg-[#c4202f] px-4 py-2.5 text-sm uppercase tracking-[0.07em] text-white transition hover:bg-[#df2939] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isUpdating
                              ? "Saving…"
                              : "Save"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isUpdating}
                            className="font-heading  border-2 border-white/20 px-4 py-2.5 text-sm uppercase tracking-[0.07em] text-white/65 transition hover:border-white/40 hover:bg-white/5 hover:text-white disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              beginEditing(lineDance)
                            }
                            disabled={
                              editingId !== null
                            }
                            className="font-heading  border-2 border-white/20 px-4 py-2.5 text-sm uppercase tracking-[0.07em] text-white/65 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/admin-dashboard/line-dances/${lineDance.id}`
                              )
                            }
                            className="font-heading  border-2 border-[#c4202f] bg-[#c4202f] px-4 py-2.5 text-sm uppercase tracking-[0.07em] text-white transition hover:bg-[#df2939]"
                          >
                            Manage Songs
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeLineDance(lineDance)
                            }
                            disabled={
                              deletingId ===
                                lineDance.id ||
                              editingId !== null
                            }
                            aria-label={`Remove ${lineDance.name}`}
                            title="Remove"
                            className="grid h-11 w-11 place-items-center  border-2 border-white/20 text-2xl font-bold leading-none text-white/65 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingId ===
                            lineDance.id ? (
                              <span className="text-xs">
                                •••
                              </span>
                            ) : (
                              <span aria-hidden="true">
                                ×
                              </span>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}