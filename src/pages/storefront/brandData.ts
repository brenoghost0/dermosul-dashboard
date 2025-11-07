export type StoreBrand = {
  label: string;
  href: string;
  logoUrl: string;
};

const createSearchHref = (brand: string) => `/buscar?q=${encodeURIComponent(brand)}`;

export const STORE_BRANDS: StoreBrand[] = [
  { label: "Adcos", logoUrl: "https://logo.clearbit.com/adcos.com.br" },
  { label: "Alastin", logoUrl: "https://logo.clearbit.com/alastin.com" },
  { label: "Bioderma", logoUrl: "https://logo.clearbit.com/bioderma.com.br" },
  { label: "CeraVe", logoUrl: "https://logo.clearbit.com/cerave.com" },
  { label: "Cetaphil", logoUrl: "https://logo.clearbit.com/cetaphil.com.br" },
  { label: "Darrow", logoUrl: "https://logo.clearbit.com/darrow.com.br" },
  { label: "Dermage", logoUrl: "https://logo.clearbit.com/dermage.com.br" },
  { label: "Ducray", logoUrl: "https://logo.clearbit.com/ducray.com" },
  { label: "Eucerin", logoUrl: "https://logo.clearbit.com/eucerin.com.br" },
  { label: "ISDIN", logoUrl: "https://logo.clearbit.com/isdin.com" },
  { label: "La Roche-Posay", logoUrl: "https://logo.clearbit.com/la-roche-posay.com" },
  { label: "Mantecorp", logoUrl: "https://logo.clearbit.com/mantecorpskincare.com.br" },
  { label: "NeoStrata", logoUrl: "https://logo.clearbit.com/neostrata.com" },
  { label: "Neutrogena", logoUrl: "https://logo.clearbit.com/neutrogena.com" },
  { label: "SkinCeuticals", logoUrl: "https://logo.clearbit.com/skinceuticals.com" },
  { label: "Vichy", logoUrl: "https://logo.clearbit.com/vichy.com" },
].map((brand) => ({
  ...brand,
  href: createSearchHref(brand.label),
}));
