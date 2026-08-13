"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";

type HousePhoto = {
  id: string;
  event_slug: string;
  storage_path: string;
  image_url: string;
  status: "approved" | "rejected";
  original_filename: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

const EVENT_SLUG = "big-iron";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_HOUSE_DURATION_SECONDS = 7;

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function HousePhotosPage() {
  const [photos, setPhotos] = useState<HousePhoto[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [houseDurationSeconds, setHouseDurationSeconds] = useState(
    DEFAULT_HOUSE_DURATION_SECONDS
  );
  const [savingDuration, setSavingDuration] = useState(false);

  const loadPhotos = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError("");

      const response = await fetch(
        `/api/admin/house-photos?event=${encodeURIComponent(EVENT_SLUG)}`,
        { cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.href =
          "/admin-login?next=/admin-dashboard/house-photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load house photos.");
      }

      setPhotos(data.photos ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load house photos."
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
        setHouseDurationSeconds(
          data.settings.houseDurationSeconds ??
            DEFAULT_HOUSE_DURATION_SECONDS
        );
      }
    } catch (settingsError) {
      console.error("Unable to load house photo timing:", settingsError);
    }
  }, []);

  useEffect(() => {
    void loadPhotos();
    void loadPhotoTiming();
  }, [loadPhotoTiming, loadPhotos]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setMessage("");

    const files = Array.from(event.target.files ?? []);

    const invalid = files.find(
      (file) =>
        !file.type.startsWith("image/") ||
        file.size > MAX_UPLOAD_BYTES
    );

    if (invalid) {
      setSelectedFiles([]);
      setError(
        "Use image files only, with each photo 10 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles(files);
  }

  async function uploadSelected() {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      let uploaded = 0;

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("eventSlug", EVENT_SLUG);

        const response = await fetch("/api/admin/house-photos", {
          method: "POST",
          body: formData,
        });

        if (response.status === 401) {
          window.location.href =
            "/admin-login?next=/admin-dashboard/house-photos";
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? `Unable to upload ${file.name}.`
          );
        }

        uploaded += 1;
      }

      setSelectedFiles([]);
      setMessage(
        `${uploaded} house ${uploaded === 1 ? "photo" : "photos"} added to the slideshow.`
      );
      await loadPhotos(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload house photos."
      );
    } finally {
      setUploading(false);
    }
  }

  async function setPhotoVisible(
    photoId: string,
    visible: boolean
  ) {
    try {
      setWorkingId(photoId);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/house-photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId,
          eventSlug: EVENT_SLUG,
          status: visible ? "approved" : "rejected",
        }),
      });

      if (response.status === 401) {
        window.location.href =
          "/admin-login?next=/admin-dashboard/house-photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update house photo.");
      }

      setPhotos((current) =>
        current.map((photo) =>
          photo.id === photoId ? data.photo : photo
        )
      );

      setMessage(
        visible
          ? "Photo added back to the slideshow."
          : "Photo hidden from the slideshow."
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update house photo."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deletePhoto(photo: HousePhoto) {
    if (!window.confirm("Permanently delete this house photo?")) return;

    try {
      setWorkingId(photo.id);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/house-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          eventSlug: EVENT_SLUG,
        }),
      });

      if (response.status === 401) {
        window.location.href =
          "/admin-login?next=/admin-dashboard/house-photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete house photo.");
      }

      setPhotos((current) =>
        current.filter((item) => item.id !== photo.id)
      );
      setMessage("House photo permanently deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete house photo."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function saveHouseDuration() {
    try {
      setSavingDuration(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/photos/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ houseDurationSeconds }),
      });

      if (response.status === 401) {
        window.location.href =
          "/admin-login?next=/admin-dashboard/house-photos";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to save house photo timing."
        );
      }

      setHouseDurationSeconds(
        data.settings?.houseDurationSeconds ?? houseDurationSeconds
      );
      setMessage("House photo display time saved.");
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : "Unable to save house photo timing."
      );
    } finally {
      setSavingDuration(false);
    }
  }

  const liveCount = photos.filter(
    (photo) => photo.status === "approved"
  ).length;

  return (
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-[#c4202f]/45 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff7b86]">
            Admin Dashboard
          </p>
          <h1 className="font-heading mt-2 text-4xl font-black">House Photos</h1>
          <p className="mt-2 max-w-2xl text-white/45">
            Upload permanent Big Iron photos for the projector. They play in
            upload order and alternate with randomized approved guest submissions.
          </p>
        </header>

        {error ? (
          <div className="mb-5  border border-red-500/40 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mb-5  border border-green-500/40 bg-green-950/40 p-4 text-green-200">
            {message}
          </div>
        ) : null}

        <section className="mb-6 border border-[#c4202f]/45 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                House Photo Display Time
              </p>
              <p className="mt-2 text-sm text-white/40">
                House photos play in upload order. Choose how long each one stays on screen.
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
                  value={houseDurationSeconds}
                  onChange={(event) =>
                    setHouseDurationSeconds(Number(event.target.value))
                  }
                  className="w-24 border border-white/15 bg-black px-3 py-3 text-center font-bold text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveHouseDuration()}
                disabled={savingDuration}
                className="bg-[#c4202f] px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {savingDuration ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8  border border-[#c4202f]/45 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Add House Photos
              </p>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={handleFiles}
                className="mt-3 block w-full cursor-pointer  border border-white/15 bg-black p-3 text-sm text-white/70 file:mr-4  file:border-0 file:bg-[#c4202f] file:px-4 file:py-2.5 file:font-bold file:text-white"
              />
              <p className="mt-2 text-xs text-white/35">
                JPG, PNG, WebP, HEIC or HEIF. Up to 10 MB each. You can select several at once.
              </p>
              {selectedFiles.length > 0 ? (
                <p className="mt-2 text-sm font-semibold text-white/70">
                  {selectedFiles.length} {selectedFiles.length === 1 ? "photo" : "photos"} selected
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void uploadSelected()}
              disabled={selectedFiles.length === 0 || uploading}
              className=" bg-[#c4202f] px-6 py-3 font-black uppercase tracking-[0.06em] text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Add to Slideshow"}
            </button>
          </div>
        </section>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-black">Saved House Photos</h2>
            <p className="mt-1 text-sm text-white/40">
              {liveCount} live · {photos.length} total
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPhotos()}
            className=" border border-white/15 bg-white/5 px-4 py-2 font-semibold text-white/75 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-white/45">Loading house photos…</p>
        ) : photos.length === 0 ? (
          <div className=" border border-dashed border-white/15 p-12 text-center text-white/35">
            No house photos yet. Upload your first set above.
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {photos.map((photo, index) => {
              const working = workingId === photo.id;
              const live = photo.status === "approved";

              return (
                <article
                  key={photo.id}
                  className="overflow-hidden  border border-[#c4202f]/45 bg-black shadow-xl"
                >
                  <div className="aspect-[4/3] bg-black p-2">
                    <img
                      src={photo.image_url}
                      alt="Big Iron house slideshow photo"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 border border-[#c4202f]/55 px-2 py-1 text-[10px] font-black text-[#ff9aa3]">
                          {index + 1}
                        </span>
                        <p className="min-w-0 truncate text-sm font-semibold text-white/75">
                          {photo.original_filename || "House photo"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0  px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                          live
                            ? "bg-green-950 text-green-300"
                            : "bg-white/10 text-white/45"
                        }`}
                      >
                        {live ? "Live" : "Hidden"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-white/35">
                      {formatFileSize(photo.file_size_bytes)}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void setPhotoVisible(photo.id, !live)
                        }
                        className=" border border-white/15 bg-white/5 px-3 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                      >
                        {live ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void deletePhoto(photo)}
                        className=" bg-red-800 px-3 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
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
