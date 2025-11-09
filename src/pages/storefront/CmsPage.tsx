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
  const isExchangePolicyPage = slug === "politica-de-troca" || slug === "politica-troca" || slug === "trocas";
  const isContactPage = slug === "contato" || slug === "contate-nos" || slug === "fale-conosco";

  useEffect(() => {
    if (!slug) return;
    if (isAboutPage || isExchangePolicyPage || isContactPage) {
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
  }, [slug, isAboutPage, isExchangePolicyPage, isContactPage]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && slug ? `${origin}/pg/${slug}` : origin), [origin, slug]);
  const aboutMeta = {
    title: "Sobre a Dermosul | Curadoria clínica de dermocosméticos",
    description:
      "Conheça a história da Dermosul e como nossa equipe seleciona, homologa e acompanha as melhores marcas de dermocosméticos do mercado brasileiro.",
  };
  const exchangeMeta = {
    title: "Política de Trocas Dermosul | Experiência segura e humana",
    description:
      "Entenda como a Dermosul conduz trocas com atendimento humano, logística ágil e especialistas cuidando de cada etapa.",
  };

  const contactMeta = {
    title: "Contato Dermosul | Atendimento humano e assistente virtual 24h",
    description:
      "Fale com a Dermosul: chat inteligente, WhatsApp oficial, especialistas clínicos e suporte por e-mail. Tudo em um só lugar.",
  };

  const title = isAboutPage
    ? aboutMeta.title
    : isExchangePolicyPage
    ? exchangeMeta.title
    : isContactPage
    ? contactMeta.title
    : page?.metaTitle || (page?.title ? `${page.title} | Dermosul` : "Conteúdo Dermosul");
  const description = isAboutPage
    ? aboutMeta.description
    : isExchangePolicyPage
    ? exchangeMeta.description
    : isContactPage
    ? contactMeta.description
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
      <main className="mx-auto max-w-4xl px-4 py-10 overflow-x-hidden" data-storefront-content-start>
        {isAboutPage ? (
          <AboutDermosulPage />
        ) : isContactPage ? (
          <ContactPage />
        ) : isExchangePolicyPage ? (
          <ExchangePolicyPage />
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

      <section className="mx-auto max-w-6xl space-y-8 overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 p-6 text-white shadow-[0_28px_80px_-60px_rgba(109,40,217,0.6)] sm:p-8">
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

      <section className="mx-auto max-w-6xl space-y-8 overflow-hidden rounded-[32px] bg-white p-6 text-violet-900 shadow-[0_28px_90px_-60px_rgba(79,70,229,0.45)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
          <div className="space-y-4 overflow-hidden">
            <h2 className="text-xl font-semibold sm:text-2xl">Estamos aqui para cuidar com você</h2>
            <p className="text-sm text-violet-600">
              Fale com nossa equipe clínica, experimente uma rotina guiada ou descubra o próximo cuidado Dermosul. Estamos prontos para acompanhar cada etapa da sua jornada.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                className="inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-violet-500 sm:w-auto sm:tracking-[0.25em]"
              >
                Iniciar consultoria online
                <span aria-hidden="true" className="ml-2">
                  ↗
                </span>
              </button>
              <Link
                to="mailto:atendimento@dermosul.com.br"
                className="inline-flex w-full items-center justify-center rounded-full border border-violet-200 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-700 transition hover:border-violet-300 hover:text-violet-900 sm:w-auto sm:tracking-[0.25em] break-words"
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

function ExchangePolicyPage() {
  const { settings } = useStorefrontContext();
  const contactEmail = settings?.textBlocks?.footer?.contactEmail || settings?.contact?.email || "atendimento@dermosul.com.br";
  const contactPhone = settings?.textBlocks?.footer?.contactPhone || settings?.contact?.phone || "+55 11 4000-0000";
  const whatsappNumber = contactPhone?.replace(/\D/g, "") || "551100000000";
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const stats = [
    { label: "Prazo para solicitar", value: "7 dias corridos" },
    { label: "Tempo médio de resposta", value: "45 minutos" },
    { label: "Avaliação do processo", value: "4,9/5" },
  ];

  const steps = [
    {
      title: "Solicite em poucos cliques",
      description: "Envie o número do pedido e o motivo pelo WhatsApp ou e-mail. Respondemos em até 1h em dias úteis.",
      icon: "📝",
    },
    {
      title: "Confirmação clínica",
      description: "Nossa equipe valida o lote, orienta sobre armazenamento e já indica opções equivalentes.",
      icon: "🧪",
    },
    {
      title: "Logística inteligente",
      description: "Agendamos coleta ou liberamos o código de postagem. Assim que o item chega, a troca é faturada.",
      icon: "🚚",
    },
    {
      title: "Nova entrega",
      description: "Você recebe o novo produto com prioridade Dermosul e acompanhamento até a finalização.",
      icon: "🎁",
    },
  ];

  const testimonials = [
    {
      name: "Paula Andrade",
      detail: "Rio de Janeiro",
      quote: "Precisei trocar um sérum e em dois dias já estava com um novo em mãos. Tudo explicado com carinho.",
    },
    {
      name: "Thaís Vilela",
      detail: "São Paulo",
      quote: "Achei o processo mais tranquilo que de qualquer outra loja. Tive suporte humano o tempo todo.",
    },
    {
      name: "Letícia Gomes",
      detail: "Curitiba",
      quote: "Troquei por outro dermocosmético sugerido pela equipe clínica e amei o resultado.",
    },
  ];

  const faqs = [
    {
      question: "Qual o prazo para solicitar a troca?",
      answer: "Você tem até 7 dias corridos após o recebimento. Dentro desse período, garantimos suporte humano completo.",
    },
    {
      question: "Quais itens posso trocar?",
      answer: "Produtos lacrados e em perfeitas condições, com nota fiscal e embalagem original. Para avarias, registramos em até 24h após a entrega.",
    },
    {
      question: "Como recebo o novo produto?",
      answer: "Assim que o item retorna ao nosso centro, liberamos a nova entrega com prioridade. Caso prefira, pode optar por crédito ou reembolso.",
    },
  ];

  return (
    <div className="space-y-12">
      <section className="rounded-[36px] bg-gradient-to-br from-violet-700 via-violet-600 to-sky-500 p-8 text-white shadow-[0_40px_120px_-70px_rgba(79,70,229,0.8)] sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/80">
              Dermosul Care
            </span>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Política de Troca Dermosul</h1>
            <p className="text-lg text-white/90">Processo transparente, atendimento humano e especialistas acompanhando cada etapa da sua troca.</p>
            <p className="text-sm text-white/80">
              Solicite pelo e-mail <a href={`mailto:${contactEmail}`} className="underline hover:text-white">{contactEmail}</a> ou WhatsApp oficial.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 transition hover:bg-violet-50 sm:w-auto"
              >
                Iniciar troca por e-mail
              </a>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/50 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10 sm:w-auto"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
          <div className="grid gap-4 text-center sm:grid-cols-3 lg:flex lg:flex-col">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-3xl bg-white/15 p-4 shadow-[0_10px_38px_-25px_rgba(255,255,255,0.8)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_30px_90px_-70px_rgba(79,70,229,0.4)] sm:p-10">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-violet-400">Passo a passo Dermosul</p>
          <h2 className="text-2xl font-semibold text-violet-900">Como guiamos sua troca</h2>
          <p className="text-sm text-violet-600">Em cada etapa você acompanha o status pelo e-mail ou WhatsApp.</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-4 rounded-3xl border border-violet-100 bg-violet-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow">
                {step.icon}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-violet-400">Etapa {index + 1}</p>
                <h3 className="text-lg font-semibold text-violet-900">{step.title}</h3>
                <p className="text-sm text-violet-700">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6 rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_20px_70px_-60px_rgba(79,70,229,0.35)] sm:p-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-violet-400">Confiança clínico-logística</p>
            <h2 className="text-2xl font-semibold text-violet-900">O que você pode esperar</h2>
            <p className="text-sm text-violet-600">Tudo documentado por e-mail, com fotos, laudos e prazos claros.</p>
          </div>
          <ul className="space-y-4 text-sm text-violet-700">
            <li className="flex gap-3 rounded-2xl bg-violet-50/60 p-4">
              <span className="mt-1 text-lg">💬</span>
              <div>
                <p className="font-semibold text-violet-900">Atendimento humano imediato</p>
                <p>Especialistas indicam substituições equivalentes e acompanham todo o pós-compra.</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-2xl bg-violet-50/60 p-4">
              <span className="mt-1 text-lg">🔐</span>
              <div>
                <p className="font-semibold text-violet-900">Rastreamento e segurança</p>
                <p>Você recebe o código de rastreio, comprovante de coleta e atualizações automáticas.</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-2xl bg-violet-50/60 p-4">
              <span className="mt-1 text-lg">💎</span>
              <div>
                <p className="font-semibold text-violet-900">Elegibilidade garantida</p>
                <p>Produtos lacrados ou com avaria comprovada são trocados sem burocracia.</p>
              </div>
            </li>
          </ul>
        </div>
        <div className="rounded-[32px] border border-violet-100 bg-gradient-to-b from-white to-violet-50/60 p-6 text-sm text-violet-700 shadow-[0_20px_70px_-60px_rgba(79,70,229,0.35)]">
          <h3 className="text-base font-semibold text-violet-900">Documentos necessários</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>• Número do pedido e CPF</li>
            <li>• Fotos do produto e da embalagem externa</li>
            <li>• Descrição do motivo (sensibilidade, defeito, avaria, arrependimento)</li>
          </ul>
          <div className="mt-6 rounded-2xl bg-white/80 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Canais oficiais</p>
            <p className="mt-2 font-semibold text-violet-900 break-words">{contactEmail}</p>
            <p className="text-xs text-violet-600">Seg a Sex · 8h às 20h | Sáb · 9h às 14h · WhatsApp {contactPhone}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_25px_80px_-60px_rgba(79,70,229,0.4)] sm:p-8">
        <div className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-violet-400">Avaliações reais</p>
          <h2 className="text-2xl font-semibold text-violet-900">Clientes que já trocaram com facilidade</h2>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {testimonials.map((review) => (
            <blockquote key={review.name} className="flex h-full flex-col justify-between rounded-3xl border border-violet-100 bg-violet-50/50 p-6">
              <p className="text-lg font-medium text-violet-900">“{review.quote}”</p>
              <footer className="mt-4 text-sm text-violet-600">
                <p className="font-semibold text-violet-900">{review.name}</p>
                <span className="text-xs uppercase tracking-[0.3em] text-violet-400">{review.detail}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_25px_80px_-60px_rgba(79,70,229,0.4)] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-violet-400">Perguntas frequentes</p>
          <h2 className="text-2xl font-semibold text-violet-900">Transparência do início ao fim</h2>
        </div>
        <div className="mt-6 space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-violet-900">{faq.question}</summary>
              <p className="mt-2 text-sm text-violet-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function ContactPage() {
  const { settings } = useStorefrontContext();
  const contactEmail = settings?.textBlocks?.footer?.contactEmail || settings?.contact?.email || "atendimento@dermosul.com.br";
  const contactPhone = settings?.textBlocks?.footer?.contactPhone || settings?.contact?.phone || "+55 11 4000-0000";
  const whatsappNumber = contactPhone?.replace(/\D/g, "") || "551100000000";
  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  const supportHours = settings?.textBlocks?.footer?.supportHours || "Seg a Sex · 8h às 20h | Sáb · 9h às 14h";

  const stats = [
    { value: "4,9/5", label: "Nota média no atendimento" },
    { value: "12 min", label: "Tempo médio de 1ª resposta" },
    { value: "24h", label: "Assistente virtual ativa" },
  ];

  const channels = [
    {
      title: "Assistente virtual Dermosul",
      description: "Converse com nossa IA treinada com protocolos clínicos e receba orientações imediatas.",
      action: "Iniciar chat inteligente",
      onClick: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("dermosul:chat:open", {
              detail: { prompt: "Olá Dermosul! Quero ajuda com um pedido e entender como trocar ou ajustar minha rotina." },
            })
          );
        }
      },
    },
    {
      title: "Equipe humana",
      description: "Especialistas respondem e acompanham trocas, dúvidas e recomendações personalizadas.",
      action: "Enviar e-mail",
      href: `mailto:${contactEmail}`,
    },
    {
      title: "WhatsApp verificado",
      description: "Canal direto para acompanhar pedidos, receber fotos e comprovar trocas.",
      action: "Abrir WhatsApp",
      href: whatsappLink,
      target: "_blank",
      rel: "noreferrer",
    },
  ];

  const testimonials = [
    {
      name: "Lívia Martins",
      quote: "Fui atendida pela assistente virtual e, em minutos, a equipe humana assumiu minha troca. Nunca vi um suporte tão claro.",
    },
    {
      name: "Raul Benício",
      quote: "Recebi links, status e lembretes no WhatsApp. Tudo documentado, sem repetir informações.",
    },
    {
      name: "Marina Costa",
      quote: "Perguntei sobre ingredientes para pele sensível. A resposta veio com laudos e comparativos. Confiança total.",
    },
  ];

  const faqs = [
    {
      question: "Quando acionar a assistente virtual?",
      answer: "Sempre que quiser informações rápidas: status de pedido, trocas, recomendações ou dúvidas gerais. Ela está pronta 24h.",
    },
    {
      question: "O atendimento humano é especializado?",
      answer: "Sim. Farmacêuticas, dermoconsultoras e equipe de CX com acesso aos seus históricos cuidam do pós-compra.",
    },
    {
      question: "Quais documentos preciso ter em mãos?",
      answer: "Número do pedido, CPF e, quando aplicável, fotos do lote ou embalagem. Assim garantimos agilidade.",
    },
  ];

  return (
    <div className="space-y-12">
      <section className="rounded-[36px] bg-gradient-to-br from-violet-800 via-violet-600 to-sky-500 p-8 text-white shadow-[0_40px_140px_-80px_rgba(79,70,229,0.9)] sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-white/75">
              Cuidamos com você
            </span>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Contato Dermosul</h1>
            <p className="text-lg text-white/90">Assistente virtual 24/7 + equipe humana com olhar clínico para cada etapa do seu pedido.</p>
            <p className="text-sm text-white/80">
              WhatsApp {contactPhone} · {supportHours}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={channels[0].onClick}
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 transition hover:bg-violet-50 sm:w-auto"
              >
                Conversar agora
              </button>
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10 sm:w-auto"
              >
                Enviar e-mail
              </a>
            </div>
          </div>
          <div className="grid gap-4 text-center sm:grid-cols-3 lg:grid-cols-1">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                <p className="text-xl font-semibold">{stat.value}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {channels.map((channel) => (
          <article key={channel.title} className="flex h-full flex-col justify-between rounded-[28px] border border-violet-100 bg-white p-6 shadow-[0_30px_90px_-70px_rgba(79,70,229,0.35)]">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Canal Dermosul</p>
              <h2 className="mt-2 text-xl font-semibold text-violet-900">{channel.title}</h2>
              <p className="mt-3 text-sm text-violet-600">{channel.description}</p>
            </div>
            {channel.href ? (
              <a
                href={channel.href}
                target={channel.target}
                rel={channel.rel}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-violet-500"
              >
                {channel.action}
              </a>
            ) : (
              <button
                type="button"
                onClick={channel.onClick}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-violet-500"
              >
                {channel.action}
              </button>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_25px_80px_-60px_rgba(79,70,229,0.35)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Tecnologia + acolhimento</p>
            <h2 className="text-2xl font-semibold text-violet-900">Assistente virtual + especialistas Dermosul</h2>
            <p className="text-sm text-violet-600">Nosso chat entende protocolos clínicos e, quando necessário, transfere para humanos com contexto completo.</p>
            <ul className="space-y-3 text-sm text-violet-700">
              <li>• Histórico do cliente integrado aos especialistas</li>
              <li>• Sugestões personalizadas com base em dados de pele</li>
              <li>• Supervisão de farmacêuticas e dermoconsultoras</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-violet-50/80 p-6 text-sm text-violet-700">
            <h3 className="text-base font-semibold text-violet-900">Quando cada canal entra em ação</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Assistente virtual</p>
                <p className="text-sm">Status de pedidos, trocas rápidas, sugestões de uso e dúvidas gerais.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Equipe humana</p>
                <p className="text-sm">Avalia laudos, discute ativos e acompanha logística de trocas e devoluções.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_25px_80px_-60px_rgba(79,70,229,0.35)] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-violet-400">Depoimentos</p>
          <h2 className="text-2xl font-semibold text-violet-900">Quem já falou com a Dermosul</h2>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {testimonials.map((review) => (
            <blockquote key={review.name} className="rounded-3xl border border-violet-100 bg-violet-50/60 p-6 text-violet-700 shadow-sm">
              <p className="text-lg font-medium text-violet-900">“{review.quote}”</p>
              <footer className="mt-4 text-xs uppercase tracking-[0.3em] text-violet-400">{review.name}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_25px_80px_-60px_rgba(79,70,229,0.35)] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-violet-400">FAQ</p>
          <h2 className="text-2xl font-semibold text-violet-900">Dúvidas frequentes</h2>
        </div>
        <div className="mt-6 space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-violet-900">{faq.question}</summary>
              <p className="mt-2 text-sm text-violet-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
