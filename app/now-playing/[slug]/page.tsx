"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";

type RequestType =
  | "swing"
  | "line_dance";

type QueueAnimation =
  | "idle"
  | "slide-out"
  | "slide-in";

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

function formatSlug(
  slug: string
): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function CategoryBadge({
  requestType,
}: {
  requestType: RequestType;
}) {
  const isLineDance =
    requestType === "line_dance";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
        isLineDance
          ? "border-[#c4202f]/60 bg-[#c4202f]/20 text-[#ffadb5]"
          : "border-white/25 bg-white/10 text-white"
      }`}
    >
      {isLineDance
        ? "Line Dance"
        : "Swing Song"}
    </span>
  );
}

function SongVersionBadge({
  isOriginalSong,
}: {
  isOriginalSong: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
        isOriginalSong
          ? "border-white/30 bg-white/10 text-white"
          : "border-[#c4202f]/60 bg-[#c4202f]/20 text-[#ffadb5]"
      }`}
    >
      {isOriginalSong
        ? "Original Song"
        : "Song Swap"}
    </span>
  );
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
      className={`${className} flex items-center justify-center bg-[#151515] text-5xl text-white/25`}
    >
      ♪
    </div>
  );
}

function QueueTrack({
  track,
  index,
}: {
  track: PlaybackTrack;
  index: number;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-white/15 bg-[#111111] p-3 shadow-lg">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c4202f] text-sm font-black text-white shadow-md">
        {index + 1}
      </span>

      <AlbumArtwork
  track={track}
  className="aspect-square h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
/>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-black text-white">
          {track.trackName}
        </h3>

        <p className="mt-1 truncate text-xs text-white/60">
          {track.artistName}
        </p>

        {track.albumName && (
          <p className="mt-1 truncate text-[11px] text-white/35">
            Album: {track.albumName}
          </p>
        )}
      </div>

      <div className="flex max-w-[42%] shrink-0 flex-col items-end gap-1.5 text-right">
        <CategoryBadge
          requestType={
            track.requestType
          }
        />

        {track.lineDance && (
          <>
            <div className="max-w-full">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">
                Choreo
              </p>

              <p className="max-w-full truncate text-xs font-black text-white">
                {track.lineDance.name}
              </p>
            </div>

            <SongVersionBadge
              isOriginalSong={
                track.lineDance
                  .isOriginalSong
              }
            />
          </>
        )}
      </div>
    </article>
  );
}

function getPlaybackSignature(
  playback: PlaybackResponse
): string {
  const nowPlayingId =
    playback.nowPlaying
      ?.spotifyTrackId ?? "none";

  const upcomingIds =
    playback.upcoming
      .slice(0, 3)
      .map(
        (track) =>
          track.spotifyTrackId
      )
      .join("|");

  return `${nowPlayingId}:${upcomingIds}`;
}

export default function NowPlayingPage() {
  const params = useParams<{
    slug: string;
  }>();

  const slug = params.slug;
  const eventName =
    formatSlug(slug);

  const [
    playback,
    setPlayback,
  ] =
    useState<PlaybackResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [
    queueAnimation,
    setQueueAnimation,
  ] =
    useState<QueueAnimation>(
      "idle"
    );

  const [
    nowPlayingTransitioning,
    setNowPlayingTransitioning,
  ] = useState(false);

  const playbackRef =
    useRef<PlaybackResponse | null>(
      null
    );

  const transitionTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const slideInTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  async function loadPlayback() {
    try {
      const response = await fetch(
        "/api/spotify/queue",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as
          | PlaybackResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error ??
                "Unable to load Spotify playback."
            : "Unable to load Spotify playback."
        );
      }

      const newPlayback =
        data as PlaybackResponse;

      const oldPlayback =
        playbackRef.current;

      if (!oldPlayback) {
        playbackRef.current =
          newPlayback;

        setPlayback(newPlayback);
        setLoading(false);
        setError("");
        return;
      }

      const oldSignature =
        getPlaybackSignature(
          oldPlayback
        );

      const newSignature =
        getPlaybackSignature(
          newPlayback
        );

      if (
        oldSignature ===
        newSignature
      ) {
        playbackRef.current =
          newPlayback;

        setPlayback(newPlayback);
        setError("");
        setLoading(false);
        return;
      }

      setQueueAnimation(
        "slide-out"
      );

      setNowPlayingTransitioning(
        true
      );

      if (
        transitionTimeoutRef.current
      ) {
        clearTimeout(
          transitionTimeoutRef.current
        );
      }

      if (
        slideInTimeoutRef.current
      ) {
        clearTimeout(
          slideInTimeoutRef.current
        );
      }

      transitionTimeoutRef.current =
        setTimeout(() => {
          playbackRef.current =
            newPlayback;

          setPlayback(newPlayback);

          setQueueAnimation(
            "slide-in"
          );

          slideInTimeoutRef.current =
            setTimeout(() => {
              setQueueAnimation(
                "idle"
              );

              setNowPlayingTransitioning(
                false
              );
            }, 40);
        }, 450);

      setError("");
      setLoading(false);
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
    loadPlayback();

    const interval =
      window.setInterval(
        loadPlayback,
        5000
      );

    return () => {
      window.clearInterval(
        interval
      );

      if (
        transitionTimeoutRef.current
      ) {
        clearTimeout(
          transitionTimeoutRef.current
        );
      }

      if (
        slideInTimeoutRef.current
      ) {
        clearTimeout(
          slideInTimeoutRef.current
        );
      }
    };
  }, []);

  const queueAnimationClass =
    queueAnimation === "slide-out"
      ? "-translate-x-40 opacity-0"
      : queueAnimation ===
          "slide-in"
        ? "translate-x-40 opacity-0"
        : "translate-x-0 opacity-100";

  return (
    <main className="h-screen overflow-hidden bg-black px-12 py-10 text-white xl:px-16 xl:py-12">
      <div className="mx-auto grid h-full max-w-[1550px] grid-rows-[auto_minmax(0,1fr)] gap-5">
        <header className="flex items-end justify-between border-b border-[#c4202f]/70 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/50">
              {eventName}
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-white xl:text-4xl">
              Now Playing
            </h1>

            <div className="mt-2 h-1 w-28 rounded-full bg-[#c4202f]" />
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-white/55">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#c4202f]" />

            Live Spotify Queue
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center rounded-3xl border border-[#c4202f]/50 bg-[#101010]">
            <p className="text-xl font-bold">
              Loading playback…
            </p>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-3xl border border-[#c4202f]/70 bg-[#2a080c] p-8 text-center"
          >
            <p className="text-xl font-black text-white">
              Playback unavailable
            </p>

            <p className="mt-2 text-sm text-white/60">
              {error}
            </p>

            <button
              type="button"
              onClick={loadPlayback}
              className="mt-5 rounded-xl bg-[#c4202f] px-5 py-3 font-black text-white"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          playback && (
            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_165px] gap-5">
              <section className="grid min-h-0 grid-cols-[420px_minmax(0,1fr)] gap-5">
                <div
                  className={`grid min-h-0 grid-rows-[420px_minmax(0,1fr)] overflow-hidden rounded-3xl border border-[#c4202f]/60 bg-[#101010] shadow-2xl transition-all duration-500 ease-in-out ${
                    nowPlayingTransitioning
                      ? "-translate-x-8 opacity-0"
                      : "translate-x-0 opacity-100"
                  }`}
                >
                  {playback.nowPlaying ? (
                    <>
                      <div className="relative h-[420px] w-[420px] overflow-hidden bg-black">
                        <AlbumArtwork
                          track={
                            playback
                              .nowPlaying
                          }
                          className="absolute left-0 top-0 h-[420px] w-[420px] object-cover"
                        />

                        <div className="absolute bottom-4 left-4">
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#c4202f] px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />

                            Playing Now
                          </span>
                        </div>
                      </div>

                      <div className="min-h-0 border-t border-[#c4202f]/35 bg-[#111111] p-4">
                        <CategoryBadge
                          requestType={
                            playback
                              .nowPlaying
                              .requestType
                          }
                        />

                        <h2 className="mt-3 truncate text-3xl font-black text-white">
                          {
                            playback
                              .nowPlaying
                              .trackName
                          }
                        </h2>

                        <p className="mt-1 truncate text-lg text-white/65">
                          {
                            playback
                              .nowPlaying
                              .artistName
                          }
                        </p>

                        {playback
                          .nowPlaying
                          .albumName && (
                          <p className="mt-1 truncate text-sm text-white/35">
                            Album:{" "}
                            {
                              playback
                                .nowPlaying
                                .albumName
                            }
                          </p>
                        )}

                        {playback
                          .nowPlaying
                          .lineDance && (
                          <div className="mt-3 border-t border-white/10 pt-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff7d89]">
                              Choreo
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-lg font-black text-white">
                                {
                                  playback
                                    .nowPlaying
                                    .lineDance
                                    .name
                                }
                              </p>

                              <SongVersionBadge
                                isOriginalSong={
                                  playback
                                    .nowPlaying
                                    .lineDance
                                    .isOriginalSong
                                }
                              />
                            </div>

                            {playback
                              .nowPlaying
                              .lineDance
                              .alsoKnownAs && (
                              <p className="mt-1 text-xs text-white/50">
                                Also known
                                as:{" "}
                                {
                                  playback
                                    .nowPlaying
                                    .lineDance
                                    .alsoKnownAs
                                }
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="row-span-2 flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#c4202f]/50 bg-[#1a1a1a] text-3xl text-white/30">
                        ♪
                      </div>

                      <h2 className="mt-4 text-2xl font-black">
                        Nothing is playing
                      </h2>
                    </div>
                  )}
                </div>

                <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-3xl border border-[#c4202f]/45 bg-black">
                  <video
                    className="h-full w-full bg-black object-contain"
                    src="/DANCE_LOOP.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                  />

                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
                </div>
              </section>

              <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_150px] gap-5 overflow-hidden">
                <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-black uppercase tracking-[0.15em] text-white">
                      Up Next
                    </h2>

                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                      Next 3 songs
                    </p>
                  </div>

                  <div
                    className={`grid min-h-0 grid-cols-3 gap-3 transition-all duration-500 ease-in-out ${queueAnimationClass}`}
                  >
                    {playback.upcoming
                      .slice(0, 3)
                      .map(
                        (
                          track,
                          index
                        ) => (
                          <QueueTrack
                            key={`${track.spotifyTrackId}-${index}`}
                            track={track}
                            index={index}
                          />
                        )
                      )}

                    {playback.upcoming
                      .length === 0 && (
                      <div className="col-span-3 flex items-center justify-center rounded-2xl border border-dashed border-[#c4202f]/45 bg-[#101010] text-white/45">
                        No upcoming songs
                        are currently
                        queued.
                      </div>
                    )}
                  </div>
                </div>

                <aside className="flex min-h-0 items-end justify-center rounded-2xl border border-[#c4202f]/60 bg-[#111111] p-2 shadow-lg">
                  <div className="rounded-xl bg-white p-1.5">
                    <img
                      src="/REQUEST_A_SONG.png"
                      alt="QR code to request a song"
                      className="aspect-square h-[128px] w-[128px] object-contain"
                    />
                  </div>
                </aside>
              </section>
            </div>
          )}
      </div>
    </main>
  );
}