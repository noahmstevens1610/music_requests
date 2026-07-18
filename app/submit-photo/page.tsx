"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const EVENT_SLUG = "big-iron";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function getOrCreateDeviceId() {
  const storageKey = "big-iron-photo-device-id";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) return existing;

  const created =
    window.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(storageKey, created);
  return created;
}

export default function SubmitPhotoPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(photo);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setSuccess("");

    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      setPhoto(null);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setPhoto(null);
      setError("Please choose an image file.");
      return;
    }

    if (selected.size > MAX_UPLOAD_BYTES) {
      setPhoto(null);
      setError("Photo must be 10 MB or smaller.");
      return;
    }

    setPhoto(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!photo) {
      setError("Please choose a photo first.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("eventSlug", EVENT_SLUG);
      formData.append("deviceId", deviceId);

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to upload the photo.");
      }

      setSuccess(
        data.message ??
          "Thanks! Your photo has been submitted for approval."
      );
      setPhoto(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the photo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-10 pt-0 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_32%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="-mx-4 overflow-hidden sm:-mx-6">
          <img
            src="/song-requests-banner.png"
            alt="Big Iron Country Swing photo submissions"
            className="block h-auto w-full object-contain"
          />
        </header>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl sm:p-6">
          <div className="border-b-2 border-[#c4202f] pb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Big Iron Country Swing
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.035em] text-white sm:text-4xl">
              Submit a Photo
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              Share a photo from tonight. Every photo is reviewed before it appears on the projector.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/55">
                Choose a photo
              </span>

              <div className="rounded-2xl border border-white/15 bg-black p-3 transition focus-within:border-[#c4202f]">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="block w-full cursor-pointer text-sm font-bold text-white/60 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-3 file:text-sm file:font-black file:text-black hover:file:bg-white/90"
                />
              </div>
            </label>

            {previewUrl ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-3 shadow-lg">
                <img
                  src={previewUrl}
                  alt="Selected photo preview"
                  className="max-h-[58vh] w-full rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/45 px-6 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl text-white/30">
                    +
                  </div>
                  <p className="mt-4 font-black text-white/70">
                    Your photo preview will appear here
                  </p>
                  <p className="mt-1 text-sm text-white/35">
                    JPG, PNG, WebP, HEIC, or HEIF. Maximum 10 MB.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm font-semibold text-red-200">
                {error}
              </p>
            )}

            {success && (
              <p className="mt-4 rounded-xl border border-[#c4202f]/50 bg-[#c4202f]/15 p-3 text-sm font-semibold text-white">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={!photo || submitting}
              className="mt-5 w-full rounded-2xl bg-[#c4202f] px-5 py-4 text-lg font-black uppercase tracking-wide text-white transition hover:bg-[#d9293a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Uploading…" : "Submit for Approval"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}