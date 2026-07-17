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
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-neutral-400">
            Loading line dance...
          </p>
        </div>
      </main>
    );
  }

  if (!lineDance) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">
            Line dance not found
          </h1>

          {error && (
            <p className="mt-4 text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin-dashboard/line-dances"
              )
            }
            className="mt-6 rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:bg-neutral-800"
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
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <header className="mx-auto mb-8 flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin-dashboard/line-dances"
              )
            }
            className="mb-4 text-sm font-semibold text-neutral-400 hover:text-white"
          >
            ← Back to Line Dances
          </button>

          <h1 className="text-4xl font-bold">
            {lineDance.name}
          </h1>

          {alternateNames.length >
            0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-neutral-400">
                Also known as:
              </p>

              <div className="flex flex-wrap gap-2">
                {alternateNames.map(
                  (alternateName) => (
                    <span
                      key={
                        alternateName
                      }
                      className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-sm text-neutral-300"
                    >
                      {
                        alternateName
                      }
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void loadDanceAndSongs()
            }
            className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:bg-neutral-800"
          >
            Refresh
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

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">
              Associated Songs
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Multiple songs can be
              marked as original. Every
              associated song will
              automatically populate
              this line dance when
              requested.
            </p>
          </div>

          {songs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
              <p className="text-lg font-semibold text-neutral-300">
                No songs connected yet
              </p>

              <p className="mt-2 text-neutral-500">
                Search Spotify below.
                The first added song
                automatically becomes
                an original song.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {songs.map((song) => (
                <article
                  key={song.id}
                  className={`rounded-2xl border p-4 ${
                    song.is_original_song
                      ? "border-amber-500/60 bg-amber-950/20"
                      : "border-neutral-800 bg-neutral-950"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {song.album_image ? (
                      <img
                        src={
                          song.album_image
                        }
                        alt=""
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-neutral-800 text-2xl">
                        ♪
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold">
                          {
                            song.track_name
                          }
                        </h3>

                        {song.is_original_song ? (
                          <span className="rounded-full border border-amber-500/50 bg-amber-950 px-3 py-1 text-xs font-bold text-amber-300">
                            ★ Original Song
                          </span>
                        ) : (
                          <span className="rounded-full border border-blue-500/40 bg-blue-950/30 px-3 py-1 text-xs font-bold text-blue-300">
                            Song Swap
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-neutral-300">
                        {song.artist_name}
                      </p>

                      {song.album_name && (
                        <p className="mt-1 text-sm text-neutral-500">
                          {
                            song.album_name
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!song.is_original_song && (
                        <button
                          type="button"
                          onClick={() =>
                            void makeOriginal(
                              song
                            )
                          }
                          disabled={
                            updatingSongId ===
                            song.id
                          }
                          className="rounded-xl border border-amber-500/50 px-4 py-2 font-semibold text-amber-300 hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingSongId ===
                          song.id
                            ? "Updating..."
                            : "Make Original"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          void removeSong(
                            song
                          )
                        }
                        disabled={
                          deletingSongId ===
                          song.id
                        }
                        className="rounded-xl border border-red-500/50 px-4 py-2 font-semibold text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingSongId ===
                        song.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
          <h2 className="text-2xl font-bold">
            Add a Song
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Search Spotify and connect
            a song to {lineDance.name}.
          </p>

          <div className="mt-6">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search song or artist"
                autoComplete="off"
                className="w-full rounded-xl border border-neutral-700 bg-black px-4 py-3 pr-12 text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setError("");
                  }}
                  aria-label="Clear Spotify search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xl text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>

            <p className="mt-2 text-sm text-neutral-500">
              {searching
                ? "Searching Spotify..."
                : searchQuery.trim()
                      .length === 1
                  ? "Type one more character to search."
                  : "Results update automatically as you type."}
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-6 grid gap-3">
              {searchResults.map(
                (track) => {
                  const alreadyLinked =
                    linkedSpotifyIds.has(
                      track.id
                    );

                  return (
                    <article
                      key={track.id}
                      className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-black p-4 sm:flex-row sm:items-center"
                    >
                      {track.image ? (
                        <img
                          src={
                            track.image
                          }
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-800 text-xl">
                          ♪
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold">
                          {track.name}
                        </h3>

                        <p className="truncate text-neutral-300">
                          {track.artist}
                        </p>

                        {track.album && (
                          <p className="truncate text-sm text-neutral-500">
                            {
                              track.album
                            }
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void addSong(
                            track
                          )
                        }
                        disabled={
                          alreadyLinked ||
                          addingTrackId ===
                            track.id
                        }
                        className="rounded-xl bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {alreadyLinked
                          ? "Added"
                          : addingTrackId ===
                              track.id
                            ? "Adding..."
                            : "Add Song"}
                      </button>
                    </article>
                  );
                }
              )}
            </div>
          )}

          {!searching &&
            searchQuery.trim().length >=
              2 &&
            searchResults.length === 0 &&
            !error && (
              <p className="mt-6 text-sm text-neutral-500">
                No Spotify results found.
              </p>
            )}
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