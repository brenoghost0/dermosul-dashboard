import { ChangeEvent } from "react";

export type SortValue =
  | "relevance"
  | "bestsellers"
  | "rating_desc"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "newest";

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "bestsellers", label: "Mais vendidos" },
  { value: "rating_desc", label: "Mais bem avaliados" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "name_asc", label: "De A a Z" },
  { value: "newest", label: "Novidades" },
];

type ProductSortBarProps = {
  value: SortValue;
  onChange: (value: SortValue) => void;
};

export function ProductSortBar({ value, onChange }: ProductSortBarProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value as SortValue);
  }

  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-violet-500">
        Ordenar por:
      </h2>
      <div className="inline-flex items-center gap-3">
        <select
          value={value}
          onChange={handleChange}
          className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow-[0_8px_24px_-16px_rgba(118,73,249,0.25)] transition focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const PRODUCT_SORT_OPTIONS = SORT_OPTIONS;
