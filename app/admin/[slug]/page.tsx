"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type RequestItem = {
  id: string;
  spotify_track_id: string;
  spotify_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  votes: number;
  status: string | null;
  request_type: "swing" | "line_dance";
};

type SongCategory =
  | "line_dance"
  | "swing_song"
  | "special";

type SongMetadata = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  spotify_uri: string | null;
  album_name: string | null;
  album_image: string | null;
  category: SongCategory;
  choreography: string | null;
  also_known_as: string | null;
  is_song_swap: boolean;
  original_spotify_track_id: string | null;
};

type MetadataForm = {
  category: SongCategory;
  choreography: string;
  alsoKnownAs: string;
  isSongSwap: boolean;
  originalSpotifyTrackId: string;
};

const emptyMetadataForm: MetadataForm = {
  category: "line_dance",
  choreography: "",
  alsoKnownAs: "",
  isSongSwap: false,
  originalSpotifyTrackId: "",
};

function formatCategory(category: SongCategory) {
  if (category === "line_dance") {
    return "Line Dance";
  }

  if (category === "swing_song") {
    return "Swing Song";
  }

  return "Special";
}

export default function AdminPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [metadata, setMetadata] = useState<
    Record<string, SongMetadata | null>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [queueingId, setQueueingId] =
    useState<string | null>(null);

  const [editingTrackId, setEditingTrackId] =
    useState<string | null>(null);

  const [loadingMetadataId, setLoadingMetadataId] =
    useState<string | null>(null);

  const [savingMetadataId, setSavingMetadataId] =
    useState<string | null>(null);

  const [metadataForm, setMetadataForm] =
    useState<MetadataForm>(emptyMetadataForm);

  const loadedMetadataIds = useRef<Set<string>>(
    new Set()
  );

  async function loadSongMetadata(
    spotifyTrackId: string
  ) {
    try {
      const response = await fetch(
        `/api/admin/song-metadata?spotifyTrackId=${encodeURIComponent(
          spotifyTrackId
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load song details."
        );
      }

      const songMetadata =
        (data.songMetadata as SongMetadata | null) ??
        null;

      setMetadata((current) => ({
        ...current,
        [spotifyTrackId]: songMetadata,
      }));

      loadedMetadataIds.current.add(
        spotifyTrackId
      );

      return songMetadata;
    } catch (error) {
      loadedMetadataIds.current.delete(
        spotifyTrackId
      );

      throw error;
    }
  }

  async function loadMissingMetadata(
    requestItems: RequestItem[]
  ) {
    const trackIds = Array.from(
      new Set(
        requestItems.map(
          (request) =>
            request.spotify_track_id
        )
      )
    );

    const missingTrackIds = trackIds.filter(
      (trackId) =>
        !loadedMetadataIds.current.has(trackId)
    );

    missingTrackIds.forEach((trackId) => {
      loadedMetadataIds.current.add(trackId);
    });

    await Promise.all(
      missingTrackIds.map(async (trackId) => {
        try {
          await loadSongMetadata(trackId);
        } catch (error) {
          console.error(
            `Unable to load metadata for ${trackId}:`,
            error
          );
        }
      })
    );
  }

  async function loadRequests() {
    try {
      setError("");

      const response = await fetch(
        `/api/requests?event=${encodeURIComponent(
          slug
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load requests."
        );
      }

      const combined: RequestItem[] = [
        ...(data.swingRequests ?? []),
        ...(data.lineDanceRequests ?? []),
      ];

      combined.sort(
        (a, b) =>
          Number(b.votes) -
          Number(a.votes)
      );

      setRequests(combined);
      void loadMissingMetadata(combined);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addToPlaylist(
    requestId: string
  ) {
    try {
      setError("");
      setMessage("");
      setQueueingId(requestId);

      const response = await fetch(
        "/api/spotify/add-to-playlist",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            requestId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to add song to playlist."
        );
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (request) =>
            request.id !== requestId
        )
      );

      setMessage(
        "Song added to the playlist and removed from requests."
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add song to playlist."
      );
    } finally {
      setQueueingId(null);
    }
  }

  async function updateStatus(
    requestId: string,
    status: "played" | "removed"
  ) {
    try {
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/admin/request",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            requestId,
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to update request."
        );
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (request) =>
            request.id !== requestId
        )
      );

      setMessage(
        status === "played"
          ? "Song marked as played."
          : "Song removed."
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update request."
      );
    }
  }

  async function beginEditing(
    request: RequestItem
  ) {
    try {
      setError("");
      setMessage("");
      setEditingTrackId(
        request.spotify_track_id
      );
      setLoadingMetadataId(
        request.spotify_track_id
      );

      let songMetadata =
        metadata[request.spotify_track_id];

      if (
        songMetadata === undefined ||
        !loadedMetadataIds.current.has(
          request.spotify_track_id
        )
      ) {
        songMetadata =
          await loadSongMetadata(
            request.spotify_track_id
          );
      }

      setMetadataForm({
        category:
          songMetadata?.category ??
          (request.request_type ===
          "line_dance"
            ? "line_dance"
            : "swing_song"),

        choreography:
          songMetadata?.choreography ?? "",

        alsoKnownAs:
          songMetadata?.also_known_as ?? "",

        isSongSwap:
          songMetadata?.is_song_swap ?? false,

        originalSpotifyTrackId:
          songMetadata?.original_spotify_track_id ??
          "",
      });
    } catch (error) {
      setEditingTrackId(null);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load song details."
      );
    } finally {
      setLoadingMetadataId(null);
    }
  }

  function cancelEditing() {
    setEditingTrackId(null);
    setMetadataForm(emptyMetadataForm);
  }

  async function saveSongMetadata(
    request: RequestItem
  ) {
    try {
      setError("");
      setMessage("");
      setSavingMetadataId(
        request.spotify_track_id
      );

      const response = await fetch(
        "/api/admin/song-metadata",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            spotifyTrackId:
              request.spotify_track_id,
            trackName: request.track_name,
            artistName: request.artist_name,
            spotifyUri: request.spotify_uri,
            albumName: request.album_name,
            albumImage: request.album_image,

            category:
              metadataForm.category,

            choreography:
              metadataForm.choreography,

            alsoKnownAs:
              metadataForm.alsoKnownAs,

            isSongSwap:
              metadataForm.isSongSwap,

            originalSpotifyTrackId:
              metadataForm.isSongSwap
                ? metadataForm.originalSpotifyTrackId
                : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to save song details."
        );
      }

      const savedMetadata =
        data.songMetadata as SongMetadata;

      setMetadata((current) => ({
        ...current,
        [request.spotify_track_id]:
          savedMetadata,
      }));

      loadedMetadataIds.current.add(
        request.spotify_track_id
      );

      setEditingTrackId(null);
      setMetadataForm(emptyMetadataForm);
      setMessage("Song details saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save song details."
      );
    } finally {
      setSavingMetadataId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    window.location.href =
      "/admin/login";
  }

  useEffect(() => {
    if (!slug) {
      return;
    }

    void loadRequests();

    const interval = window.setInterval(
      () => {
        void loadRequests();
      },
      3000
    );

    return () =>
      window.clearInterval(interval);
  }, [slug]);

  const activeRequests = requests.filter(
    (request) =>
      request.status !== "played" &&
      request.status !== "removed"
  );

  const swingRequests =
    activeRequests.filter(
      (request) =>
        request.request_type === "swing"
    );

  const lineDanceRequests =
    activeRequests.filter(
      (request) =>
        request.request_type ===
        "line_dance"
    );

  function RequestCard({
    request,
  }: {
    request: RequestItem;
  }) {
    const isQueueing =
      queueingId === request.id;

    const isEditing =
      editingTrackId ===
      request.spotify_track_id;

    const isLoadingMetadata =
      loadingMetadataId ===
      request.spotify_track_id;

    const isSavingMetadata =
      savingMetadataId ===
      request.spotify_track_id;

    const songMetadata =
      metadata[request.spotify_track_id];

    return (
      <div className="rounded-2xl border border-neutral-800 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {request.album_image ? (
              <img
                src={request.album_image}
                alt={`${request.track_name} album artwork`}
                className="h-20 w-20 flex-none rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-neutral-900 text-xs text-neutral-500">
                No artwork
              </div>
            )}

            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-white">
                {request.track_name}
              </h3>

              <p className="truncate text-neutral-400">
                {request.artist_name}
              </p>

              {request.album_name && (
                <p className="truncate text-sm text-neutral-600">
                  {request.album_name}
                </p>
              )}

              <p className="mt-2 font-bold">
                {request.votes}{" "}
                {request.votes === 1
                  ? "vote"
                  : "votes"}
              </p>

              {songMetadata && (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-neutral-800 px-3 py-1 font-semibold text-neutral-200">
                      {formatCategory(
                        songMetadata.category
                      )}
                    </span>

                    <span className="rounded-full bg-neutral-800 px-3 py-1 font-semibold text-neutral-200">
                      {songMetadata.is_song_swap
                        ? "Song Swap"
                        : "Original Song"}
                    </span>
                  </div>

                  {songMetadata.choreography && (
                    <p className="pt-1 text-neutral-300">
                      <span className="font-semibold text-white">
                        Choreo:
                      </span>{" "}
                      {
                        songMetadata.choreography
                      }
                    </p>
                  )}

                  {songMetadata.also_known_as && (
                    <p className="text-neutral-300">
                      <span className="font-semibold text-white">
                        Also Known As:
                      </span>{" "}
                      {
                        songMetadata.also_known_as
                      }
                    </p>
                  )}

                  {songMetadata.is_song_swap &&
                    songMetadata.original_spotify_track_id && (
                      <p className="break-all text-neutral-400">
                        <span className="font-semibold text-white">
                          Original track ID:
                        </span>{" "}
                        {
                          songMetadata.original_spotify_track_id
                        }
                      </p>
                    )}
                </div>
              )}

              {request.status === "added" && (
                <div className="mt-2 inline-block rounded-full bg-green-700 px-3 py-1 text-sm">
                  Added to Playlist
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                isQueueing ||
                request.status === "added"
              }
              onClick={() =>
                addToPlaylist(request.id)
              }
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {request.status === "added"
                ? "Added"
                : isQueueing
                ? "Adding..."
                : "Add"}
            </button>

            <button
              type="button"
              disabled={isLoadingMetadata}
              onClick={() =>
                beginEditing(request)
              }
              className="rounded-xl border border-neutral-600 px-4 py-3 font-semibold hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingMetadata
                ? "Loading..."
                : songMetadata
                ? "Edit Details"
                : "Add Details"}
            </button>

            <button
              type="button"
              onClick={() =>
                updateStatus(
                  request.id,
                  "removed"
                )
              }
              className="rounded-xl bg-red-600 px-4 py-3 font-semibold hover:bg-red-500"
            >
              Remove
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="mt-5 border-t border-neutral-800 pt-5">
            <h4 className="mb-4 text-lg font-bold">
              Song Details
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Category
                </span>

                <select
                  value={
                    metadataForm.category
                  }
                  onChange={(event) =>
                    setMetadataForm(
                      (current) => ({
                        ...current,
                        category:
                          event.target
                            .value as SongCategory,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white"
                >
                  <option value="line_dance">
                    Line Dance
                  </option>

                  <option value="swing_song">
                    Swing Song
                  </option>

                  <option value="special">
                    Special
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Song Version
                </span>

                <select
                  value={
                    metadataForm.isSongSwap
                      ? "song_swap"
                      : "original"
                  }
                  onChange={(event) =>
                    setMetadataForm(
                      (current) => ({
                        ...current,
                        isSongSwap:
                          event.target.value ===
                          "song_swap",

                        originalSpotifyTrackId:
                          event.target.value ===
                          "song_swap"
                            ? current.originalSpotifyTrackId
                            : "",
                      })
                    )
                  }
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white"
                >
                  <option value="original">
                    Original Song
                  </option>

                  <option value="song_swap">
                    Song Swap
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Choreo
                </span>

                <input
                  type="text"
                  value={
                    metadataForm.choreography
                  }
                  onChange={(event) =>
                    setMetadataForm(
                      (current) => ({
                        ...current,
                        choreography:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Name of choreography"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Also Known As
                </span>

                <input
                  type="text"
                  value={
                    metadataForm.alsoKnownAs
                  }
                  onChange={(event) =>
                    setMetadataForm(
                      (current) => ({
                        ...current,
                        alsoKnownAs:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Alternate dance name"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600"
                />
              </label>
            </div>

            {metadataForm.isSongSwap && (
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Original Song Spotify Track ID
                </span>

                <input
                  type="text"
                  value={
                    metadataForm.originalSpotifyTrackId
                  }
                  onChange={(event) =>
                    setMetadataForm(
                      (current) => ({
                        ...current,
                        originalSpotifyTrackId:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Optional Spotify track ID"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600"
                />

                <p className="mt-2 text-xs text-neutral-500">
                  This can be left blank for
                  now.
                </p>
              </label>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSavingMetadata}
                onClick={() =>
                  saveSongMetadata(request)
                }
                className="rounded-xl bg-green-600 px-4 py-3 font-semibold hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingMetadata
                  ? "Saving..."
                  : "Save Details"}
              </button>

              <button
                type="button"
                disabled={isSavingMetadata}
                onClick={cancelEditing}
                className="rounded-xl border border-neutral-700 px-4 py-3 font-semibold hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">
            DJ Dashboard
          </h1>

          <p className="mt-2 text-neutral-400">
            Event: {slug}
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Log Out
        </button>
      </header>

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

      {loading ? (
        <p>Loading requests...</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-2xl font-bold">
              Swing Songs
            </h2>

            <div className="space-y-4">
              {swingRequests.map(
                (request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                  />
                )
              )}

              {swingRequests.length === 0 && (
                <p className="text-neutral-500">
                  No swing requests.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold">
              Line Dances
            </h2>

            <div className="space-y-4">
              {lineDanceRequests.map(
                (request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                  />
                )
              )}

              {lineDanceRequests.length ===
                0 && (
                <p className="text-neutral-500">
                  No line dance requests.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}