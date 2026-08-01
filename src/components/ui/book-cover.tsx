/**
 * BookCover — stylized "3D book" cover art, used in place of a flat product
 * image wherever a product has a `coverColor` set (enrichment pass borrowed
 * from the university-library reference project's BookCover/BookCoverSvg).
 *
 * Backward compatible by design: when `coverColor` is absent (any product
 * seeded/created before this field existed), callers should render their
 * existing flat `<img>` instead — this component is additive, not a
 * replacement for the image pipeline.
 *
 * React.memo with a custom comparator prevents flicker on TanStack Query
 * refetches/invalidations: the SVG + image only re-render when the actual
 * cover data changes, not on every parent re-render.
 */

import { memo } from "react";
import { BookCoverSvg } from "./book-cover-svg";

export type BookCoverVariant = "extraSmall" | "small" | "medium" | "regular" | "wide" | "fill";

// Width classes only — height follows via aspect-[143/199] (the SVG's native
// viewBox ratio), except "fill" which trusts the parent container's box
// (used where the parent already enforces sizing, e.g. ProductDetail's hero).
const VARIANT_WIDTH: Record<BookCoverVariant, string> = {
  extraSmall: "w-10 sm:w-12",
  small: "w-16 sm:w-20",
  medium: "w-28 sm:w-32",
  regular: "w-40 sm:w-48",
  wide: "w-56 sm:w-64",
  fill: "w-full h-full",
};

interface BookCoverProps {
  className?: string;
  variant?: BookCoverVariant;
  coverColor: string;
  coverImage?: string | null;
  alt?: string;
}

const BookCoverImpl = ({ className = "", variant = "regular", coverColor, coverImage, alt = "Book cover" }: BookCoverProps) => {
  const sizeClass = VARIANT_WIDTH[variant];
  const isFill = variant === "fill";

  return (
    <div className={`relative ${sizeClass} ${isFill ? "" : "aspect-[143/199]"} ${className}`}>
      <BookCoverSvg coverColor={coverColor} />

      {/* Inner image area matches the SVG's open-cover face (left 12%, ~87.5% x 88%) */}
      <div className="absolute z-10" style={{ left: "12%", width: "87.5%", height: "88%" }}>
        {coverImage ? (
          <img
            src={coverImage}
            alt={alt}
            className="size-full rounded-sm object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-sm bg-black/10">
            <span className="text-[10px] text-white/80 sm:text-xs">No Cover</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const BookCover = memo(BookCoverImpl, (prev, next) => {
  return (
    prev.coverImage === next.coverImage &&
    prev.coverColor === next.coverColor &&
    prev.variant === next.variant &&
    prev.className === next.className &&
    prev.alt === next.alt
  );
});
BookCover.displayName = "BookCover";
