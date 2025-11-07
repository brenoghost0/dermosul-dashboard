import { useEffect } from "react";
import ProductCard from "./ProductCard";
import type { ProductSummary } from "../../Store/api";
import { useProductLikes } from "../ProductLikesContext";

export default function ProductGrid({ products }: { products: ProductSummary[] }) {
  const { seedProducts } = useProductLikes();

  useEffect(() => {
    if (products && products.length > 0) {
      seedProducts(products);
    }
  }, [products, seedProducts]);

  if (products.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum produto encontrado.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-soft">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
