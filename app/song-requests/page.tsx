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
  const classes = size === "large" ? "h-20 w-20 rounded-2xl" : "h-16 w-16 rounded-xl";

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

  function RequestList({ title, requests, emptyMessage }: { title: string; requests: SongRequest[]; emptyMessage: string }) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff7b86]">Live ranking</p>
            <h2 className="mt-1 text-2xl font-black">{title}</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/60">{requests.length}</span>
        </div>

        <div className="space-y-3">
          {requests.map((songRequest) => (
            <article key={songRequest.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#151515] p-3">
              <AlbumArt image={songRequest.album_image} name={songRequest.track_name} size="small" />

              <div className="min-w-0 flex-1">
                <p className="truncate font-black">{songRequest.track_name}</p>
                <p className="truncate text-sm text-white/55">{songRequest.artist_name}</p>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <span className="text-lg font-black">{songRequest.votes}</span>
                <button
                  type="button"
                  onClick={() => voteForSong(songRequest)}
                  disabled={votingRequestId !== null || votedRequestIds.has(songRequest.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition disabled:cursor-default ${
                    votedRequestIds.has(songRequest.id)
                      ? "bg-[#c4202f] text-white"
                      : "bg-white text-black hover:bg-white/85 disabled:opacity-40"
                  }`}
                >
                  {votingRequestId === songRequest.id
                    ? "Voting…"
                    : votedRequestIds.has(songRequest.id)
                      ? "Voted"
                      : "Vote"}
                </button>
              </div>
            </article>
          ))}

          {requests.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/35">{emptyMessage}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-7 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_32%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b]/95 shadow-2xl">
          <img
            src="/song-requests-banner.png"
            alt={`${eventName} song requests`}
            className="h-auto w-full object-cover"
          />
        </header>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl sm:p-6">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/55">Search for a song</span>
            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Song title or artist"
                autoComplete="off"
                className="w-full rounded-2xl border border-white/15 bg-black px-5 py-4 pr-14 text-lg font-bold outline-none transition placeholder:text-white/25 focus:border-[#c4202f]"
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
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#111111] p-3 text-left shadow-lg transition hover:border-white/25 hover:bg-[#171717]"
            >
              <AlbumArt image={track.image} name={track.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black">{track.name}</span>
                <span className="mt-1 block truncate text-sm text-white/55">{track.artist}</span>
              </span>
              <span className="rounded-xl bg-white px-4 py-2 text-sm font-black text-black">Select</span>
            </button>
          ))}
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <RequestList title="Line Dances" requests={lineDanceRequests} emptyMessage="No line dance requests yet." />
          <RequestList title="Swing Songs" requests={swingRequests} emptyMessage="No swing song requests yet." />
        </div>
      </div>

      {selectedTrack && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center" onClick={closeRequestModal}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#111111] p-5 shadow-2xl sm:p-6"
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
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">What kind of request is this?</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestType("line_dance")}
                  className={`rounded-2xl border p-4 text-left transition ${requestType === "line_dance" ? "border-[#c4202f] bg-[#c4202f]/20" : "border-white/15 bg-black hover:border-white/30"}`}
                >
                  <span className="block font-black">Line Dance</span>
                  <span className="mt-1 block text-xs text-white/45">A choreographed line dance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType("swing")}
                  className={`rounded-2xl border p-4 text-left transition ${requestType === "swing" ? "border-white bg-white/10" : "border-white/15 bg-black hover:border-white/30"}`}
                >
                  <span className="block font-black">Swing Song</span>
                  <span className="mt-1 block text-xs text-white/45">A song for country swing</span>
                </button>
              </div>
            </div>

            {modalError && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm font-semibold text-red-200">{modalError}</p>}

            <button
              type="button"
              onClick={submitSong}
              disabled={!requestType || submitting}
              className="mt-5 w-full rounded-2xl bg-[#c4202f] px-5 py-4 text-lg font-black text-white transition hover:bg-[#d9293a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Sending Request…" : requestType ? `Request as ${requestType === "line_dance" ? "Line Dance" : "Swing Song"}` : "Choose a Category"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}