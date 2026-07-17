"use client";

import { useEffect, useRef, useState } from "react";

type RequestType = "swing" | "line_dance";
type QueueAnimation = "idle" | "slide-out" | "slide-in";

type LineDanceInfo = {
  id?: string;
  name: string;
  alsoKnownAs: string | null;
  isOriginalSong: boolean;
  originalSong: {
    trackName: string;
    artistName: string;
  } | null;
};

type PlaybackTrack = {
  spotifyTrackId: string;
  spotifyUri: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  albumImage: string | null;
  durationMs: number | null;
  explicit: boolean;
  requestType: RequestType;
  requestId: string | null;
  lineDance: LineDanceInfo | null;
};

type PlaybackResponse = {
  isPlaying: boolean;
  nowPlaying: PlaybackTrack | null;
  upcoming: PlaybackTrack[];
  updatedAt: string;
};

function categoryLabel(type: RequestType) {
  return type === "line_dance" ? "Line Dance" : "Swing Song";
}

function AlbumArtwork({
  track,
  className,
}: {
  track: PlaybackTrack;
  className: string;
}) {
  if (track.albumImage) {
    return (
      <img
        src={track.albumImage}
        alt={`${track.trackName} album artwork`}
        className={className}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-[#151515] text-6xl text-white/20`}
    >
      ♪
    </div>
  );
}

function EmptyArtwork({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[#111111] text-center ${className}`}
    >
      <div>
        <p className="font-heading text-4xl uppercase tracking-[0.08em] text-white/35">
          No Song
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.22em] text-white/25">
          Waiting for playback
        </p>
      </div>
    </div>
  );
}

function SongTags({ track }: { track: PlaybackTrack }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="border border-white/10 bg-black/35 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
          Category
        </p>
        <p className="font-heading mt-1 truncate text-lg uppercase tracking-[0.04em] text-[#ff7b86]">
          {categoryLabel(track.requestType)}
        </p>
      </div>

      <div className="border border-white/10 bg-black/35 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
          Version
        </p>
        <p className="font-heading mt-1 truncate text-lg uppercase tracking-[0.04em] text-white">
          {track.lineDance
            ? track.lineDance.isOriginalSong
              ? "Original"
              : "Song Swap"
            : "—"}
        </p>
      </div>
    </div>
  );
}

function QueueItem({
  track,
  index,
}: {
  track: PlaybackTrack;
  index: number;
}) {
  return (
    <article className="grid grid-cols-[46px_64px_minmax(0,1fr)] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0">
      <div className="font-heading text-center text-2xl text-[#c4202f]">
        {index + 1}
      </div>

      <AlbumArtwork
        track={track}
        className="h-16 w-16 border border-white/10 object-cover"
      />

      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold text-white">
          {track.trackName}
        </h3>
        <p className="mt-1 truncate text-xs text-white/55">
          {track.artistName}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="border border-[#c4202f]/55 bg-[#c4202f]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#ff9aa3]">
            {categoryLabel(track.requestType)}
          </span>

          {track.lineDance ? (
            <>
              <span className="max-w-[150px] truncate border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-white/75">
                {track.lineDance.name}
              </span>
              <span className="border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-white/60">
                {track.lineDance.isOriginalSong ? "Original" : "Song Swap"}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PlaceholderPanel({
  label,
  large = false,
}: {
  label: string;
  large?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center border border-[#c4202f]/45 bg-[#0c0c0c]">
      <div className="text-center">
        <p
          className={`font-heading uppercase tracking-[0.1em] text-white/30 ${
            large ? "text-5xl" : "text-3xl"
          }`}
        >
          {label}
        </p>
        <div className="mx-auto mt-4 h-px w-24 bg-[#c4202f]/50" />
      </div>
    </div>
  );
}

function getPlaybackSignature(playback: PlaybackResponse): string {
  const nowPlayingId = playback.nowPlaying?.spotifyTrackId ?? "none";
  const upcomingIds = playback.upcoming
    .slice(0, 4)
    .map((track) => track.spotifyTrackId)
    .join("|");

  return `${nowPlayingId}:${upcomingIds}`;
}

export default function NowPlayingPage() {
  const [playback, setPlayback] = useState<PlaybackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queueAnimation, setQueueAnimation] =
    useState<QueueAnimation>("idle");
  const [nowPlayingTransitioning, setNowPlayingTransitioning] =
    useState(false);

  const playbackRef = useRef<PlaybackResponse | null>(null);
  const transitionTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideInTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadPlayback() {
    try {
      const response = await fetch("/api/spotify/queue", {
        cache: "no-store",
      });

      const data = (await response.json()) as
        | PlaybackResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error ?? "Unable to load Spotify playback."
            : "Unable to load Spotify playback."
        );
      }

      const newPlayback = data as PlaybackResponse;
      const oldPlayback = playbackRef.current;

      if (!oldPlayback) {
        playbackRef.current = newPlayback;
        setPlayback(newPlayback);
        setLoading(false);
        setError("");
        return;
      }

      if (getPlaybackSignature(oldPlayback) === getPlaybackSignature(newPlayback)) {
        playbackRef.current = newPlayback;
        setPlayback(newPlayback);
        setLoading(false);
        setError("");
        return;
      }

      setQueueAnimation("slide-out");
      setNowPlayingTransitioning(true);

      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      if (slideInTimeoutRef.current) {
        clearTimeout(slideInTimeoutRef.current);
      }

      transitionTimeoutRef.current = setTimeout(() => {
        playbackRef.current = newPlayback;
        setPlayback(newPlayback);
        setQueueAnimation("slide-in");

        slideInTimeoutRef.current = setTimeout(() => {
          setQueueAnimation("idle");
          setNowPlayingTransitioning(false);
        }, 40);
      }, 400);

      setLoading(false);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Spotify playback."
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlayback();

    const interval = window.setInterval(() => {
      void loadPlayback();
    }, 5000);

    return () => {
      window.clearInterval(interval);

      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      if (slideInTimeoutRef.current) {
        clearTimeout(slideInTimeoutRef.current);
      }
    };
  }, []);

  const queueAnimationClass =
    queueAnimation === "slide-out"
      ? "-translate-y-5 opacity-0"
      : queueAnimation === "slide-in"
        ? "translate-y-5 opacity-0"
        : "translate-y-0 opacity-100";

  const nowPlaying = playback?.nowPlaying ?? null;
  const upcoming = playback?.upcoming.slice(0, 4) ?? [];

  return (
    <main className="h-[100dvh] overflow-hidden bg-black p-3 text-white sm:p-4">
      <div className="grid h-full min-h-0 grid-cols-[36%_64%] gap-3">
        {/* LEFT COLUMN */}
        <section className="grid min-h-0 grid-rows-[31%_18%_minmax(0,1fr)] gap-3">
          {/* Album art + song tags */}
          <div
            className={`grid min-h-0 grid-cols-[50%_50%] overflow-hidden border border-white/10 bg-[#0d0d0d] transition-all duration-400 ${
              nowPlayingTransitioning
                ? "-translate-x-4 opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            <div className="min-h-0 border-r border-[#c4202f]/45">
              {nowPlaying ? (
                <AlbumArtwork
                  track={nowPlaying}
                  className="h-full w-full object-cover"
                />
              ) : (
                <EmptyArtwork className="h-full w-full" />
              )}
            </div>

            <div className="flex min-h-0 flex-col justify-center gap-3 p-3">
              {nowPlaying ? (
                <>
                  <SongTags track={nowPlaying} />

                  <div className="border border-white/10 bg-black/35 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                      Choreography
                    </p>
                    <p className="font-heading mt-1 line-clamp-2 text-lg uppercase tracking-[0.04em] text-white">
                      {nowPlaying.lineDance?.name ?? "Not Applicable"}
                    </p>
                  </div>

                  {nowPlaying.lineDance?.alsoKnownAs ? (
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/40">
                      Also known as: {nowPlaying.lineDance.alsoKnownAs}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="text-center">
                  <p className="font-heading text-3xl uppercase text-white/35">
                    Waiting
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/25">
                    Song details appear here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Song information */}
          <div
            className={`flex min-h-0 flex-col justify-center overflow-hidden border border-[#c4202f]/45 bg-[#0d0d0d] px-5 transition-all duration-400 ${
              nowPlayingTransitioning
                ? "-translate-x-4 opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            <p className="font-heading text-base uppercase tracking-[0.18em] text-[#c4202f]">
              Now Playing
            </p>

            {nowPlaying ? (
              <>
                <h1 className="mt-1 line-clamp-1 text-2xl font-black leading-tight text-white xl:text-3xl">
                  {nowPlaying.trackName}
                </h1>
                <p className="mt-1 truncate text-base text-white/60">
                  {nowPlaying.artistName}
                </p>
                {nowPlaying.albumName ? (
                  <p className="mt-1 truncate text-xs text-white/35">
                    {nowPlaying.albumName}
                  </p>
                ) : null}
              </>
            ) : (
              <h1 className="mt-2 font-heading text-3xl uppercase tracking-[0.05em] text-white/30">
                Nothing is playing
              </h1>
            )}
          </div>

          {/* Queue */}
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-white/10 bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-[#c4202f]/45 px-4 py-3">
              <h2 className="font-heading text-2xl uppercase tracking-[0.08em] text-white">
                Queue
              </h2>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
                Up Next
              </span>
            </div>

            <div
              className={`min-h-0 overflow-hidden transition-all duration-400 ${queueAnimationClass}`}
            >
              {upcoming.length > 0 ? (
                upcoming.map((track, index) => (
                  <QueueItem
                    key={`${track.spotifyTrackId}-${index}`}
                    track={track}
                    index={index}
                  />
                ))
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div>
                    <p className="font-heading text-3xl uppercase tracking-[0.08em] text-white/30">
                      Queue Empty
                    </p>
                    <p className="mt-2 text-xs text-white/30">
                      Upcoming songs will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="grid min-h-0 grid-rows-[39%_minmax(0,1fr)] gap-3">
          {/* Photo and QR */}
          <div className="grid min-h-0 grid-cols-[52%_48%] gap-3">
            <PlaceholderPanel label="Coming Soon" large />

            <aside className="flex min-h-0 items-center justify-center border border-[#c4202f]/45 bg-[#0d0d0d] p-4">
              <div className="flex h-full w-full flex-col items-center justify-center">
                <p className="font-heading text-2xl uppercase tracking-[0.1em] text-white">
                  Request a Song
                </p>

                <div className="mt-3 aspect-square min-h-0 max-h-[72%] w-auto bg-white p-2">
                  <img
                    src="/REQUEST_A_SONG.png"
                    alt="QR code to request a song"
                    className="h-full w-full object-contain"
                  />
                </div>

                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                  Scan with your phone
                </p>
              </div>
            </aside>
          </div>

          {/* Video */}
          <div className="relative flex min-h-0 items-center justify-center overflow-hidden border border-[#c4202f]/45 bg-black">
            <video
              className="h-full w-full bg-black object-contain"
              src="/DANCE_LOOP.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />

            <div className="pointer-events-none absolute left-4 top-4 border border-white/15 bg-black/70 px-3 py-1.5">
              <p className="font-heading text-lg uppercase tracking-[0.08em] text-white/70">
                Video
              </p>
            </div>
          </div>
        </section>
      </div>

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <p className="font-heading text-4xl uppercase tracking-[0.1em] text-white/50">
            Loading Playback
          </p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6">
          <div className="w-full max-w-lg border border-[#c4202f] bg-[#130608] p-8 text-center">
            <p className="font-heading text-4xl uppercase tracking-[0.08em]">
              Playback Unavailable
            </p>
            <p className="mt-3 text-sm text-white/55">{error}</p>
            <button
              type="button"
              onClick={() => void loadPlayback()}
              className="font-heading mt-6 border border-[#c4202f] bg-[#c4202f] px-6 py-3 text-xl uppercase tracking-[0.08em] text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}