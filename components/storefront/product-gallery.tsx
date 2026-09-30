'use client';

import Image from "next/image";
import { useMemo, useState } from "react";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";

type ProductMedia = StorefrontProductDetail["media"][number];

export function ProductGallery({
  product,
  mediaOverride,
}: {
  product: StorefrontProductDetail;
  mediaOverride?: ProductMedia[];
}) {
  const media = useMemo(() => (mediaOverride?.length ? mediaOverride : product.media), [mediaOverride, product.media]);
  return <ProductGalleryView key={media.map((item) => item.id).join("|")} product={product} media={media} />;
}

function ProductGalleryView({
  product,
  media,
}: {
  product: StorefrontProductDetail;
  media: ProductMedia[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(() => new Set());

  const selected = media[selectedIndex] ?? media[0];
  const selectedFailed = Boolean(selected && failedMediaIds.has(selected.id));

  const markFailed = (id: string) => {
    setFailedMediaIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  if (!media.length || !selected || selectedFailed) {
    return (
      <div
        className="flex aspect-[4/5] items-center justify-center border-2 border-border bg-primary-yellow p-8 text-center font-900 uppercase shadow-hard-md lg:border-4 lg:shadow-hard-lg"
        aria-label="Product image unavailable"
      >
        Image unavailable
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <figure className="overflow-hidden border-2 border-border bg-white shadow-hard-md lg:border-4 lg:shadow-hard-lg">
        <div className="relative aspect-[4/5]">
          <Image
            src={selected.url}
            alt={selected.altText ?? product.title}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 55vw"
            className="object-cover"
            onError={() => markFailed(selected.id)}
          />
        </div>
      </figure>
      {media.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Product image selection">
          {media.map((item, index) => {
            const failed = failedMediaIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-label={"View product image " + (index + 1)}
                aria-current={selectedIndex === index ? "true" : undefined}
                onClick={() => setSelectedIndex(index)}
                className="relative aspect-square overflow-hidden border-2 border-border bg-primary-yellow shadow-hard-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {failed ? (
                  <span className="flex h-full items-center justify-center p-2 text-center text-[10px] font-900 uppercase" aria-hidden="true">
                    Unavailable
                  </span>
                ) : (
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="(max-width: 639px) 20vw, 12vw"
                    className="object-cover"
                    onError={() => markFailed(item.id)}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
