// ==========================================================================
// LISTA DE PRESENTES - RHEBECA & MATHEUS
// Versão: v.1.7.0
// Edge Function: notifica os noivos por e-mail (Gmail SMTP) a cada presente
// ou cota recebida. Disparada pelo trigger public.notify_gift_event.
// Secrets necessários: GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO, NOTIFY_SECRET
// ==========================================================================
import nodemailer from 'npm:nodemailer@6.9.16';

const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? '';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';
const NOTIFY_TO = Deno.env.get('NOTIFY_TO') ?? '';
const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? '';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const brl = (n: unknown) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateBR = (iso?: string) =>
  new Date(iso || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function row(label: string, value: string) {
  return value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#606C38;font-weight:600;vertical-align:top">${label}</td><td style="padding:6px 0;color:#283618">${value}</td></tr>`
    : '';
}

Deno.serve(async (req) => {
  if (!NOTIFY_SECRET || req.headers.get('x-notify-secret') !== NOTIFY_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { kind, gift, contribution } = await req.json();
  const isCota = kind === 'cota';

  const guest = isCota ? contribution?.guestName : gift?.reserved_by;
  const message = isCota ? contribution?.message : gift?.guest_message;
  const phone = isCota ? contribution?.phone : gift?.guest_phone;
  const when = isCota ? contribution?.date : gift?.reserved_at;
  const value = isCota
    ? `${brl(contribution?.amount)} (${contribution?.quotaCount} cota${contribution?.quotaCount > 1 ? 's' : ''})`
    : brl(gift?.price);

  const subject = isCota
    ? `Nova cota recebida: ${gift?.title} — ${guest || 'Convidado'}`
    : `Novo presente reservado: ${gift?.title} — ${guest || 'Convidado'}`;

  const html = `
  <div style="background:#FAFAF8;padding:24px;font-family:Inter,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E8ECE0;border-radius:12px;padding:24px">
      <h2 style="font-family:'Playfair Display',Georgia,serif;color:#283618;margin:0 0 4px">Rhebeca &amp; Matheus</h2>
      <p style="color:#606C38;margin:0 0 20px">${isCota ? 'Uma nova cota foi contribuída' : 'Um novo presente foi reservado'} na lista de casamento.</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row('Presente', esc(gift?.title))}
        ${row('Convidado', esc(guest))}
        ${row('Valor', esc(value))}
        ${row('Telefone', esc(phone))}
        ${row('Mensagem', esc(message))}
        ${row('Data', esc(dateBR(when)))}
      </table>
      ${isCota ? '' : '<p style="color:#283618;font-size:13px;margin-top:20px">A reserva aguarda aprovação no painel administrativo.</p>'}
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"Lista Rhebeca & Matheus" <${GMAIL_USER}>`,
      to: NOTIFY_TO,
      subject,
      html,
    });
    return new Response('ok');
  } catch (err) {
    console.error('[notify-gift] Falha ao enviar e-mail:', err);
    return new Response('send failed', { status: 500 });
  }
});
