"use client";

import { useEffect, useState } from "react";

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

export default function AdminPage() {
  const slug = "big-iron";

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [queueCollapsed, setQueueCollapsed] = useState(false);

  async function loadRequests() {
    try {
      setError("");

      const response = await fetch(
        `/api/admin/all-requests?event=${encodeURIComponent(slug)}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load requests."
        );
      }

      const combined: RequestItem[] =
        data.requests ?? [];

      combined.sort(
        (a, b) => Number(b.votes) - Number(a.votes)
      );

      setRequests(combined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addToPlaylist(requestId: string) {
    try {
      setError("");
      setMessage("");
      setQueueingId(requestId);

      const response = await fetch(
        "/api/spotify/add-to-playlist",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
        currentRequests.map((request) =>
          request.id === requestId
            ? { ...request, status: "added" }
            : request
        )
      );

      setMessage("Song added to the running queue.");
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
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
            "Content-Type": "application/json",
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
          data.error ?? "Unable to update request."
        );
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (request) => request.id !== requestId
        )
      );

      setMessage(
        status === "played"
          ? "Song marked as played."
          : "Song removed."
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
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    window.location.href = "/admin-login";
  }

  useEffect(() => {
    void loadRequests();

    const interval = window.setInterval(() => {
      void loadRequests();
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const visibleRequests = requests.filter(
    (request) =>
      request.status !== "played" &&
      request.status !== "removed"
  );

  const runningQueue = visibleRequests.filter(
    (request) => request.status === "added"
  );

  const pendingRequests = visibleRequests.filter(
    (request) => request.status !== "added"
  );

  const swingRequests = pendingRequests.filter(
    (request) => request.request_type === "swing"
  );

  const lineDanceRequests = pendingRequests.filter(
    (request) =>
      request.request_type === "line_dance"
  );

  function RequestCard({
    request,
    queued = false,
    queuePosition,
  }: {
    request: RequestItem;
    queued?: boolean;
    queuePosition?: number;
  }) {
    const isQueueing = queueingId === request.id;

    return (
      <article className="group grid grid-cols-[56px_64px_minmax(0,1fr)] items-center gap-3 border-b border-white/15 px-1 py-5 transition duration-200 last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[68px_82px_minmax(0,1fr)_auto] sm:gap-5 sm:px-3">
        <div className="flex shrink-0 flex-col items-center justify-center">
          <span className="font-heading grid h-11 w-11 place-items-center rounded-full bg-[#c4202f] text-2xl leading-none text-white sm:h-13 sm:w-13 sm:text-3xl">
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-white/10 bg-[#111] text-xl text-white/25 sm:h-20 sm:w-20">
            ♪
          </div>
        )}

        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-white sm:text-xl">
            {request.track_name}
          </h3>

          <p className="mt-1 truncate text-sm text-white/55 sm:text-base">
            {request.artist_name}
          </p>

          {request.album_name ? (
            <p className="mt-1 truncate text-xs text-white/30 sm:text-sm">
              {request.album_name}
            </p>
          ) : null}

          {queued && queuePosition ? (
            <p className="font-heading mt-2 text-sm uppercase tracking-[0.1em] text-[#c4202f] sm:text-base">
              Queue Position {queuePosition}
            </p>
          ) : null}
        </div>

        <div className="col-span-3 flex items-center justify-end gap-2 pt-1 sm:col-span-1 sm:pt-0">
          {!queued ? (
            <button
              type="button"
              disabled={isQueueing}
              onClick={() => addToPlaylist(request.id)}
              aria-label={`Add ${request.track_name} to queue`}
              title="Add to Queue"
              className="grid h-11 w-11 place-items-center rounded-md border-2 border-[#c4202f] bg-transparent text-3xl font-light leading-none text-white transition hover:bg-[#c4202f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
            >
              {isQueueing ? (
                <span className="text-sm">•••</span>
              ) : (
                <span aria-hidden="true">+</span>
              )}
            </button>
          ) : null}

          {queued ? (
            <button
              type="button"
              onClick={() =>
                updateStatus(request.id, "played")
              }
              className="font-heading h-11 rounded-md border-2 border-[#c4202f] bg-[#c4202f] px-4 text-base uppercase tracking-[0.06em] text-white transition hover:bg-[#df2939] active:scale-95 sm:h-12 sm:px-5 sm:text-lg"
            >
              Played
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              updateStatus(request.id, "removed")
            }
            aria-label={`Remove ${request.track_name}`}
            title="Remove"
            className="grid h-11 w-11 place-items-center rounded-md border-2 border-white/25 bg-transparent text-2xl font-bold leading-none text-white/70 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white active:scale-95 sm:h-12 sm:w-12"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-10 pt-8 text-white sm:px-6 sm:pb-14 sm:pt-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.20),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />

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

          <button
            type="button"
            onClick={logout}
            className="font-heading self-start rounded-md border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.08em] text-white/75 transition hover:border-[#c4202f] hover:bg-[#c4202f] hover:text-white sm:self-auto"
          >
            Log Out
          </button>
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
              Loading Requests…
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <section className="border border-[#c4202f]/50 bg-[#0d0d0d]">
              <div
                className={`flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7 ${
                  queueCollapsed
                    ? ""
                    : "border-b border-white/15"
                }`}
              >
                <div>
                  <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
                    Live
                  </p>
                  <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
                    Running Queue
                  </h2>
                  <p className="mt-2 text-sm text-white/40">
                    {runningQueue.length}{" "}
                    {runningQueue.length === 1
                      ? "song"
                      : "songs"}{" "}
                    queued
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setQueueCollapsed(
                      (current) => !current
                    )
                  }
                  aria-expanded={!queueCollapsed}
                  className="font-heading rounded-md border-2 border-[#c4202f] px-4 py-2 text-base uppercase tracking-[0.06em] text-white transition hover:bg-[#c4202f]"
                >
                  {queueCollapsed
                    ? "Show Queue"
                    : "Hide Queue"}
                </button>
              </div>

              {!queueCollapsed ? (
                <div className="px-3 sm:px-5">
                  {runningQueue.map(
                    (request, index) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        queued
                        queuePosition={index + 1}
                      />
                    )
                  )}

                  {runningQueue.length === 0 ? (
                    <p className="py-12 text-center text-white/30">
                      The running queue is empty.
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
                  {lineDanceRequests.map(
                    (request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                      />
                    )
                  )}

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
                  {swingRequests.map(
                    (request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                      />
                    )
                  )}

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