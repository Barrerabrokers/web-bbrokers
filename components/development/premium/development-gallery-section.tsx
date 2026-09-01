import { DevelopmentMediaMosaic } from "@/components/development/development-media-mosaic";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentGallerySectionProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentGallerySection({ model }: DevelopmentGallerySectionProps) {
  const { development, coverVideo, galleryVideoUrls, primaryImage } = model;

  return (
    <section id="galeria" className="px-3 pb-16 md:px-6 md:pb-28">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8" data-dev-reveal>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a1d17]/68">
              Galería inmersiva
            </p>
            <h2 className="mt-3 max-w-4xl font-display text-[clamp(3rem,7vw,6.8rem)] font-light leading-[0.92] tracking-[-0.04em]">
              Arquitectura, atmósfera y detalle.
            </h2>
          </div>
        </div>

        <div data-dev-reveal>
          <DevelopmentMediaMosaic
            images={development.images}
            name={development.name}
            video={coverVideo}
          />
        </div>

        {galleryVideoUrls.length > 0 && (
          <div className="mt-5 grid gap-4 md:grid-cols-2" data-dev-reveal>
            {galleryVideoUrls.map((url, index) => (
              <video
                key={url}
                src={url}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={primaryImage}
                disablePictureInPicture
                aria-label={`Video ${index + 1} sin audio de ${development.name}`}
                className={`aspect-video w-full bg-[#070707] object-cover ${
                  galleryVideoUrls.length === 1 ? "md:col-span-2" : ""
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
