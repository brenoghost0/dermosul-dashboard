import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { storefrontApi } from "./api";
import type { CmsPage } from "../Store/api";
import { replaceProtocolTerms } from "./utils/text";

export default function CmsPageView() {
  const { settings } = useStorefrontContext();
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAboutPage = slug === "sobre";

  useEffect(() => {
    if (!slug) return;
    if (isAboutPage) {
      setLoading(false);
      setPage(null);
      setError(null);
      return;
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await storefrontApi.getPage(slug);
        setPage(data);
      } catch (err: any) {
        setError(err?.message || "Página não encontrada.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, isAboutPage]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && slug ? `${origin}/pg/${slug}` : origin), [origin, slug]);
  const aboutMeta = {
    title: "Sobre a Dermosul | Curadoria clínica de dermocosméticos",
    description:
      "Conheça a história da Dermosul e como nossa equipe seleciona, homologa e acompanha as melhores marcas de dermocosméticos do mercado brasileiro.",
  };
  const title = isAboutPage
    ? aboutMeta.title
    : page?.metaTitle || (page?.title ? `${page.title} | Dermosul` : "Conteúdo Dermosul");
  const description = isAboutPage
    ? aboutMeta.description
    : replaceProtocolTerms(page?.metaDescription || settings?.defaultDescription || "Conteúdos e políticas Dermosul.");

  usePageMeta({
    title,
    description,
    image: settings?.metaImageUrl || "/media/dermosul/og-image.png",
    url: pageUrl,
    type: "WebPage",
  });

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        {isAboutPage ? (
          <AboutDermosulPage />
        ) : (
          <>
            {loading && <p className="text-sm text-zinc-500">Carregando página...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!loading && !error && page && (
              <article className="prose prose-violet mx-auto max-w-none rounded-3xl border border-violet-100 bg-white p-8 shadow-sm">
                <h1>{page.title}</h1>
                <div dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
              </article>
            )}
          </>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
}

function AboutDermosulPage() {
  const stats = [
    { label: "Marcas homologadas", value: "45" },
    { label: "Rotinas acompanhadas", value: "+28 mil" },
    { label: "Especialistas parceiros", value: "27" },
    { label: "Nota de satisfação", value: "4.9/5" },
  ];

  const milestones = [
    {
      year: "2006",
      title: "Primeira curadoria clínica",
      description:
        "Nasce a Dermosul com a missão de traduzir recomendações dermatológicas em uma seleção segura das principais marcas do país.",
    },
    {
      year: "2012",
      title: "Rede de marcas parceiras",
      description:
        "Firmamos protocolos de verificação com laboratórios e distribuidores oficiais, garantindo autenticidade e cadeia fria controlada.",
    },
    {
      year: "2018",
      title: "Plataforma omnichannel",
      description:
        "Lançamos a plataforma Dermosul Store, conectando consultorias clínicas, dados de pele e o catálogo das melhores marcas.",
    },
    {
      year: "2024",
      title: "Centro de experiências",
      description:
        "Unimos atendimento digital e presencial para acompanhar resultados, sugerir substituições e entregar conveniência real.",
    },
  ];

  const methodology = [
    {
      title: "Seleção clínica rigorosa",
      description:
        "Avaliamos dossiês técnicos, estudos independentes e indicações médicas antes de incluir qualquer marca no catálogo Dermosul.",
    },
    {
      title: "Recomendações personalizadas",
      description:
        "Unimos histórico de pele, objetivos e interações entre ativos para sugerir combinações inteligentes das melhores marcas.",
    },
    {
      title: "Suporte pós-compra",
      description:
        "Acompanhamos a evolução de cada cliente, ajustamos rotinas e intermediamo contato com fabricantes quando necessário.",
    },
  ];

  const testimonials = [
    {
      name: "Camila Andrade",
      age: "38 anos · Porto Alegre",
      quote:
        "“Com a curadoria Dermosul eu parei de testar produtos no escuro. Eles comparam marcas e já entregam o que faz sentido para a minha pele.”",
    },
    {
      name: "Patrícia Vasques",
      age: "44 anos · São Paulo",
      quote:
        "“Recebo orientações claras sobre como usar cada dermocosmético e, quando preciso trocar, a equipe sugere substituições equivalentes.”",
    },
    {
      name: "Dra. Renata Mota",
      age: "Dermatologista parceira",
      quote:
        "“Recomendo a Dermosul porque sei que todas as marcas passam por validação clínica. O acompanhamento pós-compra é diferenciado.”",
    },
  ];

  const commitments = [
    "Marca oficial: vendemos apenas produtos com procedência comprovada e nota fiscal brasileira.",
    "Atualização constante do portfólio com lançamentos e best-sellers avaliados pela equipe clínica.",
    "Acompanhamento humano via chat, telefone ou consultoria agendada para ajustar rotinas.",
    "Parceria direta com fabricantes para resolver trocas, dúvidas e suporte técnico rapidamente.",
  ];

  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 text-white">
        <div className="absolute -left-32 top-12 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-52 w-52 rounded-full bg-fuchsia-400/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
            Dermatologia Brasileira
          </span>
          <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-end">
            <div className="space-y-6">
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                Curadoria clínica para escolher o melhor da dermocosmética.
              </h1>
              <p className="max-w-2xl text-sm text-violet-50 lg:text-base">
                Reunimos especialistas para analisar ativos, comprovações clínicas e experiência de uso das principais marcas. Assim, você recebe recomendações confiáveis e compra em um único lugar, com apoio antes, durante e depois da entrega.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white/10 p-4 text-center text-sm sm:gap-4 sm:p-6">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-4 text-sm whitespace-pre-wrap break-words sm:px-4 sm:py-5">
                  <p className="text-xl font-semibold text-white sm:text-2xl">{stat.value}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-white/70 sm:text-[11px] sm:tracking-[0.28em]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_24px_70px_-55px_rgba(79,70,229,0.45)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-violet-900 sm:text-2xl">Nossa metodologia de cuidado</h2>
            <p className="text-sm text-violet-600">
              Nossa curadoria aproxima dermatologia clínica das melhores marcas do mercado. Selecionamos apenas produtos com respaldo técnico, uso responsável e experiência positiva para os clientes Dermosul.
            </p>
          </div>
          <Link
            to="/buscar?q=tratamento+dermosul"
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-violet-700 transition hover:border-violet-300 hover:text-violet-900"
          >
            Explore cuidados
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {methodology.map((item) => (
            <article key={item.title} className="flex h-full flex-col justify-between rounded-3xl bg-violet-50/60 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-sm font-semibold text-violet-700">
                  {item.title.slice(0, 1)}
                </span>
                <h3 className="text-base font-semibold text-violet-900">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm text-violet-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 rounded-[32px] bg-white p-6 shadow-[0_24px_70px_-55px_rgba(79,70,229,0.35)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-violet-900 sm:text-2xl">Depoimentos reais</h2>
            <p className="text-sm text-violet-600">
              Construímos vínculos de confiança com quem usa Dermosul todos os dias. Veja o que a nossa comunidade conta.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-400">Avaliações verificadas 2024</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.name}
              className="flex h-full flex-col justify-between rounded-3xl border border-violet-100 bg-violet-50/40 p-6"
            >
              <span className="sr-only">Avaliação 5 de 5 estrelas</span>
              <div className="mb-4 flex items-center gap-1 text-amber-400" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <svg
                    key={index}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.158 3.56a1 1 0 00.95.69h3.745c.969 0 1.371 1.24.588 1.81l-3.03 2.203a1 1 0 00-.364 1.118l1.158 3.56c.3.921-.755 1.688-1.54 1.118l-3.03-2.203a1 1 0 00-1.176 0l-3.03 2.203c-.784.57-1.838-.197-1.539-1.118l1.157-3.56a1 1 0 00-.363-1.118l-3.03-2.203c-.783-.57-.38-1.81.588-1.81h3.746a1 1 0 00.95-.69l1.157-3.56z" />
                  </svg>
                ))}
              </div>
              <p className="text-lg leading-relaxed text-violet-900">{testimonial.quote}</p>
              <footer className="mt-6 text-xs uppercase tracking-[0.3em] text-violet-500">
                {testimonial.name}
                <span className="block text-[10px] normal-case tracking-normal text-violet-400">{testimonial.age}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 rounded-[32px] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 p-6 text-white shadow-[0_28px_80px_-60px_rgba(109,40,217,0.6)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Equipe clínica multidisciplinar</h2>
            <p className="text-sm text-white/80">
              Dermatologistas, farmacêuticas, bioquímicos e esteticistas avaliam laudos clínicos, padronizam orientações de uso e acompanham os resultados das marcas que indicamos. Você compra com transparência e suporte especializado.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-white/90 sm:grid-cols-2 lg:grid-cols-3">
            <div className="mx-auto w-full max-w-[18rem] min-h-[14rem] rounded-3xl bg-white/10 p-5 text-center break-words">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/80 leading-5 sm:text-[11px]">Direção clínica</p>
              <p className="mt-2 font-semibold">Dra. Lígia Monteiro</p>
              <p className="text-xs text-white/70">CRM-SP 118445 · Lidera o conselho clínico que libera novas marcas</p>
            </div>
            <div className="mx-auto w-full max-w-[18rem] min-h-[14rem] rounded-3xl bg-white/10 p-5 text-center break-words">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/80 leading-5 sm:text-[11px]">Pesquisa &amp; Desenvolvimento</p>
              <p className="mt-2 font-semibold">Mariana Chaves</p>
              <p className="text-xs text-white/70">Audita dossiês técnicos e estabilidade das linhas parceiras</p>
            </div>
            <div className="mx-auto w-full max-w-[18rem] min-h-[14rem] rounded-3xl bg-white/10 p-5 text-center break-words">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/80 leading-5 sm:text-[11px]">Experiência do paciente</p>
              <p className="mt-2 font-semibold">Daniela Albuquerque</p>
              <p className="text-xs text-white/70">Co-fundadora e líder de relacionamento com pacientes e marcas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(79,70,229,0.35)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-violet-900 sm:text-2xl">Compromissos Dermosul</h2>
            <p className="text-sm text-violet-600">
              Transparência em cada passo: do desenvolvimento à entrega em sua casa.
            </p>
          </div>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {commitments.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-3xl bg-violet-50/60 p-4 text-sm text-violet-700">
              <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">
                ✔
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 rounded-[32px] bg-white p-6 text-violet-900 shadow-[0_28px_90px_-60px_rgba(79,70,229,0.45)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Estamos aqui para cuidar com você</h2>
            <p className="text-sm text-violet-600">
              Fale com nossa equipe clínica, experimente uma rotina guiada ou descubra o próximo cuidado Dermosul. Estamos prontos para acompanhar cada etapa da sua jornada.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("dermosul:chat:open", {
                        detail: { prompt: "Olá! Gostaria de uma consultoria Dermosul para escolher meus dermocosméticos." }
                      })
                    );
                  }
                }}
                className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-violet-500"
              >
                Iniciar consultoria online
                <span aria-hidden="true" className="ml-2">
                  ↗
                </span>
              </button>
              <Link
                to="mailto:atendimento@dermosul.com.br"
                className="inline-flex items-center justify-center rounded-full border border-violet-200 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-violet-700 transition hover:border-violet-300 hover:text-violet-900"
              >
                atendimento@dermosul.com.br
              </Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-violet-100 bg-violet-50/70 p-6 text-sm text-violet-700">
            <h3 className="text-base font-semibold text-violet-900">Curadoria e confiança Dermosul</h3>
            <p className="mt-2">
              Selecionamos marcas dermocosméticas com laudos certificados. Se algum produto não atender às expectativas, nossa equipe ajuda a encontrar a melhor alternativa e acompanha cada etapa do pós-compra.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.28em] text-violet-400">Horários de atendimento</p>
            <p className="mt-1 text-sm">Seg a Sex · 8h às 20h | Sábados · 9h às 14h</p>
          </div>
        </div>
      </section>
    </div>
  );
}
