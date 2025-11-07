import type { ProductSummary } from "../../Store/api";

export type AddedToCartDetail = {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
  origin?: string;
};

export function emitAddedToCartEvent(
  product: ProductSummary,
  quantity: number,
  options: { origin?: string } = {}
) {
  if (typeof window === "undefined") return;
  const detail: AddedToCartDetail = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    price: product.price,
    imageUrl: product.imageUrl || product.images?.[0]?.url || null,
    quantity,
    origin: options.origin,
  };
  const event = new CustomEvent<AddedToCartDetail>("dermosul:cart:added", { detail });
  window.dispatchEvent(event);
  if (typeof document !== "undefined") {
    document.dispatchEvent(event);
  }
}
