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

export function renderPaymentApprovedEmail(opts: { name: string; orderId: string; item: string; total: number; installments?: number; link?: string; }) {
  const parcelas = opts.installments && opts.installments > 1 ? `${opts.installments}x Sem juros` : 'à vista';
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Seu pedido na Dermosul</title>
  <style>body{margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#1e2130}.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}.hdr{background:#0F5B43;color:#fff;padding:20px 24px}.hdr h1{margin:0;font-size:20px}.content{padding:24px}.hello{font-size:16px;margin:0 0 12px}.box{background:#f5fbf8;border:1px solid #d7f4e7;border-radius:10px;padding:14px;margin:14px 0}.row{display:flex;justify-content:space-between;margin:6px 0}.label{color:#636a6d}.val{font-weight:bold}.bar{height:8px;background:#eaf5f1;border-radius:999px;overflow:hidden;margin:12px 0 4px}.bar>span{display:block;height:100%;width:66%;background:linear-gradient(90deg,#0F5B43,#1FAF7A)}.foot{font-size:12px;color:#6b7174;margin-top:14px}.btn{display:inline-block;background:#0F5B43;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold}</style></head>
  <body><div class="wrap"><div class="hdr"><h1>Pagamento aprovado ✅</h1></div><div class="content">
  <p class="hello">Olá, <strong>${opts.name}</strong>!</p>
  <p>Recebemos o pagamento do seu pedido <strong>#${opts.orderId}</strong>. Obrigado por comprar na Dermosul 💚</p>
  <div class="box"><div class="row"><span class="label">Produto:</span><span class="val">${opts.item}</span></div>
  <div class="row"><span class="label">Valor:</span><span class="val">${BRL(opts.total)}</span></div>
  <div class="row"><span class="label">Pagamento:</span><span class="val">${parcelas}</span></div></div>
  <p>Status do pedido:</p><div class="bar"><span></span></div>
  <small>1) Pedido recebido • <strong>2) Pagamento aprovado</strong> • 3) Enviado</small>
  <p style="margin-top:16px">Assim que seu pedido for <strong>enviado</strong>, você receberá outro e-mail com as informações de rastreio.</p>
  ${opts.link ? `<p><a class="btn" href="${opts.link}" target="_blank">Acompanhar meu pedido</a></p>` : ''}
  <p class="foot">Equipe Dermosul • CNPJ 60.426.816/0001-03</p>
  </div></div></body></html>`;
}

export function renderPendingEmail(opts: { name: string; orderId: string; item: string; total: number; installments?: number; link?: string; }) {
  const parcelas = opts.installments && opts.installments > 1 ? `${opts.installments}x Sem juros` : 'à vista';
  return `<!doctype html><html lang=\"pt-br\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Estamos preparando seu pedido</title>
  <style>body{margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#1e2130}.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}.hdr{background:#0F5B43;color:#fff;padding:20px 24px}.hdr h1{margin:0;font-size:20px}.content{padding:24px}.hello{font-size:16px;margin:0 0 12px}.box{background:#f5fbf8;border:1px solid #d7f4e7;border-radius:10px;padding:14px;margin:14px 0}.row{display:flex;justify-content:space-between;margin:6px 0}.label{color:#636a6d}.val{font-weight:bold}.bar{height:8px;background:#eaf5f1;border-radius:999px;overflow:hidden;margin:12px 0 4px}.bar>span{display:block;height:100%;width:66%;background:linear-gradient(90deg,#0F5B43,#1FAF7A)}.foot{font-size:12px;color:#6b7174;margin-top:14px}.btn{display:inline-block;background:#0F5B43;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold}</style></head>
  <body><div class=\"wrap\"><div class=\"hdr\"><h1>Estamos preparando seu pedido</h1></div><div class=\"content\">
  <p class=\"hello\">Olá, <strong>${opts.name}</strong>! Seu pedido <strong>#${opts.orderId}</strong> entrou em preparação.</p>
  <div class=\"box\"><div class=\"row\"><span class=\"label\">Produto:</span><span class=\"val\">${opts.item}</span></div>
  <div class=\"row\"><span class=\"label\">Valor:</span><span class=\"val\">${BRL(opts.total)}</span></div>
  <div class=\"row\"><span class=\"label\">Pagamento:</span><span class=\"val\">${parcelas}</span></div></div>
  <p>Status do pedido:</p><div class=\"bar\"><span></span></div>
  <small>1) Pedido recebido • <strong>2) Pagamento aprovado</strong> • 3) Enviado</small>
  ${opts.link ? `<p style=\"margin-top:16px\"><a class=\"btn\" href=\"${opts.link}\" target=\"_blank\">Acompanhar meu pedido</a></p>` : ''}
  <p class=\"foot\">Equipe Dermosul • CNPJ 60.426.816/0001-03</p>
  </div></div></body></html>`;
}

export function renderShippedEmail(opts: { name: string; orderId: string; tracking?: string; link?: string; }) {
  return `<!doctype html><html lang=\"pt-br\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Pedido enviado</title>
  <style>body{margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#1e2130}.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}.hdr{background:#0F5B43;color:#fff;padding:20px 24px}.hdr h1{margin:0;font-size:20px}.content{padding:24px}.bar{height:8px;background:#eaf5f1;border-radius:999px;overflow:hidden;margin:12px 0 4px}.bar>span{display:block;height:100%;width:90%;background:linear-gradient(90deg,#0F5B43,#1FAF7A)}</style></head>
  <body><div class=\"wrap\"><div class=\"hdr\"><h1>Pedido enviado 🚚</h1></div><div class=\"content\">
  <p>Olá, <strong>${opts.name}</strong>! Seu pedido <strong>#${opts.orderId}</strong> foi enviado.</p>
  <div class=\"bar\"><span></span></div>
  <small>1) Pedido recebido • 2) Pagamento aprovado • <strong>3) Enviado</strong></small>
  ${opts.tracking?`<p style=\"margin-top:12px\">Código de rastreio: <strong>${opts.tracking}</strong></p>`:''}
  ${opts.link?`<p><a href=\"${opts.link}\" style=\"color:#0F5B43\">Acompanhar</a></p>`:''}
  </div></div></body></html>`;
}
