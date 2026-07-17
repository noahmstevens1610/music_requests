"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type RequestItem = {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  album_image: string | null;
  votes: number;
  status: string;
  request_type: "swing" | "line_dance";
  created_at: string;
};

const statusOrder = ["pending", "approved", "added", "played", "removed"];

function labelStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function AllRequestsContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("event")?.trim() || "big-iron";

  const [eventName, setEventName] = useState("Event");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);

  async function loadRequests() {
    try {
      setError("");
      const response = await fetch(
        `/api/admin/all-requests?event=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load requests.");
      }

      setEventName(data.event?.name ?? slug);
      setRequests(data.requests ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, [slug]);

  const groupedRequests = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      requests: requests.filter((request) => request.status === status),
    }));
  }, [requests]);

  async function resetRequests() {
    if (confirmation !== "RESET") {
      return;
    }

    try {
      setResetting(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/all-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug: slug, confirmation }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to clear requests.");
      }

      setRequests([]);
      setMessage(data.message ?? "All requests were cleared.");
      setShowResetWarning(false);
      setConfirmation("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to clear requests.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#ff7b86]">
              {eventName}
            </p>
            <h1 className="mt-2 text-4xl font-black">All Requests</h1>
            <p className="mt-2 text-white/55">
              View pending, added, played, and removed songs from this event.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResetWarning(true);
              setConfirmation("");
              setError("");
            }}
            className="rounded-xl border border-red-500/50 bg-red-950/50 px-5 py-3 font-black text-red-200 transition hover:bg-red-900/60"
          >
            Reset Event Requests
          </button>
        </div>

        {message && (
          <p className="mt-6 rounded-2xl border border-green-500/30 bg-green-950/40 p-4 text-green-200">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-white/50">Loading requests…</p>
        ) : requests.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/20 bg-[#101010] p-12 text-center text-white/45">
            There are no requests for this event.
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {groupedRequests.map((group) =>
              group.requests.length > 0 ? (
                <section key={group.status}>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-xl font-black">{labelStatus(group.status)}</h2>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/65">
                      {group.requests.length}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.requests.map((request) => (
                      <article
                        key={request.id}
                        className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-[#111111] p-3"
                      >
                        {request.album_image ? (
                          <img
                            src={request.album_image}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/25">
                            ♪
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black">{request.track_name}</p>
                          <p className="truncate text-sm text-white/55">{request.artist_name}</p>
                          {request.album_name && (
                            <p className="truncate text-xs text-white/30">{request.album_name}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-white/65">
                              {request.request_type === "line_dance" ? "Line Dance" : "Swing Song"}
                            </span>
                            <span className="rounded-full bg-[#c4202f]/20 px-2 py-1 text-[#ffadb5]">
                              {request.votes} {request.votes === 1 ? "vote" : "votes"}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null
            )}
          </div>
        )}
      </div>

      {showResetWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/40 bg-[#111111] p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-400">Warning</p>
            <h2 className="mt-2 text-2xl font-black">Clear every request for this event?</h2>
            <p className="mt-3 text-white/60">
              This permanently deletes pending, added, played, and removed requests along with their votes. Songs will then be requestable again for the next event.
            </p>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-white/75">
                Type <span className="text-white">RESET</span> to continue
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
                autoFocus
                className="w-full rounded-xl border border-red-500/40 bg-black px-4 py-3 font-black tracking-widest outline-none focus:border-red-400"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  setShowResetWarning(false);
                  setConfirmation("");
                }}
                className="rounded-xl bg-white/10 px-5 py-3 font-bold hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmation !== "RESET" || resetting}
                onClick={resetRequests}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resetting ? "Clearing…" : "Permanently Clear Requests"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


export default function AllRequestsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black px-4 py-8 text-white">
          <div className="mx-auto max-w-7xl">
            <p className="text-white/50">Loading requests…</p>
          </div>
        </main>
      }
    >
      <AllRequestsContent />
    </Suspense>
  );
}
