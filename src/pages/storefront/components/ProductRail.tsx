import { MouseEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductSummary } from "../../Store/api";
import { useProductLikes } from "../ProductLikesContext";
import { HeartIcon } from "./ProductCard";
import { useCart } from "../CartContext";
import { ProductActionButton } from "./ProductActionButton";
import { emitAddedToCartEvent } from "../utils/cartEvents";

interface ProductRailProps {
  title: string;
  products: ProductSummary[];
  emptyState?: string;
}

export default function ProductRail({ title, products, emptyState }: ProductRailProps) {
  const { toggleLike, isLiked, likeCount, seedProducts } = useProductLikes();
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const { addItem, loading: cartLoading } = useCart();
  const discounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((product) => {
      map[product.id] = Math.floor(Math.random() * 11) + 20;
    });
    return map;
  }, [products]);

  useEffect(() => {
    if (products && products.length > 0) {
      seedProducts(products);
    }
  }, [products, seedProducts]);

  if (!products || products.length === 0) {
    return emptyState ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-violet-900">{title}</h2>
        <p className="text-sm text-zinc-500">{emptyState}</p>
      </section>
    ) : null;
  }

  const shuffledProducts = useMemo(() => [...products].sort(() => Math.random() - 0.5), [products]);

  return (
    <section className="space-y-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-violet-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 md:flex md:snap-x md:overflow-x-auto md:-mx-1 md:px-1 md:pb-2">
        {shuffledProducts.map((product) => {
          const liked = isLiked(product.id);
          const likes = likeCount(product.id);
          const added = !!addedMap[product.id];
          const discount = discounts[product.id];
          const previousPrice = Math.round(product.price * (1 + discount / 100));
          return (
          <article
            key={product.id}
            className="group flex min-h-[380px] shrink-0 flex-col snap-start rounded-2xl border border-violet-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md md:w-60"
          >
            <div className="relative overflow-hidden rounded-t-2xl bg-violet-50">
              <Link to={`/p/${product.slug}`} className="block">
                <img
                  src={product.images?.[0]?.url || "/media/placeholder-product.svg"}
                  alt={product.name}
                  loading="lazy"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (!target.dataset.fallbackLoaded) {
                      target.dataset.fallbackLoaded = "true";
                      target.src = "/media/placeholder-product.svg";
                    }
                  }}
                  className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </Link>
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800 shadow-sm">
                -{discounts[product.id]}%
              </span>
              <button
                type="button"
                aria-pressed={liked}
                aria-label={liked ? "Remover amei" : "Marcar como amei"}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleLike(product.id);
                  setPulseId(product.id);
                  window.setTimeout(() => setPulseId((current) => (current === product.id ? null : current)), 300);
                }}
                className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-violet-600 shadow transition-all duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                  liked ? "text-violet-700" : ""
                } ${pulseId === product.id ? "animate-heart-pop" : ""}`}
              >
                <HeartIcon liked={liked} />
                <span className="min-w-[1.25rem] text-center">{likes}</span>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-sm">
              <Link to={`/p/${product.slug}`} className="font-medium text-violet-900">
                {product.name}
              </Link>
              <p className="text-xs uppercase tracking-wide text-violet-600">{product.brand || "Dermosul"}</p>
              <div className="flex flex-col text-sm">
                <span className="text-xs text-violet-300 line-through">
                  {(previousPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-sm font-semibold text-violet-900">
                  {(product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="mt-auto pt-1">
                <ProductActionButton
                  added={added}
                  disabled={cartLoading}
                  onConfirm={async () => {
                    await addItem({ productId: product.id, quantity: 1 });
                    setAddedMap((prev) => ({ ...prev, [product.id]: true }));
                    emitAddedToCartEvent(product, 1);
                    window.setTimeout(() => {
                      setAddedMap((prev) => {
                        if (!prev[product.id]) return prev;
                        const next = { ...prev };
                        delete next[product.id];
                        return next;
                      });
                    }, 2500);
                  }}
                />
              </div>
            </div>
          </article>
        );
        })}
      </div>
    </section>
  );
}
