"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Keep the fallback behind the API route so VINEXT's static asset handler does
// not intercept Safari's byte-range probe before the server can return the
// complete compatible MP4. The media route maps this URL to the bundled asset in
// production.
const SAFARI_FALLBACK_VIDEO = "/api/media/good-place-2026-safari.mp4";
const DEFAULT_VIDEO = "/media/good-place-2026.mp4";

export default function AwardVideo({ src = "/media/good-place-2026.mp4" }: { src?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // The bundled award clip has a constrained-baseline copy for WebKit. Use it
  // as the initial source for the bundled default, so iOS does not first make
  // a failing byte-range probe against the legacy Main-profile file. Managed
  // videos keep their configured URL and still use the runtime error fallback.
  const [videoSrc, setVideoSrc] = useState(src === DEFAULT_VIDEO ? SAFARI_FALLBACK_VIDEO : src);

  const switchToFallback = useCallback(() => {
    if (videoSrc === SAFARI_FALLBACK_VIDEO) return;
    setVideoSrc(SAFARI_FALLBACK_VIDEO);
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoSrc === SAFARI_FALLBACK_VIDEO) return;
    const handleFallback = () => switchToFallback();
    video.addEventListener("error", handleFallback);
    // Some WebKit builds reject the stream after the first 206 probe without
    // dispatching React's synthetic onError event. Handle that terminal
    // decoder state as well, after a short grace period for slow networks.
    const timer = window.setTimeout(() => {
      if (video.error && video.readyState === HTMLMediaElement.HAVE_NOTHING) switchToFallback();
    }, 2500);
    return () => {
      video.removeEventListener("error", handleFallback);
      window.clearTimeout(timer);
    };
  }, [switchToFallback, videoSrc]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      if (media.matches) video.pause();
      else void video.play().catch(() => undefined);
    };

    syncPlayback();
    media.addEventListener("change", syncPlayback);
    return () => media.removeEventListener("change", syncPlayback);
  }, [videoSrc]);

  return (
    <video
      key={videoSrc}
      ref={videoRef}
      src={videoSrc}
      autoPlay
      muted
      loop
      playsInline
      controls
      preload="metadata"
      onError={() => {
        // The legacy award file is H.264 Main and plays in Chromium, but some
        // iOS/WebKit builds reject it before requesting the next byte range.
        // Keep the managed Yandex URL as the first choice and fall back to the
        // bundled constrained-baseline copy without exposing storage details.
        switchToFallback();
      }}
      aria-label="Салон Ассоль получил знак Хорошее место 2026 от Яндекса"
    />
  );
}
