/**
 * ProductVideo — optional book-trailer video player for the product detail
 * page. Renders nothing when `videoUrl` is absent (enrichment field, most
 * products won't have one) so callers can render it unconditionally without
 * an extra guard.
 *
 * Uses a plain native <video> element (no external player SDK) since the
 * seeded URLs are direct file links — keeps this dependency-free and works
 * for any CDN-hosted mp4/webm, not just one provider.
 */

interface ProductVideoProps {
  videoUrl?: string | null;
  className?: string;
}

export const ProductVideo = ({ videoUrl, className = "" }: ProductVideoProps) => {
  if (!videoUrl) return null;

  return (
    <video
      key={videoUrl}
      controls
      preload="metadata"
      className={`w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-black ${className}`}
    >
      <source src={videoUrl} />
      Your browser does not support the video tag.
    </video>
  );
};
