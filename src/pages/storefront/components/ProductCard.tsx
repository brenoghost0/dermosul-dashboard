import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductSummary } from "../../Store/api";
import { useCart } from "../CartContext";
import { useProductLikes } from "../ProductLikesContext";
import { ProductActionButton } from "./ProductActionButton";
import { emitAddedToCartEvent } from "../utils/cartEvents";

export default function ProductCard({ product }: { product: ProductSummary }) {
  const { addItem, loading } = useCart();
  const { toggleLike, isLiked, likeCount } = useProductLikes();
  const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : "/media/placeholder-product.svg";
  const [added, setAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulse, setPulse] = useState(false);
  const discount = useMemo(() => Math.floor(Math.random() * 11) + 20, []);
  const previousPrice = useMemo(() => Math.round(product.price * (1 + discount / 100)), [product.price, discount]);
  const liked = isLiked(product.id);
  const likes = likeCount(product.id);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  return (
    <article className="group flex flex-col rounded-2xl border border-violet-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative overflow-hidden rounded-t-2xl bg-violet-50">
        <Link to={`/p/${product.slug}`} className="block">
          <img
            src={imageUrl}
            alt={product.name}
            onError={(event) => {
              const target = event.currentTarget;
              if (!target.dataset.fallbackLoaded) {
                target.dataset.fallbackLoaded = "true";
                target.src = "/media/placeholder-product.svg";
              }
            }}
            className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800 shadow-sm">
          -{discount}%
        </span>
        <button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? "Remover amei" : "Marcar como amei"}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            toggleLike(product.id);
            setPulse(true);
            window.setTimeout(() => setPulse(false), 300);
          }}
          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-violet-600 shadow transition-all duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
            liked ? "text-violet-700" : ""
          } ${pulse ? "animate-heart-pop" : ""}`}
        >
          <HeartIcon liked={liked} />
          <span className="min-w-[1.25rem] text-center">{likes}</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <Link to={`/p/${product.slug}`} className="text-sm font-medium text-violet-900">
          {product.name}
        </Link>
        <div className="text-xs uppercase tracking-wide text-violet-600">{product.brand}</div>
        <div className="flex flex-col text-sm">
          <span className="text-xs text-violet-300 line-through">{formatCurrency(previousPrice)}</span>
          <span className="font-semibold text-violet-900">{formatCurrency(product.price)}</span>
        </div>
        <div className="mt-auto pt-1">
          <ProductActionButton
            added={added}
            disabled={loading}
            onConfirm={async () => {
              await addItem({ productId: product.id, quantity: 1 });
              setAdded(true);
              emitAddedToCartEvent(product, 1);
              if (resetTimer.current) {
                clearTimeout(resetTimer.current);
              }
              resetTimer.current = setTimeout(() => {
                setAdded(false);
                resetTimer.current = null;
              }, 2500);
            }}
          />
        </div>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HeartIcon({ liked }: { liked: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={liked ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61c-1.54-1.64-4.04-1.64-5.58 0L12 7.17l-3.26-3.3c-1.54-1.64-4.04-1.64-5.58 0-1.62 1.73-1.62 4.53 0 6.26l8.13 8.72a1 1 0 0 0 1.42 0l8.13-8.72c1.62-1.73 1.62-4.53 0-6.26Z" />
    </svg>
  );
}
