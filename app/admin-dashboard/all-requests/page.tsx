"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
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

const statusOrder = [
  "pending",
  "approved",
  "added",
  "played",
  "removed",
];

function labelStatus(status: string) {
  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

function AllRequestsContent() {
  const searchParams = useSearchParams();
  const slug =
    searchParams.get("event")?.trim() || "big-iron";

  const [eventName, setEventName] =
    useState("Event");
  const [requests, setRequests] = useState<
    RequestItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showResetWarning, setShowResetWarning] =
    useState(false);
  const [confirmation, setConfirmation] =
    useState("");
  const [resetting, setResetting] =
    useState(false);

  async function loadRequests() {
    try {
      setError("");

      const response = await fetch(
        `/api/admin/all-requests?event=${encodeURIComponent(
          slug
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load requests."
        );
      }

      setEventName(data.event?.name ?? slug);
      setRequests(data.requests ?? []);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load requests."
      );
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
      requests: requests.filter(
        (request) => request.status === status
      ),
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

      const response = await fetch(
        "/api/admin/all-requests",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventSlug: slug,
            confirmation,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to clear requests."
        );
      }

      setRequests([]);
      setMessage(
        data.message ?? "All requests were cleared."
      );
      setShowResetWarning(false);
      setConfirmation("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to clear requests."
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-12 pt-8 text-white sm:px-6 sm:pb-16 sm:pt-10">

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
              {eventName}
            </p>

            <h1 className="font-heading mt-2 text-5xl uppercase leading-none tracking-[0.035em] text-white sm:text-7xl">
              All Requests
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
              Review every request from this event,
              including pending, queued, played, and
              removed songs.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowResetWarning(true);
              setConfirmation("");
              setError("");
            }}
            className="font-heading self-start  border-2 border-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.07em] text-white transition hover:bg-[#c4202f] active:scale-95 sm:self-auto"
          >
            Reset Event
          </button>
        </header>

        {message ? (
          <div className="mt-6 border-l-4 border-white/40 bg-white/5 px-5 py-4 text-white/80">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 border-l-4 border-[#c4202f] bg-[#c4202f]/10 px-5 py-4 text-red-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-10 border-y border-white/15 py-16 text-center">
            <p className="font-heading text-2xl uppercase tracking-[0.08em] text-white/35">
              Loading Requests…
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-10 border border-dashed border-white/20 bg-[#0d0d0d] px-6 py-16 text-center">
            <p className="font-heading text-3xl uppercase tracking-[0.06em] text-white/25">
              No Requests
            </p>

            <p className="mt-3 text-sm text-white/35">
              There are no requests for this event.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {groupedRequests.map((group) =>
              group.requests.length > 0 ? (
                <section
                  key={group.status}
                  className="min-w-0"
                >
                  <div className="flex items-end justify-between gap-4 border-b-2 border-[#c4202f] pb-4">
                    <div>
                      <p className="font-heading text-xs uppercase tracking-[0.18em] text-[#c4202f]">
                        Request Status
                      </p>

                      <h2 className="font-heading mt-1 text-3xl uppercase tracking-[0.05em] text-white sm:text-4xl">
                        {labelStatus(group.status)}
                      </h2>
                    </div>

                    <span className="font-heading text-xl text-white/35">
                      {group.requests.length}
                    </span>
                  </div>

                  <div>
                    {group.requests.map(
                      (request) => (
                        <article
                          key={request.id}
                          className="group grid grid-cols-[56px_64px_minmax(0,1fr)] items-center gap-3 border-b border-white/15 px-1 py-5 transition duration-200 last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[68px_82px_minmax(0,1fr)_auto] sm:gap-5 sm:px-3"
                        >
                          <div className="flex shrink-0 flex-col items-center justify-center">
                            <span className="font-heading grid h-11 w-11 place-items-center  bg-[#c4202f] text-2xl leading-none text-white sm:h-13 sm:w-13 sm:text-3xl">
                              {request.votes}
                            </span>

                            <span className="font-heading mt-2 text-[10px] uppercase tracking-[0.12em] text-white/40 sm:text-xs">
                              {request.votes === 1
                                ? "Vote"
                                : "Votes"}
                            </span>
                          </div>

                          {request.album_image ? (
                            <img
                              src={
                                request.album_image
                              }
                              alt={`${request.track_name} album artwork`}
                              className="aspect-square h-16 w-16 shrink-0 border border-white/10 object-cover sm:h-20 sm:w-20"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-[#c4202f]/45 bg-[#0d0d0d] text-xl text-white/25 sm:h-20 sm:w-20">
                              ♪
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="font-heading truncate text-base font-black text-white sm:text-xl">
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
                          </div>

                          <div className="col-span-3 flex flex-wrap items-center justify-end gap-2 pt-1 sm:col-span-1 sm:pt-0">
                            <span className="font-heading border border-white/20 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.08em] text-white/60">
                              {request.request_type ===
                              "line_dance"
                                ? "Line Dance"
                                : "Swing Song"}
                            </span>

                            <span className="font-heading border border-[#c4202f]/60 bg-[#c4202f]/10 px-3 py-2 text-xs uppercase tracking-[0.08em] text-[#ffadb5]">
                              {labelStatus(
                                request.status
                              )}
                            </span>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                </section>
              ) : null
            )}
          </div>
        )}
      </div>

      {showResetWarning ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-[#c4202f]/60 bg-[#0d0d0d] shadow-2xl">
            <div className="border-b border-[#c4202f]/50 px-6 py-5">
              <p className="font-heading text-sm uppercase tracking-[0.18em] text-[#c4202f]">
                Warning
              </p>

              <h2 className="font-heading mt-2 text-3xl uppercase tracking-[0.04em] text-white">
                Clear Every Request?
              </h2>
            </div>

            <div className="p-6">
              <p className="leading-7 text-white/55">
                This permanently deletes pending,
                added, played, and removed requests
                along with their votes. Songs will then
                be requestable again for the next
                event.
              </p>

              <label className="mt-6 block">
                <span className="font-heading mb-2 block text-sm uppercase tracking-[0.08em] text-white/65">
                  Type{" "}
                  <span className="text-white">
                    RESET
                  </span>{" "}
                  to continue
                </span>

                <input
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(
                      event.target.value.toUpperCase()
                    )
                  }
                  autoFocus
                  className="w-full border-2 border-white/20 bg-black px-4 py-3 font-black tracking-[0.18em] text-white outline-none transition focus:border-[#c4202f]"
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
                  className="font-heading  border-2 border-white/20 px-5 py-3 text-base uppercase tracking-[0.06em] text-white/70 transition hover:border-white/40 hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    confirmation !== "RESET" ||
                    resetting
                  }
                  onClick={resetRequests}
                  className="font-heading  border-2 border-[#c4202f] bg-[#c4202f] px-5 py-3 text-base uppercase tracking-[0.06em] text-white transition hover:bg-[#df2939] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {resetting
                    ? "Clearing…"
                    : "Permanently Clear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function AllRequestsPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white">
          <div className="relative mx-auto max-w-7xl border-y border-white/15 py-16 text-center">
            <p className="font-heading text-2xl uppercase tracking-[0.08em] text-white/35">
              Loading Requests…
            </p>
          </div>
        </main>
      }
    >
      <AllRequestsContent />
    </Suspense>
  );
}