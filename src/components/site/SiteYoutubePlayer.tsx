import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, RotateCcw } from "lucide-react";
import HomeLeavingLink from "../HomeLeavingLink";
import { YOUTUBE_DEFAULT_QUALITY, YOUTUBE_PLAYER_VARS } from "../../lib/youtubeEmbed";
import { cn } from "../../lib/utils";

type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  unMute: () => void;
  setPlaybackQuality: (quality: string) => void;
  getAvailableQualityLevels: () => Array<{ quality: string }>;
};

type YTPlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YTPlayer }) => void;
      onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    };
  },
) => YTPlayer;

declare global {
  interface Window {
    YT?: {
      Player: YTPlayerConstructor;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

const VISIBILITY_RATIO = 0.35;
const HEADER_ROOT_MARGIN = "-72px 0px 0px 0px";
const PAUSE_DEBOUNCE_MS = 400;

function loadYoutubeIframeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const finish = () => resolve();

      if (window.YT?.Player) {
        finish();
        return;
      }

      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        finish();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      } else {
        const interval = window.setInterval(() => {
          if (window.YT?.Player) {
            window.clearInterval(interval);
            finish();
          }
        }, 50);
        window.setTimeout(() => window.clearInterval(interval), 5000);
      }
    });
  }

  return youtubeApiPromise;
}

function isTargetVisible(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (rect.height <= 0) return false;
  const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 72);
  return visibleHeight / rect.height >= VISIBILITY_RATIO;
}

function applyPreferredQuality(player: YTPlayer) {
  const levels = player.getAvailableQualityLevels?.() ?? [];
  const available = new Set(levels.map((level) => level.quality));

  if (available.has(YOUTUBE_DEFAULT_QUALITY)) {
    player.setPlaybackQuality(YOUTUBE_DEFAULT_QUALITY);
    return;
  }

  if (available.has("large")) {
    player.setPlaybackQuality("large");
  }
}

type SiteYoutubePlayerProps = {
  videoId: string;
  autoplay?: boolean;
  playWhenVisible?: boolean;
  visibilityTargetRef?: RefObject<HTMLElement | null>;
  className?: string;
  saveScrollOnLeave?: boolean;
  moreVideosHref?: string;
  moreVideosLabel?: string;
  onMoreVideosClick?: () => void;
  hideMoreVideos?: boolean;
};

export default function SiteYoutubePlayer({
  videoId,
  autoplay = false,
  playWhenVisible = false,
  visibilityTargetRef,
  className,
  saveScrollOnLeave = false,
  moreVideosHref = "/videos",
  moreVideosLabel = "Ver mais vídeos",
  onMoreVideosClick,
  hideMoreVideos = false,
}: SiteYoutubePlayerProps) {
  const reactId = useId();
  const containerId = `yt-player-${reactId.replace(/:/g, "")}`;
  const playerRef = useRef<YTPlayer | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const shouldPlayRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setEnded(false);
    shouldPlayRef.current = false;

    if (!videoId) return;

    loadYoutubeIframeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current?.destroy();

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          ...YOUTUBE_PLAYER_VARS,
          autoplay: autoplay ? 1 : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setReady(true);
            setEnded(false);
            applyPreferredQuality(event.target);
            if (autoplay || (playWhenVisible && shouldPlayRef.current)) {
              event.target.unMute();
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) {
              setEnded(true);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, autoplay, containerId, playWhenVisible]);

  useEffect(() => {
    if (!playWhenVisible || !ready || !videoId) return;

    const visibilityTarget = visibilityTargetRef?.current ?? rootRef.current;
    if (!visibilityTarget) return;

    const clearPauseTimer = () => {
      if (pauseTimerRef.current !== null) {
        window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };

    const playWithSound = () => {
      const player = playerRef.current;
      if (!player) return;
      setEnded(false);
      player.unMute();
      player.playVideo();
    };

    const pause = () => {
      playerRef.current?.pauseVideo();
    };

    const setShouldPlay = (next: boolean, fromScroll = false) => {
      if (next) {
        clearPauseTimer();
        if (!shouldPlayRef.current || fromScroll) {
          shouldPlayRef.current = true;
          playWithSound();
        }
        return;
      }

      if (!shouldPlayRef.current) return;
      shouldPlayRef.current = false;

      clearPauseTimer();
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = null;
        if (!shouldPlayRef.current) pause();
      }, PAUSE_DEBOUNCE_MS);
    };

    const onScroll = () => {
      if (!isTargetVisible(visibilityTarget)) return;
      setShouldPlay(true, true);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry =
          entries.find((item) => item.target === visibilityTarget) ?? entries[0];
        if (!entry) return;
        const visible =
          entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_RATIO;
        setShouldPlay(visible);
      },
      {
        threshold: [0, 0.15, 0.35, 0.5, 0.75, 1],
        rootMargin: HEADER_ROOT_MARGIN,
      },
    );

    observer.observe(visibilityTarget);
    window.addEventListener("scroll", onScroll, { passive: true });

    requestAnimationFrame(() => {
      if (isTargetVisible(visibilityTarget)) {
        setShouldPlay(true);
      }
    });

    return () => {
      clearPauseTimer();
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [playWhenVisible, ready, videoId, visibilityTargetRef]);

  const replay = () => {
    setEnded(false);
    playerRef.current?.unMute();
    playerRef.current?.playVideo();
  };

  const MoreVideosLink = saveScrollOnLeave ? HomeLeavingLink : Link;

  const moreVideosClassName =
    "inline-flex items-center gap-2 rounded-lg bg-[#a21b7e] px-8 py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-[#8e176e]";

  return (
    <div
      ref={rootRef}
      className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}
    >
      <div id={containerId} className="absolute inset-0 h-full w-full" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/70">
          A carregar vídeo…
        </div>
      )}

      {ended && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#3d001d]/92 px-6 text-center text-white">
          <p className="text-sm uppercase tracking-wider text-white/75">Vídeo concluído</p>
          {!hideMoreVideos && (
            onMoreVideosClick ? (
              <button type="button" onClick={onMoreVideosClick} className={moreVideosClassName}>
                {moreVideosLabel}
                <ChevronRight size={16} />
              </button>
            ) : (
              <MoreVideosLink to={moreVideosHref} className={moreVideosClassName}>
                {moreVideosLabel}
                <ChevronRight size={16} />
              </MoreVideosLink>
            )
          )}
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-2 text-sm text-white/85 transition-colors hover:text-white"
          >
            <RotateCcw size={15} />
            Rever vídeo
          </button>
        </div>
      )}
    </div>
  );
}
