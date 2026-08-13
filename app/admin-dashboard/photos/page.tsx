"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PhotoStatus = "pending" | "approved" | "rejected";

type GuestPhoto = {
  id: string;
  event_slug: string;
  storage_path: string;
  image_url: string;
  status: PhotoStatus;
  device_id: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  reviewed_at: string | null;
};

type Counts = {
  pending: number;
  approved: number;
  rejected: number;
};

const emptyCounts: Counts = {
  pending: 0,
  approved: 0,
  rejected: 0,
};

const DEFAULT_GUEST_DURATION_SECONDS = 7;

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPhotosPage() {
  const eventSlug = "big-iron";

  const [activeTab, setActiveTab] = useState<PhotoStatus>("pending");
  const [photos, setPhotos] = useState<GuestPhoto[]>([]);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guestDurationSeconds, setGuestDurationSeconds] = useState(
    DEFAULT_GUEST_DURATION_SECONDS
  );
  const [savingDuration, setSavingDuration] = useState(false);

  const loadPhotos = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError("");

      const response = await fetch(
        `/api/admin/photos?event=${encodeURIComponent(eventSlug)}`,
        { cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.href = `/admin-login?next=${encodeURIComponent(
          "/admin-dashboard/photos"
        )}`;
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load photos.");
      }

      setPhotos(data.photos ?? []);
      setCounts(data.counts ?? emptyCounts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load photos."
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadPhotoTiming = useCallback(async () => {
    try {
      const response = await fetch("/api/photos/settings", {
        cache: "no-store",
      });
      const data = await response.json();

      if (response.ok && data.settings) {
        setGuestDurationSeconds(
          data.settings.guestDurationSeconds ??
            DEFAULT_GUEST_DURATION_SECONDS
        );
      }
    } catch (settingsError) {
      console.error("Unable to load guest photo timing:", settingsError);
    }
  }, []);

  useEffect(() => {
    void loadPhotos();
    void loadPhotoTiming();

    const interval = window.setInterval(() => {
      void loadPhotos(true);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadPhotoTiming, loadPhotos]);

  const visiblePhotos = useMemo(
    () => photos.filter((photo) => photo.status === activeTab),
    [photos, activeTab]
  );

  async function changeStatus(photoId: string, status: PhotoStatus) {
    try {
      setWorkingId(photoId);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, status }),
      });

      if (response.status === 401) {
        window.location.href = "/admin-login?next=/admin-dashboard/photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update photo.");
      }

      setPhotos((current) =>
        current.map((photo) =>
          photo.id === photoId ? data.photo : photo
        )
      );

      setCounts((current) => {
        const original = photos.find((photo) => photo.id === photoId);

        if (!original || original.status === status) return current;

        return {
          ...current,
          [original.status]: Math.max(0, current[original.status] - 1),
          [status]: current[status] + 1,
        };
      });

      setMessage(
        status === "approved"
          ? "Photo approved for the back-wall slideshow."
          : status === "rejected"
            ? "Photo moved to Removed."
            : "Photo restored to Pending."
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update photo."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function permanentlyDelete(photo: GuestPhoto) {
    const confirmed = window.confirm(
      "Permanently delete this photo? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setWorkingId(photo.id);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete photo.");
      }

      setPhotos((current) =>
        current.filter((item) => item.id !== photo.id)
      );
      setCounts((current) => ({
        ...current,
        rejected: Math.max(0, current.rejected - 1),
      }));
      setMessage("Photo permanently deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete photo."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function saveGuestDuration() {
    try {
      setSavingDuration(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/photos/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestDurationSeconds }),
      });

      if (response.status === 401) {
        window.location.href =
          "/admin-login?next=/admin-dashboard/photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to save guest photo timing."
        );
      }

      setGuestDurationSeconds(
        data.settings?.guestDurationSeconds ?? guestDurationSeconds
      );
      setMessage("Guest photo display time saved.");
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : "Unable to save guest photo timing."
      );
    } finally {
      setSavingDuration(false);
    }
  }

  const tabs: Array<{ status: PhotoStatus; label: string }> = [
    { status: "pending", label: "Pending" },
    { status: "approved", label: "Approved" },
    { status: "rejected", label: "Removed" },
  ];

  return (
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#c4202f]/45 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff7b86]">
              Admin Dashboard
            </p>
            <h1 className="font-heading mt-2 text-4xl font-black">Guest Photos</h1>
            <p className="mt-2 text-white/45">
              Review photos before they appear on the back wall. Approved submissions are randomized on the projector.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin-dashboard"
              className=" border border-white/15 px-4 py-3 font-semibold hover:bg-[#151515]"
            >
              Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void loadPhotos()}
              className=" bg-[#c4202f] px-4 py-3 font-bold hover:bg-[#d9293a]"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5  border border-red-500/40 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5  border border-green-500/40 bg-green-950/40 p-4 text-green-200">
            {message}
          </div>
        )}

        <section className="mb-6 border border-[#c4202f]/45 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Guest Photo Display Time
              </p>
              <p className="mt-2 text-sm text-white/40">
                Approved guest submissions play in a new random order each slideshow cycle.
              </p>
            </div>

            <div className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  Seconds
                </span>
                <input
                  type="number"
                  min={2}
                  max={60}
                  step={1}
                  value={guestDurationSeconds}
                  onChange={(event) =>
                    setGuestDurationSeconds(Number(event.target.value))
                  }
                  className="w-24 border border-white/15 bg-black px-3 py-3 text-center font-bold text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveGuestDuration()}
                disabled={savingDuration}
                className="bg-[#c4202f] px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {savingDuration ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>

        <nav className="mb-6 grid grid-cols-3 gap-2  border border-white/10 bg-black p-2">
          {tabs.map((tab) => (
            <button
              key={tab.status}
              type="button"
              onClick={() => setActiveTab(tab.status)}
              className={` px-3 py-3 text-sm font-bold transition sm:text-base ${
                activeTab === tab.status
                  ? "bg-[#c4202f] text-white"
                  : "text-white/45 hover:bg-[#0d0d0d] hover:text-white"
              }`}
            >
              {tab.label}
              <span className="ml-2  bg-black/30 px-2 py-0.5 text-xs">
                {counts[tab.status]}
              </span>
            </button>
          ))}
        </nav>

        {loading ? (
          <p className="text-white/45">Loading guest photos...</p>
        ) : visiblePhotos.length === 0 ? (
          <div className=" border border-dashed border-white/15 p-12 text-center text-white/35">
            No {activeTab === "rejected" ? "removed" : activeTab} photos.
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiblePhotos.map((photo) => {
              const working = workingId === photo.id;

              return (
                <article
                  key={photo.id}
                  className="overflow-hidden  border border-[#c4202f]/45 bg-black shadow-xl"
                >
                  <a
                    href={photo.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-[4/3] bg-[#0d0d0d]"
                  >
                    <img
                      src={photo.image_url}
                      alt="Guest submitted event photo"
                      className="h-full w-full object-contain"
                    />
                  </a>

                  <div className="p-4">
                    <p className="font-semibold text-white">
                      {formatDate(photo.created_at)}
                    </p>
                    <p className="mt-1 truncate text-sm text-white/35">
                      {photo.original_filename || "Guest photo"} ·{" "}
                      {formatFileSize(photo.file_size_bytes)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {photo.status === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void changeStatus(photo.id, "approved")
                            }
                            className="flex-1  bg-green-700 px-3 py-3 font-bold hover:bg-green-600 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void changeStatus(photo.id, "rejected")
                            }
                            className="flex-1  bg-red-700 px-3 py-3 font-bold hover:bg-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </>
                      )}

                      {photo.status === "approved" && (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            void changeStatus(photo.id, "rejected")
                          }
                          className="w-full  bg-red-700 px-3 py-3 font-bold hover:bg-red-600 disabled:opacity-50"
                        >
                          Remove from Slideshow
                        </button>
                      )}

                      {photo.status === "rejected" && (
                        <>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void changeStatus(photo.id, "pending")
                            }
                            className="flex-1  border border-neutral-600 px-3 py-3 font-bold hover:bg-[#151515] disabled:opacity-50"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => void permanentlyDelete(photo)}
                            className="flex-1  bg-red-800 px-3 py-3 font-bold hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}