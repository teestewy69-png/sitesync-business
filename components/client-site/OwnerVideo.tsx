import { ownerVideoEmbed } from "@/lib/factory/owner-intake";

/**
 * Optional "Meet the owner" video on a client site. Renders nothing at all when the client has no video URL
 * (or the URL isn't a YouTube / Vimeo / https video file link), so templates can always include it.
 */
export default function OwnerVideo({
  url,
  businessName,
  className,
  headingClassName,
}: {
  url?: string | null;
  businessName: string;
  className?: string;
  headingClassName?: string;
}) {
  const embed = ownerVideoEmbed(url);
  if (!embed) return null;
  const title = `Meet the owner of ${businessName}`;
  return (
    <section className={className} aria-labelledby="owner-video-heading" data-section="owner-video">
      <h2 id="owner-video-heading" className={headingClassName}>
        Meet the owner
      </h2>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", marginTop: "1rem", borderRadius: "1rem", overflow: "hidden", background: "#000" }}>
        {embed.kind === "iframe" ? (
          <iframe
            src={embed.src}
            title={title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <video
            src={embed.src}
            controls
            preload="metadata"
            playsInline
            aria-label={title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        )}
      </div>
    </section>
  );
}
