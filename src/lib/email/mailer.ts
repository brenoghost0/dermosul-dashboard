import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Dermosul <no-reply@dermosul.com.br>';
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || '';

function hasSMTP() {
  return !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!hasSMTP()) {
    console.warn('[email] SMTP not configured. Skipping send to', to);
    return { skipped: true } as const;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
    replyTo: SMTP_REPLY_TO || undefined,
  });
  return { messageId: info.messageId };
}

// Basic formatters
const BRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BRAND_SIGNATURE = 'Equipe Dermosul • CNPJ 60.426.816/0001-03';

type Highlight = { label: string; value: string };
type StatusStep = { label: string; description?: string; state: 'done' | 'active' | 'upcoming' };
type CTA = { label: string; href: string };

type EmailTemplateOptions = {
  title: string;
  subtitle?: string;
  greeting: string;
  highlights?: Highlight[];
  statusSteps: StatusStep[];
  extraContent?: string;
  cta?: CTA;
  footerNote?: string;
};

const EMAIL_BASE_STYLES = `
*{box-sizing:border-box;}
body{margin:0;padding:0;background:#f5f4ff;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1c1534;}
a{color:inherit;}
.wrapper{max-width:640px;margin:0 auto;padding:32px 16px;}
.card{border-radius:28px;background:#ffffff;overflow:hidden;box-shadow:0 25px 60px rgba(12,10,41,0.12);}
.hero{background:linear-gradient(135deg,#5522d5,#1ab6a0);padding:32px;color:#fff;}
.hero h1{margin:0 0 8px;font-size:28px;font-weight:700;}
.hero p{margin:0;font-size:16px;opacity:0.92;}
.content{padding:32px;}
.content p{line-height:1.6;margin:0 0 16px;}
.greeting{font-size:16px;font-weight:600;color:#1b1633;}
.detail-card{border:1px solid rgba(85,34,213,0.12);border-radius:20px;padding:24px;background:#f9f7ff;margin:24px 0;}
.detail{margin-bottom:16px;}
.detail:last-child{margin-bottom:0;}
.detail span{display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#726c90;margin-bottom:5px;}
.detail strong{font-size:17px;color:#221a46;}
.status-wrapper{margin-top:12px;}
.status-wrapper h4{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#7a739b;}
.status-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px;}
.status-item{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;border-radius:18px;border:1px solid #ece9fb;background:#fff;}
.status-item .dot{width:14px;height:14px;border-radius:50%;margin-top:4px;background:#d7d3f1;}
.status-item.done{border-color:#d9f4ea;background:#f3fbf7;}
.status-item.done .dot{background:#22c18d;}
.status-item.active{border-color:#d9e8ff;background:#eef4ff;}
.status-item.active .dot{background:#2d70f3;}
.status-item.upcoming{opacity:0.75;}
.status-item p{margin:0;font-weight:600;color:#1f1842;}
.status-item small{display:block;margin-top:4px;color:#5e5771;}
.extra-card{margin-top:24px;padding:20px 24px;border-radius:22px;background:#131126;color:#fff;line-height:1.7;}
.extra-card p{margin:0 0 12px;}
.extra-card p:last-child{margin-bottom:0;}
.btn{display:inline-block;margin-top:24px;padding:14px 28px;border-radius:999px;background:#1f183b;color:#fff;font-weight:600;text-decoration:none;}
.signature{margin-top:32px;font-size:13px;color:#5e5878;}
@media (max-width:520px){.hero,.content{padding:24px;} .btn{width:100%;text-align:center;}}
`;

function renderEmailTemplate({
  title,
  subtitle,
  greeting,
  highlights = [],
  statusSteps,
  extraContent,
  cta,
  footerNote,
}: EmailTemplateOptions) {
  const highlightHtml =
    highlights.length > 0
      ? `<div class="detail-card">
      ${highlights.map((detail) => `<div class="detail"><span>${detail.label}</span><strong>${detail.value}</strong></div>`).join('')}
    </div>`
      : '';

  const statusHtml = statusSteps
    .map(
      (step) => `<li class="status-item ${step.state}">
        <span class="dot"></span>
        <div>
          <p>${step.label}</p>
          ${step.description ? `<small>${step.description}</small>` : ''}
        </div>
      </li>`
    )
    .join('');

  const extraHtml = extraContent ? `<div class="extra-card">${extraContent}</div>` : '';
  const ctaHtml = cta ? `<a class="btn" href="${cta.href}" target="_blank" rel="noopener noreferrer">${cta.label}</a>` : '';
  const subtitleHtml = subtitle ? `<p>${subtitle}</p>` : '';

  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dermosul</title><style>${EMAIL_BASE_STYLES}</style></head>
  <body><div class="wrapper"><div class="card">
    <div class="hero">
      <h1>${title}</h1>
      ${subtitleHtml}
    </div>
    <div class="content">
      <p class="greeting">${greeting}</p>
      ${highlightHtml}
      <div class="status-wrapper">
        <h4>Linha do pedido</h4>
        <ul class="status-list">${statusHtml}</ul>
      </div>
      ${extraHtml}
      ${ctaHtml}
      <p class="signature">${footerNote || BRAND_SIGNATURE}</p>
    </div>
  </div></div></body></html>`;
}

export function renderPaymentApprovedEmail(opts: { name: string; orderId: string; item: string; total: number; installments?: number; link?: string }) {
  const parcelas = opts.installments && opts.installments > 1 ? `${opts.installments}x sem juros` : 'à vista';
  return renderEmailTemplate({
    title: 'Pagamento confirmado ✅',
    subtitle: `Seu pedido #${opts.orderId} está reservado com todo cuidado pela Dermosul.`,
    greeting: `Olá, <strong>${opts.name}</strong>! Recebemos o pagamento e já estamos preparando os seus itens premium.`,
    highlights: [
      { label: 'Pedido', value: `#${opts.orderId}` },
      { label: 'Produto', value: opts.item },
      { label: 'Valor pago', value: BRL(opts.total) },
      { label: 'Condição de pagamento', value: parcelas },
    ],
    statusSteps: [
      {
        label: 'Pedido recebido',
        description: 'Reserva confirmada e estoque separado.',
        state: 'done',
      },
      {
        label: 'Pagamento aprovado',
        description: 'Estamos embalando e validando a qualidade dos produtos.',
        state: 'active',
      },
      {
        label: 'Envio com rastreio',
        description: 'Você receberá o código assim que o pedido sair do centro logístico.',
        state: 'upcoming',
      },
    ],
    extraContent:
      '<p>Nosso time de fulfillment monitora cada etapa para garantir que chegue impecável. Assim que o pedido for despachado, enviaremos outro e-mail com rastreamento completo.</p><p>Precisando de ajuda, fale com nossa concierge digital pelos canais oficiais da Dermosul.</p>',
    cta: opts.link ? { label: 'Acompanhar meu pedido', href: opts.link } : undefined,
  });
}

export function renderPendingEmail(opts: { name: string; orderId: string; item: string; total: number; installments?: number; link?: string }) {
  const parcelas = opts.installments && opts.installments > 1 ? `${opts.installments}x sem juros` : 'à vista';
  return renderEmailTemplate({
    title: 'Pagamento pendente 🕐',
    subtitle: `Finalize o pagamento para liberar imediatamente o pedido #${opts.orderId}.`,
    greeting: `Olá, <strong>${opts.name}</strong>! Ainda estamos aguardando a confirmação do pagamento para seguir com a preparação.`,
    highlights: [
      { label: 'Pedido', value: `#${opts.orderId}` },
      { label: 'Produto', value: opts.item },
      { label: 'Valor a pagar', value: BRL(opts.total) },
      { label: 'Forma escolhida', value: parcelas },
    ],
    statusSteps: [
      {
        label: 'Pagamento pendente',
        description: 'Conclua o pagamento para reservar seu estoque exclusivo.',
        state: 'active',
      },
      {
        label: 'Pagamento aprovado',
        description: 'Assim que recebermos a confirmação, embalaremos imediatamente.',
        state: 'upcoming',
      },
      {
        label: 'Envio com rastreio',
        description: 'O código de rastreio é enviado após a coleta pela transportadora.',
        state: 'upcoming',
      },
    ],
    extraContent:
      '<p>Se você já pagou, basta aguardar alguns instantes para a compensação automática. Caso precise reenviar o comprovante ou alterar o método de pagamento, nossa equipe está pronta para ajudar.</p>',
    cta: opts.link ? { label: 'Ir para o pagamento', href: opts.link } : undefined,
  });
}

export function renderShippedEmail(opts: { name: string; orderId: string; tracking?: string; link?: string }) {
  return renderEmailTemplate({
    title: 'Seu pedido está a caminho 🚚',
    subtitle: `Preparação concluída! O pedido #${opts.orderId} saiu do centro logístico Dermosul.`,
    greeting: `Olá, <strong>${opts.name}</strong>! Nosso parceiro logístico já está transportando seus produtos.`,
    highlights: [
      { label: 'Pedido', value: `#${opts.orderId}` },
      { label: 'Status do envio', value: 'Em trânsito' },
      { label: 'Código de rastreio', value: opts.tracking || 'Será compartilhado em breve' },
    ],
    statusSteps: [
      {
        label: 'Pedido recebido',
        description: 'Itens separados e conferidos.',
        state: 'done',
      },
      {
        label: 'Pagamento aprovado',
        description: 'Pedido embalado com todo cuidado.',
        state: 'done',
      },
      {
        label: 'Enviado ao transportador',
        description: 'Acompanhe o trajeto em tempo real.',
        state: 'active',
      },
    ],
    extraContent: `<p>${opts.tracking ? `Use o código <strong>${opts.tracking}</strong> para acompanhar diretamente no site da transportadora.` : 'Assim que a transportadora registrar o volume, você receberá o código de rastreio automaticamente.'}</p><p>Lembre-se: qualquer dúvida sobre prazos ou alterações de entrega pode ser tratada com nossa concierge Dermosul.</p>`,
    cta: opts.link ? { label: 'Ver rastreamento atualizado', href: opts.link } : undefined,
  });
}
