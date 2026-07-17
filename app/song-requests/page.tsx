"use client";

import { useEffect, useState } from "react";

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
  if (existingId) return existingId;

  const newId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, newId);
  return newId;
}

function AlbumArt({ image, name, size = "large" }: { image: string | null; name: string; size?: "small" | "large" }) {
  const classes = size === "large" ? "h-20 w-20 rounded-xl" : "h-[72px] w-[72px] rounded-lg sm:h-[88px] sm:w-[88px]";

  return image ? (
    <img src={image} alt={`${name} album artwork`} className={`${classes} shrink-0 object-cover`} />
  ) : (
    <div className={`${classes} flex shrink-0 items-center justify-center bg-white/5 text-2xl text-white/25`}>♪</div>
  );
}

export default function MusicRequestPage() {
  const slug = "big-iron";

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [swingRequests, setSwingRequests] = useState<SongRequest[]>([]);
  const [lineDanceRequests, setLineDanceRequests] = useState<SongRequest[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [voteError, setVoteError] = useState("");
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null);
  const [votedRequestIds, setVotedRequestIds] = useState<Set<string>>(new Set());
  const [eventName, setEventName] = useState("Big Iron Country Swing");

  async function loadRequests() {
    try {
      const deviceId = getDeviceId();
      const response = await fetch(
        `/api/requests?event=${encodeURIComponent(slug)}&device=${encodeURIComponent(deviceId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load requests.");

      setEventName(data.event?.name ?? "Big Iron Country Swing");
      setSwingRequests(data.swingRequests ?? []);
      setLineDanceRequests(data.lineDanceRequests ?? []);
      setVotedRequestIds(new Set(data.votedRequestIds ?? []));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load requests.");
    }
  }

  useEffect(() => {
    void loadRequests();
    const interval = window.setInterval(() => void loadRequests(), 5000);
    return () => window.clearInterval(interval);
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
        const response = await fetch(`/api/search?q=${encodeURIComponent(cleanedQuery)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Spotify search failed.");

        setSearchResults(data.tracks ?? []);
        if (!data.tracks?.length) setMessage("No matching songs were found.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "Spotify search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
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
    if (submitting) return;
    setSelectedTrack(null);
    setRequestType(null);
    setModalError("");
  }

  async function submitSong() {
    if (!selectedTrack || !requestType) return;

    setSubmitting(true);
    setModalError("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: slug,
          deviceId: getDeviceId(),
          requestType,
          track: selectedTrack,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to request this song.");

      setMessage(data.message ?? "Song requested.");
      if (data.request?.id) {
        setVotedRequestIds((current) => new Set(current).add(data.request.id));
      }
      setSelectedTrack(null);
      setRequestType(null);
      setQuery("");
      setSearchResults([]);
      await loadRequests();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Unable to request this song.");
    } finally {
      setSubmitting(false);
    }
  }

  async function voteForSong(songRequest: SongRequest) {
    if (votingRequestId || votedRequestIds.has(songRequest.id)) return;

    setVotingRequestId(songRequest.id);
    setVoteError("");
    setMessage("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!response.ok) throw new Error(data.error ?? "Unable to vote.");

      setMessage(data.message ?? "Vote added.");
      setVotedRequestIds((current) => new Set(current).add(songRequest.id));
      await loadRequests();
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "Unable to vote.");
    } finally {
      setVotingRequestId(null);
    }
  }

  function CategoryIcon({ type }: { type: RequestType }) {
    if (type === "swing") {
      return (
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className="h-9 w-9 shrink-0 text-[#c4202f]"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 35V11l20-5v24" />
          <ellipse cx="12" cy="36" rx="7" ry="5" />
          <ellipse cx="32" cy="31" rx="7" ry="5" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="h-10 w-10 shrink-0 text-[#c4202f]"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 5h10l2 15 8 8v9H15c-4 0-7-3-7-7v-3h10V5Z" />
        <path d="M18 27h12" />
        <path d="M19 11h10M20 16h10" />
        <path d="M15 37v5h25v-5" />
      </svg>
    );
  }

  function RequestList({
    title,
    requests,
    emptyMessage,
    type,
  }: {
    title: string;
    requests: SongRequest[];
    emptyMessage: string;
    type: RequestType;
  }) {
    return (
      <section className="min-w-0">
        <div className="flex items-center gap-3 border-b-2 border-[#c4202f] pb-4">
          <CategoryIcon type={type} />
          <h2 className="font-heading text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
            {title}
          </h2>
        </div>

        <div>
          {requests.map((songRequest) => {
            const hasVoted = votedRequestIds.has(songRequest.id);

            return (
              <article
                key={songRequest.id}
                className="group grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-4 border-b border-white/15 py-5 transition duration-200 last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[88px_minmax(0,1fr)_92px] sm:gap-5"
              >
                <AlbumArt
                  image={songRequest.album_image}
                  name={songRequest.track_name}
                  size="small"
                />

                <div className="min-w-0">
                  <p className="truncate text-base font-black text-white sm:text-lg">
                    {songRequest.track_name}
                  </p>
                  <p className="mt-1 truncate text-base text-white/55 sm:text-lg">
                    {songRequest.artist_name}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-center">
                  <span className="text-xl font-black leading-none text-white">
                    {songRequest.votes}
                  </span>
                  <span className="font-heading mt-1 text-sm uppercase tracking-[0.08em] text-white/45">
                    Votes
                  </span>

                  <button
                    type="button"
                    onClick={() => voteForSong(songRequest)}
                    disabled={votingRequestId !== null || hasVoted}
                    className={`font-heading mt-3 min-w-[72px] rounded-md border-2 px-3 py-2 text-lg uppercase tracking-[0.06em] transition duration-200 active:scale-95 sm:min-w-[86px] sm:text-xl ${
                      hasVoted
                        ? "border-[#c4202f] bg-[#c4202f] text-white"
                        : "border-[#c4202f] bg-transparent text-white hover:bg-[#c4202f]"
                    } disabled:cursor-default`}
                  >
                    {votingRequestId === songRequest.id
                      ? "Voting…"
                      : hasVoted
                        ? "Voted"
                        : "Vote"}
                  </button>
                </div>
              </article>
            );
          })}

          {requests.length === 0 && (
            <div className="py-12 text-center text-white/35">{emptyMessage}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pt-8 pb-7 text-white sm:px-6 sm:pt-10 sm:pb-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_32%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-6 overflow-hidden border-b-2 border-[#c4202f] shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
          <img
            src="/song-requests-banner.png"
            alt={`${eventName} song requests`}
            className="block w-full h-auto object-contain"
          />
        </header>

        <section className="mt-5 border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl sm:p-6">
          <label className="block">
            <span className="font-heading mb-2 block text-lg uppercase tracking-[0.12em] text-white/65">Search for a song</span>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by song title or artist"
                autoComplete="off"
                className="h-16 w-full rounded-none border border-white/20 bg-black pl-12 pr-14 text-lg font-semibold outline-none transition duration-200 placeholder:text-white/25 focus:border-[#c4202f] focus:shadow-[0_0_0_1px_rgba(196,32,47,0.35)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSearchResults([]);
                    setMessage("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-2xl text-white/45 hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
          </label>

          {message && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">{message}</p>}
          {voteError && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200">{voteError}</p>}
        </section>

        <section className="mt-4 space-y-3">
          {searching && <p className="py-4 text-center text-sm font-bold text-white/45">Searching Spotify…</p>}
          {searchResults.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => openRequestModal(track)}
              className="group flex w-full items-center gap-4 rounded-xl border border-white/10 bg-[#111111] p-3 text-left shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-[#c4202f]/70 hover:bg-[#171717] hover:shadow-xl"
            >
              <AlbumArt image={track.image} name={track.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black">{track.name}</span>
                <span className="mt-1 block truncate text-sm text-white/55">{track.artist}</span>
              </span>
              <span className="font-heading rounded-md bg-white px-4 py-2 text-lg uppercase tracking-[0.05em] text-black">Select</span>
            </button>
          ))}
        </section>

        <div className="mt-10 border-t border-white/15 pt-7 lg:grid lg:grid-cols-2 lg:gap-0">
          <div className="pb-8 lg:border-r lg:border-white/20 lg:pb-0 lg:pr-8">
            <RequestList
              title="Swing Song Requests"
              requests={swingRequests}
              emptyMessage="No swing song requests yet."
              type="swing"
            />
          </div>

          <div className="border-t border-white/15 pt-8 lg:border-t-0 lg:pl-8 lg:pt-0">
            <RequestList
              title="Line Dance Requests"
              requests={lineDanceRequests}
              emptyMessage="No line dance requests yet."
              type="line_dance"
            />
          </div>
        </div>
      </div>

      {selectedTrack && (
        <div className="fixed inset-0 z-50 flex animate-[fadeIn_180ms_ease-out] items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center" onClick={closeRequestModal}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg animate-[scaleIn_180ms_ease-out] rounded-2xl border border-white/15 bg-[#111111] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-4">
              <AlbumArt image={selectedTrack.image} name={selectedTrack.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-black">{selectedTrack.name}</p>
                <p className="mt-1 truncate text-white/55">{selectedTrack.artist}</p>
              </div>
              <button type="button" onClick={closeRequestModal} className="rounded-full px-3 py-1 text-2xl text-white/50 hover:bg-white/10 hover:text-white">×</button>
            </div>

            <div className="mt-6">
              <p className="font-heading text-lg uppercase tracking-[0.1em] text-white/60">What kind of request is this?</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestType("line_dance")}
                  className={`rounded-2xl border p-4 text-left transition ${requestType === "line_dance" ? "border-[#c4202f] bg-[#c4202f]/20" : "border-white/15 bg-black hover:border-white/30"}`}
                >
                  <span className="font-heading block text-xl uppercase tracking-[0.04em]">Line Dance</span>
                  <span className="mt-1 block text-xs text-white/45">A choreographed line dance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType("swing")}
                  className={`rounded-2xl border p-4 text-left transition ${requestType === "swing" ? "border-white bg-white/10" : "border-white/15 bg-black hover:border-white/30"}`}
                >
                  <span className="font-heading block text-xl uppercase tracking-[0.04em]">Swing Song</span>
                  <span className="mt-1 block text-xs text-white/45">A song for country swing</span>
                </button>
              </div>
            </div>

            {modalError && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm font-semibold text-red-200">{modalError}</p>}

            <button
              type="button"
              onClick={submitSong}
              disabled={!requestType || submitting}
              className="font-heading mt-5 w-full rounded-md bg-[#c4202f] px-5 py-4 text-2xl uppercase tracking-[0.05em] text-white transition hover:bg-[#d9293a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Sending Request…" : requestType ? `Request as ${requestType === "line_dance" ? "Line Dance" : "Swing Song"}` : "Choose a Category"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}