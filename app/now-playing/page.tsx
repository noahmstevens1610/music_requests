"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type RequestType = "swing" | "line_dance";

type QueueAnimation = "idle" | "slide-out" | "slide-in";

type DisplayScale = "small" | "medium" | "large";

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

type DisplaySettings = {
  scale: DisplayScale;
  queueCount: 1 | 2 | 3;
  showQrCode: boolean;
  showVideo: boolean;
};

const STORAGE_KEY = "big-iron-now-playing-display-settings";

const DEFAULT_SETTINGS: DisplaySettings = {
  scale: "medium",
  queueCount: 3,
  showQrCode: true,
  showVideo: true,
};

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function CategoryBadge({
  requestType,
  compact = false,
}: {
  requestType: RequestType;
  compact?: boolean;
}) {
  const isLineDance = requestType === "line_dance";

  return (
    <span
      className={`inline-flex rounded-full border font-black uppercase ${
        compact
          ? "px-2 py-0.5 text-[8px] tracking-[0.08em]"
          : "px-3 py-1 text-[10px] tracking-[0.12em]"
      } ${
        isLineDance
          ? "border-[#c4202f]/60 bg-[#c4202f]/20 text-[#ffadb5]"
          : "border-white/25 bg-white/10 text-white"
      }`}
    >
      {isLineDance ? "Line Dance" : "Swing Song"}
    </span>
  );
}

function SongVersionBadge({
  isOriginalSong,
  compact = false,
}: {
  isOriginalSong: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border font-black uppercase ${
        compact
          ? "px-2 py-0.5 text-[8px] tracking-[0.06em]"
          : "px-3 py-1 text-[10px] tracking-[0.1em]"
      } ${
        isOriginalSong
          ? "border-white/30 bg-white/10 text-white"
          : "border-[#c4202f]/60 bg-[#c4202f]/20 text-[#ffadb5]"
      }`}
    >
      {isOriginalSong ? "Original Song" : "Song Swap"}
    </span>
  );
}

function ChoreographyBadge({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full rounded-full border border-white/25 bg-white/10 font-black uppercase text-white ${
        compact
          ? "px-2 py-0.5 text-[8px] tracking-[0.06em]"
          : "px-3 py-1 text-[10px] tracking-[0.1em]"
      }`}
      title={name}
    >
      <span className="truncate">{name}</span>
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
  scale,
}: {
  track: PlaybackTrack;
  index: number;
  scale: DisplayScale;
}) {
  const compact = scale === "small";

  return (
    <article
      className={`flex min-w-0 items-center overflow-hidden rounded-2xl border border-white/15 bg-[#111111] shadow-lg ${
        compact ? "gap-2 p-2" : "gap-3 p-3"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-[#c4202f] font-black text-white shadow-md ${
          compact ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"
        }`}
      >
        {index + 1}
      </span>

      <AlbumArtwork
        track={track}
        className={`aspect-square shrink-0 rounded-xl border border-white/10 object-cover ${
          compact
            ? "h-12 w-12"
            : scale === "large"
              ? "h-20 w-20"
              : "h-16 w-16"
        }`}
      />

      <div className="min-w-0 flex-1">
        <h3
          className={`truncate font-black text-white ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {track.trackName}
        </h3>

        <p
          className={`mt-1 truncate text-white/60 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {track.artistName}
        </p>

        {track.albumName && (
          <p className="mt-1 truncate text-[10px] text-white/35">
            Album: {track.albumName}
          </p>
        )}
      </div>

      <div className="flex max-w-[44%] shrink-0 flex-col items-end gap-1 text-right">
        <CategoryBadge requestType={track.requestType} compact={compact} />

        {track.lineDance ? (
          <>
            <ChoreographyBadge
              name={track.lineDance.name}
              compact={compact}
            />

            <SongVersionBadge
              isOriginalSong={track.lineDance.isOriginalSong}
              compact={compact}
            />
          </>
        ) : null}
      </div>
    </article>
  );
}

function getPlaybackSignature(playback: PlaybackResponse): string {
  const nowPlayingId = playback.nowPlaying?.spotifyTrackId ?? "none";

  const upcomingIds = playback.upcoming
    .slice(0, 3)
    .map((track) => track.spotifyTrackId)
    .join("|");

  return `${nowPlayingId}:${upcomingIds}`;
}

export default function NowPlayingPage() {
  const slug = "big-iron";
  const eventName = formatSlug(slug);

  const [playback, setPlayback] = useState<PlaybackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [queueAnimation, setQueueAnimation] =
    useState<QueueAnimation>("idle");

  const [nowPlayingTransitioning, setNowPlayingTransitioning] =
    useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displaySettings, setDisplaySettings] =
    useState<DisplaySettings>(DEFAULT_SETTINGS);

  const playbackRef = useRef<PlaybackResponse | null>(null);

  const transitionTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideInTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const savedSettings = window.localStorage.getItem(STORAGE_KEY);

      if (!savedSettings) {
        return;
      }

      const parsed = JSON.parse(savedSettings) as Partial<DisplaySettings>;

      setDisplaySettings({
        scale:
          parsed.scale === "small" ||
          parsed.scale === "medium" ||
          parsed.scale === "large"
            ? parsed.scale
            : DEFAULT_SETTINGS.scale,
        queueCount:
          parsed.queueCount === 1 ||
          parsed.queueCount === 2 ||
          parsed.queueCount === 3
            ? parsed.queueCount
            : DEFAULT_SETTINGS.queueCount,
        showQrCode:
          typeof parsed.showQrCode === "boolean"
            ? parsed.showQrCode
            : DEFAULT_SETTINGS.showQrCode,
        showVideo:
          typeof parsed.showVideo === "boolean"
            ? parsed.showVideo
            : DEFAULT_SETTINGS.showVideo,
      });
    } catch {
      setDisplaySettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(displaySettings));
  }, [displaySettings]);

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

      const oldSignature = getPlaybackSignature(oldPlayback);
      const newSignature = getPlaybackSignature(newPlayback);

      if (oldSignature === newSignature) {
        playbackRef.current = newPlayback;
        setPlayback(newPlayback);
        setError("");
        setLoading(false);
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

    const interval = window.setInterval(loadPlayback, 5000);

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

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Some iPad/Safari versions do not support webpage fullscreen.
    }
  }

  const queueAnimationClass =
    queueAnimation === "slide-out"
      ? "-translate-x-40 opacity-0"
      : queueAnimation === "slide-in"
        ? "translate-x-40 opacity-0"
        : "translate-x-0 opacity-100";

  const scale = displaySettings.scale;

  const artworkSize =
    scale === "small"
      ? "clamp(225px, 29vw, 280px)"
      : scale === "large"
        ? "clamp(300px, 37vw, 410px)"
        : "clamp(260px, 33vw, 340px)";

  const queueHeight =
    scale === "small" ? "138px" : scale === "large" ? "190px" : "165px";

  const pagePadding =
    scale === "small"
      ? "clamp(10px, 1.4vw, 18px)"
      : scale === "large"
        ? "clamp(18px, 2.4vw, 36px)"
        : "clamp(14px, 2vw, 28px)";

  const pageGap =
    scale === "small"
      ? "clamp(8px, 1vw, 12px)"
      : scale === "large"
        ? "clamp(14px, 1.6vw, 22px)"
        : "clamp(10px, 1.3vw, 18px)";

  const queueColumnClass =
    displaySettings.queueCount === 1
      ? "grid-cols-1"
      : displaySettings.queueCount === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  const contentColumns = displaySettings.showVideo
    ? `${artworkSize} minmax(0, 1fr)`
    : "minmax(0, 1fr)";

  return (
    <main
      className="h-[100dvh] overflow-hidden bg-black text-white"
      style={{
        padding: pagePadding,
      }}
    >
      <div
        className="mx-auto grid h-full max-w-[1550px] grid-rows-[auto_minmax(0,1fr)]"
        style={{
          gap: pageGap,
        }}
      >
        <header
          className={`flex justify-between border-b border-[#c4202f]/70 ${
            scale === "small" ? "items-center pb-2" : "items-end pb-3"
          }`}
        >
          <div className="min-w-0">
            <p
              className={`truncate font-bold uppercase text-white/50 ${
                scale === "small"
                  ? "text-[9px] tracking-[0.22em]"
                  : "text-xs tracking-[0.35em]"
              }`}
            >
              {eventName}
            </p>

            <h1
              className={`mt-1 font-black uppercase tracking-tight text-white ${
                scale === "small"
                  ? "text-2xl"
                  : scale === "large"
                    ? "text-4xl"
                    : "text-3xl"
              }`}
            >
              Now Playing
            </h1>

            <div
              className={`mt-2 rounded-full bg-[#c4202f] ${
                scale === "small" ? "h-0.5 w-20" : "h-1 w-28"
              }`}
            />
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 text-sm font-semibold text-white/55 sm:flex">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#c4202f]" />
              Live Spotify Queue
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen((current) => !current)}
              className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20 bg-[#111111] px-3 text-sm font-black text-white shadow-lg active:scale-95"
              aria-expanded={settingsOpen}
              aria-label="Open display settings"
            >
              ⚙
              <span className="ml-2 hidden sm:inline">Display</span>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(330px,calc(100vw-24px))] rounded-2xl border border-[#c4202f]/70 bg-[#101010] p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.12em]">
                      Display Settings
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Saved automatically on this iPad
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-xl"
                    aria-label="Close display settings"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    Page Size
                  </p>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["small", "medium", "large"] as DisplayScale[]).map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setDisplaySettings((current) => ({
                              ...current,
                              scale: option,
                            }))
                          }
                          className={`min-h-11 rounded-xl border px-2 text-xs font-black uppercase ${
                            scale === option
                              ? "border-[#c4202f] bg-[#c4202f] text-white"
                              : "border-white/15 bg-white/5 text-white/65"
                          }`}
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    Up Next Songs
                  </p>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() =>
                          setDisplaySettings((current) => ({
                            ...current,
                            queueCount: count,
                          }))
                        }
                        className={`min-h-11 rounded-xl border text-sm font-black ${
                          displaySettings.queueCount === count
                            ? "border-[#c4202f] bg-[#c4202f] text-white"
                            : "border-white/15 bg-white/5 text-white/65"
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDisplaySettings((current) => ({
                        ...current,
                        showVideo: !current.showVideo,
                      }))
                    }
                    className="flex min-h-12 items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 text-left"
                  >
                    <span className="text-sm font-bold">Dance Video</span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        displaySettings.showVideo
                          ? "bg-[#c4202f] text-white"
                          : "bg-white/10 text-white/45"
                      }`}
                    >
                      {displaySettings.showVideo ? "Shown" : "Hidden"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDisplaySettings((current) => ({
                        ...current,
                        showQrCode: !current.showQrCode,
                      }))
                    }
                    className="flex min-h-12 items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 text-left"
                  >
                    <span className="text-sm font-bold">Request QR Code</span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        displaySettings.showQrCode
                          ? "bg-[#c4202f] text-white"
                          : "bg-white/10 text-white/45"
                      }`}
                    >
                      {displaySettings.showQrCode ? "Shown" : "Hidden"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black"
                  >
                    Toggle Fullscreen
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisplaySettings(DEFAULT_SETTINGS)}
                    className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black uppercase tracking-[0.1em] text-white/50"
                  >
                    Reset Display
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center rounded-3xl border border-[#c4202f]/50 bg-[#101010]">
            <p className="text-xl font-bold">Loading playback…</p>
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

            <p className="mt-2 text-sm text-white/60">{error}</p>

            <button
              type="button"
              onClick={loadPlayback}
              className="mt-5 min-h-12 rounded-xl bg-[#c4202f] px-5 py-3 font-black text-white"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && playback && (
          <div
            className="grid min-h-0"
            style={{
              gridTemplateRows: `minmax(0, 1fr) ${queueHeight}`,
              gap: pageGap,
            }}
          >
            <section
              className="grid min-h-0"
              style={{
                gridTemplateColumns: contentColumns,
                gap: pageGap,
              }}
            >
              <div
                className={`grid min-h-0 overflow-hidden rounded-3xl border border-[#c4202f]/60 bg-[#101010] shadow-2xl transition-all duration-500 ease-in-out ${
                  nowPlayingTransitioning
                    ? "-translate-x-8 opacity-0"
                    : "translate-x-0 opacity-100"
                } ${
                  displaySettings.showVideo
                    ? ""
                    : "mx-auto w-full max-w-[760px]"
                }`}
                style={{
                  gridTemplateRows: `${artworkSize} minmax(0, 1fr)`,
                }}
              >
                {playback.nowPlaying ? (
                  <>
                    <div
                      className="relative max-w-full overflow-hidden bg-black"
                      style={{
                        width: displaySettings.showVideo ? artworkSize : "100%",
                        height: artworkSize,
                        justifySelf: displaySettings.showVideo
                          ? "start"
                          : "center",
                        aspectRatio: "1 / 1",
                      }}
                    >
                      <AlbumArtwork
                        track={playback.nowPlaying}
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                      <div
                        className={`absolute ${
                          scale === "small"
                            ? "bottom-2 left-2"
                            : "bottom-4 left-4"
                        }`}
                      >
                        <span
                          className={`inline-flex items-center gap-2 rounded-full bg-[#c4202f] font-black uppercase tracking-wider text-white shadow-lg ${
                            scale === "small"
                              ? "px-3 py-1.5 text-[9px]"
                              : "px-4 py-2 text-xs"
                          }`}
                        >
                          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                          Playing Now
                        </span>
                      </div>
                    </div>

                    <div
                      className={`min-h-0 overflow-hidden border-t border-[#c4202f]/35 bg-[#111111] ${
                        scale === "small" ? "p-3" : "p-4"
                      }`}
                    >
                      <CategoryBadge
                        requestType={playback.nowPlaying.requestType}
                        compact={scale === "small"}
                      />

                      <h2
                        className={`mt-2 line-clamp-2 font-black leading-tight text-white ${
                          scale === "small"
                            ? "text-xl"
                            : scale === "large"
                              ? "text-3xl"
                              : "text-2xl"
                        }`}
                      >
                        {playback.nowPlaying.trackName}
                      </h2>

                      <p
                        className={`mt-1 truncate text-white/65 ${
                          scale === "small" ? "text-sm" : "text-lg"
                        }`}
                      >
                        {playback.nowPlaying.artistName}
                      </p>

                      {playback.nowPlaying.albumName && (
                        <p
                          className={`mt-1 truncate text-white/35 ${
                            scale === "small" ? "text-[10px]" : "text-sm"
                          }`}
                        >
                          Album: {playback.nowPlaying.albumName}
                        </p>
                      )}

                      {playback.nowPlaying.lineDance ? (
                        <div
                          className={`border-t border-white/10 ${
                            scale === "small" ? "mt-2 pt-2" : "mt-3 pt-3"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <ChoreographyBadge
                              name={playback.nowPlaying.lineDance.name}
                              compact={scale === "small"}
                            />

                            <SongVersionBadge
                              isOriginalSong={
                                playback.nowPlaying.lineDance.isOriginalSong
                              }
                              compact={scale === "small"}
                            />
                          </div>

                          {playback.nowPlaying.lineDance.alsoKnownAs ? (
                            <p className="mt-1 truncate text-[10px] text-white/50">
                              Also known as:{" "}
                              {playback.nowPlaying.lineDance.alsoKnownAs}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
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

              {displaySettings.showVideo && (
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
              )}
            </section>

            <section
              className="grid min-h-0 overflow-hidden"
              style={{
                gridTemplateColumns: displaySettings.showQrCode
                  ? "minmax(0, 1fr) clamp(92px, 11vw, 140px)"
                  : "minmax(0, 1fr)",
                gap: pageGap,
              }}
            >
              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
                <div className="flex items-center justify-between px-1">
                  <h2
                    className={`font-black uppercase tracking-[0.15em] text-white ${
                      scale === "small" ? "text-sm" : "text-lg"
                    }`}
                  >
                    Up Next
                  </h2>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                    Next {displaySettings.queueCount}{" "}
                    {displaySettings.queueCount === 1 ? "song" : "songs"}
                  </p>
                </div>

                <div
                  className={`grid min-h-0 ${queueColumnClass} gap-2 transition-all duration-500 ease-in-out ${queueAnimationClass}`}
                >
                  {playback.upcoming
                    .slice(0, displaySettings.queueCount)
                    .map((track, index) => (
                      <QueueTrack
                        key={`${track.spotifyTrackId}-${index}`}
                        track={track}
                        index={index}
                        scale={scale}
                      />
                    ))}

                  {playback.upcoming.length === 0 && (
                    <div
                      className={`flex items-center justify-center rounded-2xl border border-dashed border-[#c4202f]/45 bg-[#101010] text-center text-white/45 ${
                        displaySettings.queueCount === 1
                          ? "col-span-1"
                          : displaySettings.queueCount === 2
                            ? "col-span-2"
                            : "col-span-3"
                      }`}
                    >
                      No upcoming songs are currently queued.
                    </div>
                  )}
                </div>
              </div>

              {displaySettings.showQrCode && (
                <aside className="flex min-h-0 items-center justify-center rounded-2xl border border-[#c4202f]/60 bg-[#111111] p-2 shadow-lg">
                  <div className="w-full rounded-xl bg-white p-1.5">
                    <img
                      src="/REQUEST_A_SONG.png"
                      alt="QR code to request a song"
                      className="aspect-square h-auto w-full object-contain"
                    />
                  </div>
                </aside>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}