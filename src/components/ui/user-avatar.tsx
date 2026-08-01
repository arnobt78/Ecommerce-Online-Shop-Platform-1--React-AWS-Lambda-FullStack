/**
 * UserAvatar Component
 *
 * Shows the user's real profile picture (e.g. from Google sign-in) when one
 * exists; otherwise falls back to a deterministic Robohash avatar generated
 * from the user's id, so every user has a distinct avatar instead of a blank
 * image. Same "try the real thing, fall back gracefully" pattern as
 * docs/SAFE_IMAGE_REUSABLE_COMPONENT.md, adapted for avatars.
 */

import { useState } from "react";

interface UserAvatarProps {
  image?: string | null;
  userId?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ image, userId, size = 32, className = "" }: UserAvatarProps) {
  // Track the specific src that failed to load (rather than a plain boolean)
  // so a *new* image value is trusted again without needing an effect to
  // reset a stale "fallback" flag (e.g. after a fresh Google sign-in).
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);

  const fallbackSrc = `https://robohash.org/${encodeURIComponent(
    userId || "guest"
  )}?set=set4&size=${size * 2}x${size * 2}`;

  const src = !image || image === erroredSrc ? fallbackSrc : image;

  return (
    <img
      src={src}
      onError={() => setErroredSrc(image ?? null)}
      alt="User avatar"
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
