// A real photograph when one is set; otherwise the labelled placeholder slot.
import { Placeholder, seedFrom } from "./Placeholder";

export interface ImageSource {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  srcSet?: string;
  avifSrcSet?: string;
  focalX?: number | null;
  focalY?: number | null;
}

export interface SiteImageProps {
  image?: ImageSource | null;
  brief?: string | null;
  meta?: string;
  ratio?: string;
  full?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export function SiteImage({ image, brief, meta, ratio, full, priority, sizes = "100vw", className }: SiteImageProps) {
  if (!image?.src) return <Placeholder shot={brief || "Photograph"} meta={meta} seed={seedFrom(brief || "x")} ratio={ratio} full={full} className={className} />;
  return (
    <picture className={className}>
      {image.avifSrcSet && <source type="image/avif" srcSet={image.avifSrcSet} sizes={sizes} />}
      {image.srcSet && <source type="image/webp" srcSet={image.srcSet} sizes={sizes} />}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        style={{
          ...(ratio ? { aspectRatio: ratio, objectFit: "cover" as const, width: "100%" } : {}),
          // Focal point keeps the subject in frame when cards and heroes crop (FR-ADM-027).
          ...(image.focalX != null && image.focalY != null ? { objectPosition: `${Math.round(image.focalX * 100)}% ${Math.round(image.focalY * 100)}%` } : {}),
        }}
      />
    </picture>
  );
}
