import { Link } from "react-router-dom";
import { useStorefrontContext } from "../StorefrontContext";

const DEFAULT_PAYMENT_ICONS: never[] = [];
const DEFAULT_SOCIAL_LINKS: never[] = [];

export default function StorefrontFooter() {
  const { settings, footerMenu } = useStorefrontContext();
  const textBlocks = settings?.textBlocks;
  const description = textBlocks?.footer?.description || "A Dermosul conecta ciência e carinho para criar cuidados que abraçam cada pele brasileira.";
  const contactEmail = textBlocks?.footer?.contactEmail || settings?.contact?.email || "atendimento@dermosul.com.br";
  const contactPhone = textBlocks?.footer?.contactPhone || settings?.contact?.phone || "+55 11 4000-0000";
  const serviceHours = textBlocks?.footer?.serviceHours || "Seg a Sex, 9h às 18h";
  const paymentMessage = textBlocks?.footer?.paymentMessage || "Até 6x sem juros no cartão";
  const paymentLogos = textBlocks?.footer?.paymentLogos || [];
  const socialItems = textBlocks?.footer?.socialLinks || [];

  const focusPrimaryContent = () => {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      const anchor =
        document.querySelector("[data-storefront-content-start]") ||
        document.querySelector("main");
      if (!anchor) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const top = anchor.getBoundingClientRect().top + window.scrollY;
      const offset = Math.max(top - 80, 0);
      window.scrollTo({ top: offset, behavior: "smooth" });
    }, 150);
  };

  return (
    <footer className="mt-12 border-t border-[#221445] bg-[#110120] text-violet-100">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-4 py-12">
        <div className="min-w-[220px] flex-1 space-y-4">
          <h4 className="text-lg font-semibold tracking-wide text-white">Dermosul</h4>
          <p className="text-sm text-violet-200">{description}</p>
          <div className="space-y-1 text-xs text-violet-300">
            <p>E-mail: {contactEmail}</p>
            <p>Telefone: {contactPhone}</p>
            <p>Horário: {serviceHours}</p>
          </div>
        </div>

        <div className="min-w-[160px]">
          <h5 className="text-sm font-semibold uppercase tracking-wide text-violet-200">Navegação</h5>
          <ul className="mt-3 space-y-2 text-sm text-violet-300">
            {(footerMenu?.items || []).map((item) => (
              <li key={item.id}>
                <Link to={item.href} className="hover:text-white transition" onClick={focusPrimaryContent}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-[240px] flex-1 space-y-4">
          <h5 className="text-sm font-semibold uppercase tracking-wide text-violet-200">Newsletter</h5>
          <p className="text-sm text-violet-300">Receba novidades, histórias e dicas fresquinhas Dermosul.</p>
          <form className="flex gap-2">
            <input
              type="email"
              placeholder="Digite seu e-mail"
              className="flex-1 rounded-full border border-violet-500 bg-violet-950 px-3 py-2 text-sm text-violet-100 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              className="rounded-full bg-violet-500 px-4 py-2 text-xs font-medium text-violet-950 transition hover:bg-violet-400"
            >
              Quero receber
            </button>
          </form>

          {paymentLogos.length > 0 && (
            <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/4 p-4 shadow-[0_18px_38px_rgba(8,0,32,0.4)] backdrop-blur">
              <div>
                <h6 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-violet-200">Pagamento</h6>
                <p className="mt-2 text-xs text-violet-200/80">{paymentMessage}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {paymentLogos.map((item) => (
                  <div key={item.label} className="flex h-9 w-14 items-center justify-center rounded-xl bg-white shadow-[0_10px_28px_rgba(12,0,48,0.35)]">
                    <img src={item.icon} alt={item.label} className="max-h-5 w-auto" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {socialItems.length > 0 && (
            <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/4 p-4 shadow-[0_18px_38px_rgba(8,0,32,0.4)] backdrop-blur">
              <h6 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-violet-200">Redes sociais</h6>
              <div className="flex flex-wrap gap-3">
                {socialItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 transition hover:-translate-y-1 hover:bg-violet-50"
                  >
                    <span className="sr-only">{item.label}</span>
                    <img src={item.icon} alt={item.label} className="h-5 w-5" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#1e0a39] bg-[#0b0019] py-4 text-center text-xs text-violet-400">
        © {new Date().getFullYear()} Dermosul. Todos os direitos reservados.
      </div>
    </footer>
  );
}
