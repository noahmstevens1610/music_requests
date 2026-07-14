"use client";

import { useEffect, useState } from "react";
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

export default function AdminPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueingId, setQueueingId] = useState<string | null>(
    null
  );

  async function loadRequests() {
    try {
      setError("");

      const response = await fetch(
        `/api/requests?event=${encodeURIComponent(slug)}`,
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

      const combined: RequestItem[] = [
        ...(data.swingRequests ?? []),
        ...(data.lineDanceRequests ?? []),
      ];

      combined.sort(
        (a, b) => Number(b.votes) - Number(a.votes)
      );

      setRequests(combined);
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
        currentRequests.filter(
          (request) => request.id !== requestId
        )
      );

      setMessage("Song added to the playlist and removed from requests.");
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

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    window.location.href =
      "/admin/login";
  }

  useEffect(() => {
    if (!slug) return;

    loadRequests();

    const interval = window.setInterval(
      () => {
        loadRequests();
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

  const swingRequests = activeRequests.filter(
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

    return (
      <div className="rounded-2xl border border-neutral-800 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
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

              {request.status ===
                "added" && (
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
                request.status ===
                  "added"
              }
              onClick={() =>
                addToPlaylist(
                  request.id
                )
              }
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {request.status ===
              "added"
                ? "Added"
                : isQueueing
                ? "Adding..."
                : "Add"}
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

              {swingRequests.length ===
                0 && (
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