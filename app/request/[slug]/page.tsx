"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type RequestType = "swing" | "line_dance";

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
  explicit: boolean;
};

type SongRequest = {
  id: string;
  spotify_track_id: string;
  spotify_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  explicit: boolean;
  votes: number;
  status: string;
  request_type: RequestType;
};

function getDeviceId(): string {
  const storageKey = "big-iron-music-device-id";
  const existingId = window.localStorage.getItem(storageKey);

  if (existingId) {
    return existingId;
  }

  const newId =
  Date.now().toString(36) +
  "-" +
  Math.random().toString(36).slice(2);
  window.localStorage.setItem(storageKey, newId);

  return newId;
}

export default function MusicRequestPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [swingRequests, setSwingRequests] = useState<SongRequest[]>([]);
  const [lineDanceRequests, setLineDanceRequests] =
    useState<SongRequest[]>([]);

  const [selectedTrack, setSelectedTrack] =
    useState<SpotifyTrack | null>(null);
  const [requestType, setRequestType] =
    useState<RequestType | null>(null);

  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [voteError, setVoteError] = useState("");
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Music Requests");

  async function loadRequests() {
    try {
      const response = await fetch(
        `/api/requests?event=${encodeURIComponent(slug)}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load requests.");
      }

      setEventName(data.event?.name ?? "Music Requests");
      setSwingRequests(data.swingRequests ?? []);
      setLineDanceRequests(data.lineDanceRequests ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load requests."
      );
    }
  }

  useEffect(() => {
    loadRequests();

    const interval = window.setInterval(loadRequests, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [slug]);

  useEffect(() => {
    const cleanedQuery = query.trim();

    if (cleanedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(cleanedQuery)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Spotify search failed.");
        }

        setSearchResults(data.tracks ?? []);

        if (!data.tracks?.length) {
          setMessage("No matching songs were found.");
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Spotify search failed."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function openRequestModal(track: SpotifyTrack) {
    setSelectedTrack(track);
    setRequestType(null);
    setModalError("");
    setMessage("");
  }

  function closeRequestModal() {
    if (submitting) {
      return;
    }

    setSelectedTrack(null);
    setRequestType(null);
    setModalError("");
  }

  async function submitSong() {
    if (!selectedTrack || !requestType) {
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventSlug: slug,
          deviceId: getDeviceId(),
          requestType,
          track: selectedTrack,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to request this song.");
      }

      setMessage(data.message ?? "Song requested.");
      setSelectedTrack(null);
      setRequestType(null);
      setModalError("");
      setQuery("");
      setSearchResults([]);

      await loadRequests();
    } catch (error) {
      setModalError(
        error instanceof Error
          ? error.message
          : "Unable to request this song."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function voteForSong(songRequest: SongRequest) {
    if (votingRequestId) {
      return;
    }

    setVotingRequestId(songRequest.id);
    setVoteError("");
    setMessage("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventSlug: slug,
          deviceId: getDeviceId(),
          requestType: songRequest.request_type,
          track: {
            id: songRequest.spotify_track_id,
            uri: songRequest.spotify_uri,
            name: songRequest.track_name,
            artist: songRequest.artist_name,
            album: songRequest.album_name,
            image: songRequest.album_image,
            explicit: songRequest.explicit,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to vote.");
      }

      setMessage(data.message ?? "Vote added.");
      await loadRequests();
    } catch (error) {
      setVoteError(
        error instanceof Error
          ? error.message
          : "Unable to vote."
      );
    } finally {
      setVotingRequestId(null);
    }
  }

  function RequestList({
    title,
    requests,
    emptyMessage,
  }: {
    title: string;
    requests: SongRequest[];
    emptyMessage: string;
  }) {
    return (
      <section className="mt-10">
        <div>
          <p className="text-sm uppercase tracking-wider text-neutral-500">
            Live ranking
          </p>

          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <div className="mt-4 space-y-3">
          {requests.map((songRequest, index) => (
            <article
              key={songRequest.id}
              className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3"
            >
              <span className="w-8 text-center text-xl font-bold text-neutral-500">
                {index + 1}
              </span>

              {songRequest.album_image ? (
                <img
                  src={songRequest.album_image}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-neutral-700" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {songRequest.track_name}

                  {songRequest.explicit && (
                    <span className="ml-2 rounded bg-neutral-700 px-1 text-xs">
                      E
                    </span>
                  )}
                </p>

                <p className="truncate text-sm text-neutral-400">
                  {songRequest.artist_name}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-white px-3 py-2 font-bold text-black">
                  {songRequest.votes}
                </span>

                <button
                  type="button"
                  onClick={() => voteForSong(songRequest)}
                  disabled={votingRequestId !== null}
                  className="rounded-lg bg-neutral-800 px-3 py-1 text-xs font-semibold transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {votingRequestId === songRequest.id
                    ? "Voting…"
                    : "▲ Vote"}
                </button>
              </div>
            </article>
          ))}

          {requests.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
              {emptyMessage}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-neutral-400">
            {eventName}
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Request a Song
          </h1>

          <p className="mt-3 text-neutral-400">
            Search Spotify and select a song.
          </p>
        </header>

        <section className="mt-8 rounded-3xl bg-neutral-900 p-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-300">
              Search for a song
            </span>

            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Song title or artist"
                autoComplete="off"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 pr-12 outline-none focus:border-white"
              />

              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSearchResults([]);
                    setMessage("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xl text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
          </label>

          {message && (
            <p className="mt-4 rounded-xl bg-neutral-800 p-3 text-sm">
              {message}
            </p>
          )}

          {voteError && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200"
            >
              {voteError}
            </p>
          )}
        </section>

        <section className="mt-5 space-y-3">
          {searching && (
            <p className="text-center text-sm text-neutral-400">
              Searching Spotify…
            </p>
          )}

          {searchResults.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => openRequestModal(track)}
              className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-left transition hover:bg-neutral-800"
            >
              {track.image ? (
                <img
                  src={track.image}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-neutral-700" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {track.name}

                  {track.explicit && (
                    <span className="ml-2 rounded bg-neutral-700 px-1 text-xs">
                      E
                    </span>
                  )}
                </span>

                <span className="block truncate text-sm text-neutral-400">
                  {track.artist}
                </span>

                <span className="block truncate text-xs text-neutral-500">
                  {track.album}
                </span>
              </span>

              <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-black">
                Select
              </span>
            </button>
          ))}
        </section>

        <RequestList
          title="Swing Songs"
          requests={swingRequests}
          emptyMessage="No swing song requests yet."
        />

        <RequestList
          title="Line Dances"
          requests={lineDanceRequests}
          emptyMessage="No line dance requests yet."
        />
      </div>

      {selectedTrack && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
          onClick={closeRequestModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-neutral-900 p-5 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              {selectedTrack.image ? (
                <img
                  src={selectedTrack.image}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-neutral-700" />
              )}

              <div className="min-w-0 flex-1">
                <h2
                  id="request-modal-title"
                  className="text-xl font-bold"
                >
                  {selectedTrack.name}
                </h2>

                <p className="mt-1 text-neutral-400">
                  {selectedTrack.artist}
                </p>

                <p className="mt-1 truncate text-sm text-neutral-500">
                  {selectedTrack.album}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRequestModal}
                disabled={submitting}
                aria-label="Close"
                className="rounded-full px-3 py-1 text-2xl text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <fieldset className="mt-6">
              <legend className="font-semibold">
                What is this request for?
              </legend>

              <div className="mt-3 space-y-3">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    requestType === "swing"
                      ? "border-white bg-white text-black"
                      : "border-neutral-700 bg-neutral-950 text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestType"
                    checked={requestType === "swing"}
                    onChange={() => {
                      setRequestType("swing");
                      setModalError("");
                    }}
                    className="h-5 w-5"
                  />

                  <span className="font-semibold">Swing Song</span>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    requestType === "line_dance"
                      ? "border-white bg-white text-black"
                      : "border-neutral-700 bg-neutral-950 text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestType"
                    checked={requestType === "line_dance"}
                    onChange={() => {
                      setRequestType("line_dance");
                      setModalError("");
                    }}
                    className="h-5 w-5"
                  />

                  <span className="font-semibold">Line Dance</span>
                </label>
              </div>
            </fieldset>

            {modalError && (
              <p
                role="alert"
                className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-200"
              >
                {modalError}
              </p>
            )}

            <button
              type="button"
              onClick={submitSong}
              disabled={!requestType || submitting}
              className="mt-6 w-full rounded-2xl bg-white px-5 py-4 font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>

            {!requestType && (
              <p className="mt-3 text-center text-sm text-neutral-400">
                Select one category to continue.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}