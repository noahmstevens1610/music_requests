import Link from "next/link";

export default function RequestsLandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-10 pt-0 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(196,32,47,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_32%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="-mx-4 overflow-hidden sm:-mx-6">
          <img
            src="/song-requests-banner.png"
            alt="Big Iron Country Swing requests"
            className="block h-auto w-full object-contain"
          />
        </header>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl sm:p-6">
          <div className="border-b-2 border-[#c4202f] pb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Big Iron Country Swing
            </p>

            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.035em] text-white sm:text-4xl">
              Make a Request
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              Choose whether you want to request a song or submit a photo from tonight.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link
              href="/song-requests"
              className="group flex min-h-[280px] flex-col rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-lg transition hover:-translate-y-1 hover:border-[#c4202f] hover:bg-[#151515]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c4202f]/15 text-[#ff7b86] transition group-hover:bg-[#c4202f] group-hover:text-white">
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="h-9 w-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 35V11l20-5v24" />
                  <ellipse cx="12" cy="36" rx="7" ry="5" />
                  <ellipse cx="32" cy="31" rx="7" ry="5" />
                </svg>
              </div>

              <h2 className="mt-6 text-3xl font-black uppercase tracking-[0.035em] text-white">
                Request a Song
              </h2>

              <p className="mt-3 text-base leading-7 text-white/55">
                Search Spotify, request a swing song or line dance, and vote for songs already submitted by other dancers.
              </p>

              <span className="mt-auto pt-8">
                <span className="inline-flex w-full items-center justify-center rounded-2xl bg-[#c4202f] px-5 py-4 text-lg font-black uppercase tracking-wide text-white transition group-hover:bg-[#d9293a]">
                  Request a Song
                </span>
              </span>
            </Link>

            <Link
              href="/submit-photo"
              className="group flex min-h-[280px] flex-col rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-lg transition hover:-translate-y-1 hover:border-[#c4202f] hover:bg-[#151515]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c4202f]/15 text-[#ff7b86] transition group-hover:bg-[#c4202f] group-hover:text-white">
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="h-9 w-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="7" y="11" width="34" height="27" rx="4" />
                  <circle cx="18" cy="21" r="4" />
                  <path d="m10 34 9-8 7 6 5-5 7 7" />
                </svg>
              </div>

              <h2 className="mt-6 text-3xl font-black uppercase tracking-[0.035em] text-white">
                Submit a Photo
              </h2>

              <p className="mt-3 text-base leading-7 text-white/55">
                Share a photo from the event for a chance to have it appear on the back wall during the dance.
              </p>

              <span className="mt-auto pt-8">
                <span className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-[#c4202f] bg-transparent px-5 py-4 text-lg font-black uppercase tracking-wide text-white transition group-hover:bg-[#c4202f]">
                  Submit a Photo
                </span>
              </span>
            </Link>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-white/35">
            Photos are reviewed before they are displayed.
          </p>
        </section>
      </div>
    </main>
  );
}