"use client";

import { useEffect, useState } from "react";

type RequestType = "swing" | "line_dance";

type RequestItem = {
  id: string;
  spotify_track_id: string;
  spotify_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  explicit: boolean;
  votes: number;
  status: string | null;
  request_type: RequestType;
};

type LineDanceInfo = {
  id: string;
  name: string;
  alsoKnownAs: string | null;
  isOriginalSong: boolean;
  originalSong: {
    trackName: string;
    artistName: string;
  } | null;
};

type SpotifyQueueTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
  explicit: boolean;
  requestId: string | null;
  requestType: RequestType;
  categorySource:
    | "request"
    | "override"
    | "line_dance_library"
    | "default";
  lineDance: LineDanceInfo | null;
};

type SpotifyQueueResponse = {
  currentlyPlaying?: SpotifyQueueTrack | null;
  queue?: SpotifyQueueTrack[];
  error?: string;
};

function ExplicitBadge() {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center border border-white/35 px-1 text-[10px] font-black leading-none text-white/65"
      title="Explicit"
      aria-label="Explicit"
    >
      E
    </span>
  );
}

export default function AdminPage() {
  const slug = "big-iron";

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [spotifyQueue, setSpotifyQueue] = useState<SpotifyQueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [queueTypeUpdatingTrackId, setQueueTypeUpdatingTrackId] =
    useState<string | null>(null);
  const [queueCollapsed, setQueueCollapsed] = useState(true);

  async function loadRequests() {
    try {
      const response = await fetch(
        `/api/admin/all-requests?event=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load requests.");
      }

      const combined: RequestItem[] = data.requests ?? [];
      combined.sort((a, b) => Number(b.votes) - Number(a.votes));
      setRequests(combined);
    } catch (loadError) {
      throw loadError instanceof Error
        ? loadError
        : new Error("Unable to load requests.");
    }
  }

  async function loadSpotifyQueue() {
    try {
      const response = await fetch("/api/admin/spotify-queue", {
        cache: "no-store",
      });

      const data = (await response.json()) as SpotifyQueueResponse;

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load Spotify queue.");
      }

      setSpotifyQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch (queueError) {
      throw queueError instanceof Error
        ? queueError
        : new Error("Unable to load Spotify queue.");
    }
  }

  async function refreshDashboard(showLoading = false) {
    if (showLoading) setLoading(true);

    try {
      setError("");
      await Promise.all([loadRequests(), loadSpotifyQueue()]);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh dashboard."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addToQueue(requestId: string) {
    try {
      setError("");
      setMessage("");
      setQueueingId(requestId);

      const response = await fetch("/api/spotify/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to add song to Spotify queue.");
      }

      setMessage(data.message ?? "Song added to the Spotify queue.");
      await refreshDashboard(false);
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : "Unable to add song to Spotify queue."
      );
    } finally {
      setQueueingId(null);
    }
  }

  async function updateQueueTrackType(
    track: SpotifyQueueTrack,
    requestType: RequestType
  ) {
    if (track.requestType === requestType) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setQueueTypeUpdatingTrackId(track.id);

      const response = await fetch("/api/admin/spotify-queue", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: track.requestId,
          requestType,
          track: {
            id: track.id,
            uri: track.uri,
            name: track.name,
            artist: track.artist,
            album: track.album,
            image: track.image,
          },
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to change queue category.");
      }

      // Reload the real Spotify queue so a Line Dance override
      // immediately pulls choreography/original-song information
      // from the line dance database.
      await loadSpotifyQueue();

      setMessage(
        requestType === "line_dance"
          ? `“${track.name}” will display as a Line Dance with any linked choreography information.`
          : `“${track.name}” will display as a Swing Song.`
      );
    } catch (typeError) {
      setError(
        typeError instanceof Error
          ? typeError.message
          : "Unable to change queue category."
      );
    } finally {
      setQueueTypeUpdatingTrackId(null);
    }
  }

  async function updateStatus(
    requestId: string,
    status: "played" | "removed"
  ) {
    try {
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/request", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, status }),
      });

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update request.");
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => request.id !== requestId)
      );

      setMessage(
        status === "played" ? "Song marked as played." : "Song removed."
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update request."
      );
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin-login";
  }

  useEffect(() => {
    void refreshDashboard(true);

    const interval = window.setInterval(() => {
      void refreshDashboard(false);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const visibleRequests = requests.filter(
    (request) =>
      request.status !== "played" &&
      request.status !== "removed" &&
      request.status !== "added"
  );

  const swingRequests = visibleRequests.filter(
    (request) => request.request_type === "swing"
  );

  const lineDanceRequests = visibleRequests.filter(
    (request) => request.request_type === "line_dance"
  );

  function RequestCard({ request }: { request: RequestItem }) {
    const isQueueing = queueingId === request.id;

    return (
      <article className="group grid grid-cols-[56px_64px_minmax(0,1fr)] items-center gap-3 border-b border-white/15 px-1 py-5 transition duration-200 last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[68px_82px_minmax(0,1fr)_auto] sm:gap-5 sm:px-3">
        <div className="flex shrink-0 flex-col items-center justify-center">
          <span className="font-heading grid h-11 w-11 place-items-center bg-[#c4202f] text-2xl leading-none text-white sm:h-13 sm:w-13 sm:text-3xl">
            {request.votes}
          </span>
          <span className="font-heading mt-2 text-[10px] uppercase tracking-[0.12em] text-white/40 sm:text-xs">
            {request.votes === 1 ? "Vote" : "Votes"}
          </span>
        </div>

        {request.album_image ? (
          <img
            src={request.album_image}
            alt={`${request.track_name} album artwork`}
            className="aspect-square h-16 w-16 shrink-0 border border-white/10 object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-[#c4202f]/45 bg-[#0d0d0d] text-xl text-white/25 sm:h-20 sm:w-20">
            ♪
          </div>
        )}

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-heading truncate text-base font-black text-white sm:text-xl">
              {request.track_name}
            </h3>
            {request.explicit ? <ExplicitBadge /> : null}
          </div>
          <p className="mt-1 truncate text-sm text-white/55 sm:text-base">
            {request.artist_name}
          </p>
          {request.album_name ? (
            <p className="mt-1 truncate text-xs text-white/30 sm:text-sm">
              {request.album_name}
            </p>
          ) : null}

        </div>

        <div className="col-span-3 flex items-center justify-end gap-2 pt-1 sm:col-span-1 sm:pt-0">
          <button
            type="button"
            disabled={isQueueing}
            onClick={() => void addToQueue(request.id)}
            aria-label={`Add ${request.track_name} to Spotify queue`}
            title="Add to Spotify Queue"
            className="grid h-11 w-11 place-items-center border-2 border-[#c4202f] bg-transparent text-3xl font-light leading-none text-white transition hover:bg-[#c4202f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
          >
            {isQueueing ? <span className="text-sm">•••</span> : <span aria-hidden="true">+</span>}
          </button>

          <button
            type="button"
            onClick={() => void updateStatus(request.id, "played")}
            className="font-heading h-11 border-2 border-white/20 px-3 text-sm uppercase tracking-[0.06em] text-white/60 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white sm:h-12"
          >
            Played
          </button>

          <button
            type="button"
            onClick={() => void updateStatus(request.id, "removed")}
            aria-label={`Remove ${request.track_name}`}
            title="Remove"
            className="grid h-11 w-11 place-items-center border-2 border-white/25 bg-transparent text-2xl font-bold leading-none text-white/70 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white active:scale-95 sm:h-12 sm:w-12"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </article>
    );
  }

  function QueueTrackCard({
    track,
    queuePosition,
  }: {
    track: SpotifyQueueTrack;
    queuePosition: number;
  }) {
    const isChangingType = queueTypeUpdatingTrackId === track.id;

    return (
      <article className="grid grid-cols-[48px_64px_minmax(0,1fr)] items-center gap-3 border-b border-white/15 px-1 py-4 last:border-b-0 sm:grid-cols-[58px_76px_minmax(0,1fr)_auto] sm:gap-5 sm:px-3">
        <div className="font-heading grid h-10 w-10 place-items-center border border-[#c4202f]/60 bg-[#c4202f]/10 text-xl text-[#ff9aa3] sm:h-11 sm:w-11">
          {queuePosition}
        </div>

        {track.image ? (
          <img
            src={track.image}
            alt={`${track.name} album artwork`}
            className="h-16 w-16 border border-white/10 object-cover sm:h-18 sm:w-18"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center border border-white/10 bg-black text-xl text-white/25 sm:h-18 sm:w-18">
            ♪
          </div>
        )}

        <div className="min-w-0">
          <p className="font-heading text-xs uppercase tracking-[0.12em] text-[#c4202f]">
            Up Next {queuePosition}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <h3 className="font-heading truncate text-lg text-white sm:text-xl">
              {track.name}
            </h3>
            {track.explicit ? <ExplicitBadge /> : null}
          </div>
          <p className="mt-1 truncate text-sm text-white/55">{track.artist}</p>
          {track.album ? (
            <p className="mt-1 truncate text-xs text-white/30">{track.album}</p>
          ) : null}
          {track.requestId ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
              Linked to song request
            </p>
          ) : null}

          {track.requestType === "line_dance" ? (
            track.lineDance ? (
              <div className="mt-3 border-l-2 border-[#c4202f] pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-sm uppercase tracking-[0.06em] text-white">
                    {track.lineDance.name}
                  </span>
                  <span className="border border-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/55">
                    {track.lineDance.isOriginalSong
                      ? "Original"
                      : "Song Swap"}
                  </span>
                </div>

                {track.lineDance.alsoKnownAs ? (
                  <p className="mt-1 text-xs text-white/40">
                    Also Known As: {track.lineDance.alsoKnownAs}
                  </p>
                ) : null}

                {!track.lineDance.isOriginalSong &&
                track.lineDance.originalSong ? (
                  <p className="mt-1 text-xs text-white/40">
                    Original:{" "}
                    {track.lineDance.originalSong.trackName} —{" "}
                    {track.lineDance.originalSong.artistName}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 border-l-2 border-white/15 pl-3 text-xs text-white/30">
                No choreography is linked to this song in the Line Dance Manager.
              </p>
            )
          ) : null}
        </div>

        <div className="col-span-3 sm:col-span-1 sm:justify-self-end">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/35 sm:text-right">
            Queue Category
          </p>
          <div className="inline-grid grid-cols-2 border border-white/15 bg-black">
            <button
              type="button"
              disabled={isChangingType}
              onClick={() => void updateQueueTrackType(track, "line_dance")}
              className={`font-heading px-3 py-2 text-[10px] uppercase tracking-[0.08em] transition sm:text-xs ${
                track.requestType === "line_dance"
                  ? "bg-[#c4202f] text-white"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Line Dance
            </button>
            <button
              type="button"
              disabled={isChangingType}
              onClick={() => void updateQueueTrackType(track, "swing")}
              className={`font-heading border-l border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.08em] transition sm:text-xs ${
                track.requestType === "swing"
                  ? "bg-[#c4202f] text-white"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Swing Song
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-10 pt-8 text-white sm:px-6 sm:pb-14 sm:pt-10">
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
              Live Requests
            </p>
            <h1 className="font-heading mt-2 text-5xl uppercase leading-none tracking-[0.035em] text-white sm:text-7xl">
              DJ Dashboard
            </h1>
            <p className="mt-3 text-sm uppercase tracking-[0.14em] text-white/35">
              Event: {slug}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboard(false)}
              className="font-heading border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.08em] text-white/75 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={logout}
              className="font-heading border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.08em] text-white/75 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white"
            >
              Log Out
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-6 border-l-4 border-[#c4202f] bg-[#c4202f]/10 px-5 py-4 text-red-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mb-6 border-l-4 border-white/40 bg-white/5 px-5 py-4 text-white/80">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="border-y border-white/15 py-16 text-center">
            <p className="font-heading text-2xl uppercase tracking-[0.08em] text-white/35">
              Loading Dashboard…
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <section className="border border-[#c4202f]/50 bg-[#0d0d0d]">
              <div
                className={`flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7 ${
                  queueCollapsed ? "" : "border-b border-white/15"
                }`}
              >
                <div>
                  <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
                    Spotify
                  </p>
                  <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
                    Running Queue
                  </h2>
                  <p className="mt-2 text-sm text-white/40">
                    {spotifyQueue.length} {spotifyQueue.length === 1 ? "upcoming song" : "upcoming songs"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setQueueCollapsed((current) => !current)}
                  aria-expanded={!queueCollapsed}
                  className="font-heading border-2 border-[#c4202f] px-4 py-2 text-base uppercase tracking-[0.06em] text-white transition hover:bg-[#c4202f]"
                >
                  {queueCollapsed ? "Show Queue" : "Hide Queue"}
                </button>
              </div>

              {!queueCollapsed ? (
                <div className="px-3 sm:px-5">
                  {spotifyQueue.map((track, index) => (
                    <QueueTrackCard
                      key={`${track.uri}-${index}`}
                      track={track}
                      queuePosition={index + 1}
                    />
                  ))}

                  {spotifyQueue.length === 0 ? (
                    <p className="py-12 text-center text-white/30">
                      Spotify has no upcoming queued songs.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <div className="grid gap-12 lg:grid-cols-2 lg:gap-10">
              <section className="min-w-0">
                <div className="flex items-end justify-between gap-4 border-b-2 border-[#c4202f] pb-4">
                  <h2 className="font-heading text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
                    Line Dances
                  </h2>
                  <span className="font-heading text-lg text-white/35">
                    {lineDanceRequests.length}
                  </span>
                </div>

                <div>
                  {lineDanceRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))}

                  {lineDanceRequests.length === 0 ? (
                    <p className="py-12 text-center text-white/30">
                      No line dance requests.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="min-w-0">
                <div className="flex items-end justify-between gap-4 border-b-2 border-[#c4202f] pb-4">
                  <h2 className="font-heading text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
                    Swing Songs
                  </h2>
                  <span className="font-heading text-lg text-white/35">
                    {swingRequests.length}
                  </span>
                </div>

                <div>
                  {swingRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))}

                  {swingRequests.length === 0 ? (
                    <p className="py-12 text-center text-white/30">
                      No swing requests.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
