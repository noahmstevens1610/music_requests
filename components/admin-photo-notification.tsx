"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

export default function AdminPhotoNotification() {
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  const loadCounts = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/admin/photos?event=big-iron",
        { cache: "no-store" }
      );

      if (!response.ok) return;

      const data = await response.json();
      setCounts(data.counts ?? emptyCounts);
    } catch {
      // Keep the dashboard working even if photo counts cannot load.
    }
  }, []);

  useEffect(() => {
    void loadCounts();

    const interval = window.setInterval(() => {
      void loadCounts();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadCounts]);

  const needsAttention = counts.pending > 0 || counts.rejected > 0;

  return (
    <section
      className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
        needsAttention
          ? "border-[#c4202f]/70 bg-[#c4202f]/10"
          : "border-white/10 bg-neutral-950"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Guest Photos</h2>

            {counts.pending > 0 && (
              <span className="rounded-full bg-[#c4202f] px-2.5 py-1 text-xs font-black">
                {counts.pending} NEW
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-neutral-400">
            {counts.pending > 0
              ? `${counts.pending} photo${
                  counts.pending === 1 ? "" : "s"
                } waiting for review.`
              : "No photos are waiting for review."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-neutral-800 px-3 py-1.5">
              {counts.approved} approved
            </span>
            <span className="rounded-full bg-neutral-800 px-3 py-1.5">
              {counts.rejected} removed
            </span>
          </div>
        </div>

        <Link
          href="/admin-dashboard/photos"
          className="inline-flex items-center justify-center rounded-xl bg-[#c4202f] px-5 py-3 font-bold hover:bg-[#d9293a]"
        >
          Review Photos
          {counts.pending > 0 && (
            <span className="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-xs">
              {counts.pending}
            </span>
          )}
        </Link>
      </div>
    </section>
  );
}
