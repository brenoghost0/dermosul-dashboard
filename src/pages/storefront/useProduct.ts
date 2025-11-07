import { useState, useEffect } from "react";
import { storefrontApi } from "./api";
import type { ProductDetail } from "../Store/api";

export function useProduct(slug: string | undefined) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      if (!slug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await storefrontApi.getProduct(slug);
        setProduct(data);
      } catch (err: any) {
        setError(err?.message || "Produto não encontrado.");
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [slug]);

  return { product, loading, error };
}
