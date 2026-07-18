"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const EVENT_SLUG = "big-iron";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function getOrCreateDeviceId() {
  const storageKey = "big-iron-photo-device-id";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

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

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
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
        throw new Error(
          data.error ?? "Unable to upload the photo."
        );
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
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ff7b86]">
            Big Iron Country Swing
          </p>

          <h1 className="mt-2 text-5xl font-black uppercase tracking-wide">
            Submit a Photo
          </h1>

          <p className="mt-3 text-neutral-400">
            Share a photo from tonight. Every submission is
            reviewed before it appears on the projector.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-5 shadow-2xl sm:p-7"
        >
          <label className="block">
            <span className="mb-3 block text-sm font-bold uppercase tracking-[0.15em] text-neutral-300">
              Choose Photo
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={handlePhotoChange}
              className="block w-full cursor-pointer rounded-2xl border border-neutral-700 bg-black p-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#c4202f] file:px-4 file:py-3 file:font-bold file:text-white hover:file:bg-[#d9293a]"
            />
          </label>

          {previewUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <img
                src={previewUrl}
                alt="Selected photo preview"
                className="max-h-[55vh] w-full object-contain"
              />
            </div>
          )}

          <p className="mt-3 text-xs text-neutral-500">
            JPG, PNG, WebP, HEIC, or HEIF. Maximum 10 MB.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-950/40 p-4 text-green-200">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={!photo || submitting}
            className="mt-6 w-full rounded-2xl bg-[#c4202f] px-5 py-4 text-lg font-black uppercase tracking-wide text-white transition hover:bg-[#d9293a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Uploading..."
              : "Submit for Approval"}
          </button>
        </form>
      </div>
    </main>
  );
}