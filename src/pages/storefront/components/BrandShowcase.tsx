import { useState } from "react";
import { Link } from "react-router-dom";
import { STORE_BRANDS } from "../brandData";

function BrandLogo({ label, logoUrl }: { label: string; logoUrl: string }) {
  const [errored, setErrored] = useState(false);
  return errored ? (
    <span className="text-sm font-semibold text-violet-800">{label}</span>
  ) : (
    <img
      src={logoUrl}
      alt={label}
      loading="lazy"
      className="h-10 w-auto object-contain"
      onError={() => setErrored(true)}
    />
  );
}

export default function BrandShowcase() {
  return (
    <section className="mt-12 rounded-[32px] border border-violet-100 bg-white/90 p-6 shadow-[0_18px_45px_-30px_rgba(79,70,229,0.6)]">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-violet-400">Marcas oficiais</p>
        <h2 className="text-2xl font-semibold text-violet-900">Escolha sua marca predileta</h2>
        <p className="text-sm text-violet-600">Passeie pelas principais casas dermocosméticas e monte sua rotina com quem você mais confia.</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {STORE_BRANDS.map((brand) => (
          <Link
            key={brand.label}
            to={brand.href}
            className="group flex h-24 flex-col items-center justify-center rounded-2xl border border-transparent bg-gradient-to-br from-white via-[#f8f6ff] to-[#f1ecff] p-4 text-center transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_20px_40px_-28px_rgba(79,70,229,0.85)]"
          >
            <BrandLogo label={brand.label} logoUrl={brand.logoUrl} />
            <span className="mt-3 text-xs font-medium uppercase tracking-[0.25em] text-violet-500 group-hover:text-violet-700">
              {brand.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
