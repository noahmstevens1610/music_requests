"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

type LineDance = {
  id: string;
  name: string;
  also_known_as: string | null;
  created_at?: string;
  updated_at?: string;
};

type LinkedSong = {
  id: string;
  line_dance_id: string;
  spotify_track_id: string;
  spotify_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  is_original_song: boolean;
  created_at?: string;
  updated_at?: string;
};

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
};

export default function LineDanceSongsPage() {
  const router = useRouter();

  const params = useParams<{
    id: string;
  }>();

  const lineDanceId = params.id;

  const [lineDance, setLineDance] =
    useState<LineDance | null>(null);

  const [songs, setSongs] =
    useState<LinkedSong[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<SpotifyTrack[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [searching, setSearching] =
    useState(false);

  const [addingTrackId, setAddingTrackId] =
    useState<string | null>(null);

  const [updatingSongId, setUpdatingSongId] =
    useState<string | null>(null);

  const [deletingSongId, setDeletingSongId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const handleUnauthorized = useCallback(
    (status: number) => {
      if (status === 401) {
        router.push("/admin-login");
        return true;
      }

      return false;
    },
    [router]
  );

  const loadDanceAndSongs =
    useCallback(async () => {
      if (!lineDanceId) {
        return;
      }

      try {
        setError("");

        const response = await fetch(
          `/api/admin/line-dances/${lineDanceId}/songs`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (
          handleUnauthorized(response.status)
        ) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to load line dance."
          );
        }

        setLineDance(data.lineDance);
        setSongs(
          sortSongs(data.songs ?? [])
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load line dance."
        );
      } finally {
        setLoading(false);
      }
    }, [
      handleUnauthorized,
      lineDanceId,
    ]);

  const searchSpotify = useCallback(
    async (
      query: string,
      signal?: AbortSignal
    ) => {
      const trimmedQuery =
        query.trim();

      if (trimmedQuery.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      try {
        setError("");
        setSearching(true);

        const response = await fetch(
          `/api/admin/spotify/search?q=${encodeURIComponent(
            trimmedQuery
          )}`,
          {
            cache: "no-store",
            signal,
          }
        );

        const data = await response.json();

        if (
          handleUnauthorized(response.status)
        ) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to search Spotify."
          );
        }

        setSearchResults(
          data.tracks ?? []
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setSearchResults([]);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to search Spotify."
        );
      } finally {
        if (!signal?.aborted) {
          setSearching(false);
        }
      }
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    void loadDanceAndSongs();
  }, [loadDanceAndSongs]);

  useEffect(() => {
    const trimmedQuery =
      searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        void searchSpotify(
          trimmedQuery,
          controller.signal
        );
      }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    searchQuery,
    searchSpotify,
  ]);

  async function addSong(
    track: SpotifyTrack
  ) {
    try {
      setError("");
      setMessage("");
      setAddingTrackId(track.id);

      const response = await fetch(
        `/api/admin/line-dances/${lineDanceId}/songs`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            track,
          }),
        }
      );

      const data = await response.json();

      if (
        handleUnauthorized(response.status)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to add song."
        );
      }

      const newSong =
        data.song as LinkedSong;

      setSongs((current) =>
        sortSongs([
          ...current,
          newSong,
        ])
      );

      setMessage(
        `"${newSong.track_name}" was connected to this line dance.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add song."
      );
    } finally {
      setAddingTrackId(null);
    }
  }

  async function makeOriginal(
    song: LinkedSong
  ) {
    if (song.is_original_song) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setUpdatingSongId(song.id);

      const response = await fetch(
        `/api/admin/line-dances/${lineDanceId}/songs`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            songId: song.id,
            action: "make_original",
          }),
        }
      );

      const data = await response.json();

      if (
        handleUnauthorized(response.status)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to mark the song as original."
        );
      }

      setSongs((current) =>
        sortSongs(
          current.map((item) =>
            item.id === song.id
              ? {
                  ...item,
                  is_original_song:
                    true,
                }
              : item
          )
        )
      );

      setMessage(
        `"${song.track_name}" was added as an original song.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark the song as original."
      );
    } finally {
      setUpdatingSongId(null);
    }
  }

  async function removeSong(
    song: LinkedSong
  ) {
    const confirmed =
      window.confirm(
        `Remove "${song.track_name}" from this line dance?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setDeletingSongId(song.id);

      const response = await fetch(
        `/api/admin/line-dances/${lineDanceId}/songs`,
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            songId: song.id,
          }),
        }
      );

      const data = await response.json();

      if (
        handleUnauthorized(response.status)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to remove song."
        );
      }

      /*
       * Reload from the database after deleting.
       * This keeps multiple original songs accurate.
       */
      await loadDanceAndSongs();

      setMessage(
        `"${song.track_name}" was removed.`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to remove song."
      );
    } finally {
      setDeletingSongId(null);
    }
  }

  async function logout() {
    await fetch(
      "/api/admin/logout",
      {
        method: "POST",
      }
    );

    window.location.href = "/admin-login";
  }

  const linkedSpotifyIds =
    useMemo(
      () =>
        new Set(
          songs.map(
            (song) =>
              song.spotify_track_id
          )
        ),
      [songs]
    );

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.20),transparent_36%)]" />

        <div className="relative mx-auto max-w-7xl border-y border-white/15 py-16 text-center">
          <p className="font-heading text-2xl uppercase tracking-[0.08em] text-white/35">
            Loading Line Dance…
          </p>
        </div>
      </main>
    );
  }

  if (!lineDance) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.20),transparent_36%)]" />

        <div className="relative mx-auto max-w-7xl">
          <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
            Error
          </p>

          <h1 className="font-heading mt-2 text-5xl uppercase tracking-[0.035em] text-white">
            Line Dance Not Found
          </h1>

          {error ? (
            <div className="mt-6 border-l-4 border-[#c4202f] bg-[#c4202f]/10 px-5 py-4 text-red-100">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              router.push("/admin-dashboard/line-dances")
            }
            className="font-heading mt-8 rounded-md border-2 border-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.07em] text-white transition hover:bg-[#c4202f]"
          >
            Back to Line Dances
          </button>
        </div>
      </main>
    );
  }

  const alternateNames =
    lineDance.also_known_as
      ?.split(",")
      .map((name) => name.trim())
      .filter(Boolean) ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-12 pt-8 text-white sm:px-6 sm:pb-16 sm:pt-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.20),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() =>
                router.push("/admin-dashboard/line-dances")
              }
              className="font-heading mb-5 text-sm uppercase tracking-[0.08em] text-white/45 transition hover:text-[#c4202f]"
            >
              ← Back to Line Dances
            </button>

            <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
              Choreography
            </p>

            <h1 className="font-heading mt-2 break-words text-5xl uppercase leading-none tracking-[0.035em] text-white sm:text-7xl">
              {lineDance.name}
            </h1>

            {alternateNames.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {alternateNames.map((alternateName) => (
                  <span
                    key={alternateName}
                    className="font-heading border border-white/15 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.06em] text-white/50"
                  >
                    {alternateName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDanceAndSongs()}
              className="font-heading rounded-md border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.07em] text-white/70 transition hover:border-white/40 hover:bg-white/5 hover:text-white"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={logout}
              className="font-heading rounded-md border-2 border-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.07em] text-white transition hover:bg-[#c4202f]"
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

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4 border-b-2 border-[#c4202f] pb-4">
            <div>
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-[#c4202f]">
                Connected Library
              </p>

              <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
                Associated Songs
              </h2>
            </div>

            <span className="font-heading text-xl text-white/35">
              {songs.length}
            </span>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/40">
            Multiple songs can be marked as original. Every associated song
            automatically populates this line dance when requested.
          </p>

          {songs.length === 0 ? (
            <div className="mt-6 border border-dashed border-white/20 bg-[#0d0d0d] px-6 py-16 text-center">
              <p className="font-heading text-3xl uppercase tracking-[0.06em] text-white/25">
                No Songs Connected
              </p>

              <p className="mt-3 text-sm text-white/35">
                Search Spotify below. The first added song automatically becomes
                an original song.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {songs.map((song, index) => (
                <article
                  key={song.id}
                  className="group grid gap-4 border-b border-white/15 px-1 py-6 transition hover:bg-white/[0.025] sm:grid-cols-[56px_80px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-3"
                >
                  <div
                    className={`font-heading grid h-11 w-11 place-items-center rounded-full text-xl text-white ${
                      song.is_original_song
                        ? "bg-[#c4202f]"
                        : "border-2 border-white/20 bg-black"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  {song.album_image ? (
                    <img
                      src={song.album_image}
                      alt={`${song.track_name} album artwork`}
                      className="h-20 w-20 shrink-0 border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-white/10 bg-[#111] text-2xl text-white/25">
                      ♪
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black text-white sm:text-xl">
                        {song.track_name}
                      </h3>

                      <span
                        className={`font-heading border px-3 py-1.5 text-xs uppercase tracking-[0.07em] ${
                          song.is_original_song
                            ? "border-[#c4202f]/70 bg-[#c4202f]/15 text-[#ffadb5]"
                            : "border-white/15 bg-white/5 text-white/45"
                        }`}
                      >
                        {song.is_original_song
                          ? "Original Song"
                          : "Song Swap"}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-white/55 sm:text-base">
                      {song.artist_name}
                    </p>

                    {song.album_name ? (
                      <p className="mt-1 truncate text-xs text-white/30 sm:text-sm">
                        {song.album_name}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!song.is_original_song ? (
                      <button
                        type="button"
                        onClick={() => void makeOriginal(song)}
                        disabled={updatingSongId === song.id}
                        className="font-heading rounded-md border-2 border-[#c4202f] px-4 py-2.5 text-sm uppercase tracking-[0.07em] text-white transition hover:bg-[#c4202f] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {updatingSongId === song.id
                          ? "Updating…"
                          : "Make Original"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void removeSong(song)}
                      disabled={deletingSongId === song.id}
                      aria-label={`Remove ${song.track_name}`}
                      title="Remove"
                      className="grid h-11 w-11 place-items-center rounded-md border-2 border-white/20 text-2xl font-bold leading-none text-white/65 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingSongId === song.id ? (
                        <span className="text-xs">•••</span>
                      ) : (
                        <span aria-hidden="true">×</span>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 border border-[#c4202f]/50 bg-[#0d0d0d]">
          <div className="border-b border-white/15 px-5 py-5 sm:px-7">
            <p className="font-heading text-xs uppercase tracking-[0.18em] text-[#c4202f]">
              Spotify Search
            </p>

            <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
              Add a Song
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Search Spotify and connect a song to {lineDance.name}.
            </p>
          </div>

          <div className="p-5 sm:p-7">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search song or artist"
                autoComplete="off"
                className="w-full border-2 border-white/15 bg-black px-4 py-3 pr-12 text-white outline-none transition placeholder:text-white/20 focus:border-[#c4202f]"
              />

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setError("");
                  }}
                  aria-label="Clear Spotify search"
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-2xl text-white/45 transition hover:bg-[#c4202f] hover:text-white"
                >
                  ×
                </button>
              ) : null}
            </div>

            <p className="mt-2 text-sm text-white/30">
              {searching
                ? "Searching Spotify…"
                : searchQuery.trim().length === 1
                  ? "Type one more character to search."
                  : "Results update automatically as you type."}
            </p>

            {searchResults.length > 0 ? (
              <div className="mt-6 border-t border-white/15">
                {searchResults.map((track) => {
                  const alreadyLinked = linkedSpotifyIds.has(track.id);

                  return (
                    <article
                      key={track.id}
                      className="grid gap-4 border-b border-white/15 py-5 transition hover:bg-white/[0.025] sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-2"
                    >
                      {track.image ? (
                        <img
                          src={track.image}
                          alt={`${track.name} album artwork`}
                          className="h-16 w-16 shrink-0 border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-white/10 bg-[#111] text-xl text-white/25">
                          ♪
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-white sm:text-lg">
                          {track.name}
                        </h3>

                        <p className="mt-1 truncate text-sm text-white/55">
                          {track.artist}
                        </p>

                        {track.album ? (
                          <p className="mt-1 truncate text-xs text-white/30">
                            {track.album}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => void addSong(track)}
                        disabled={
                          alreadyLinked ||
                          addingTrackId === track.id
                        }
                        aria-label={`Add ${track.name}`}
                        title={
                          alreadyLinked
                            ? "Already Added"
                            : "Add Song"
                        }
                        className={`font-heading rounded-md border-2 px-4 py-2.5 text-sm uppercase tracking-[0.07em] transition disabled:cursor-not-allowed ${
                          alreadyLinked
                            ? "border-white/10 bg-white/5 text-white/25"
                            : "border-[#c4202f] text-white hover:bg-[#c4202f]"
                        }`}
                      >
                        {alreadyLinked
                          ? "Added"
                          : addingTrackId === track.id
                            ? "Adding…"
                            : "Add Song"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!searching &&
            searchQuery.trim().length >= 2 &&
            searchResults.length === 0 &&
            !error ? (
              <div className="mt-6 border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/30">
                No Spotify results found.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function sortSongs(
  songs: LinkedSong[]
) {
  return [...songs].sort((a, b) => {
    if (
      a.is_original_song !==
      b.is_original_song
    ) {
      return a.is_original_song
        ? -1
        : 1;
    }

    return a.track_name.localeCompare(
      b.track_name
    );
  });
}