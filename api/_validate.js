/* Перевірка полів заявки. Без залежностей — її імпортує і сервер (_lead-core.js), і форма на сайті. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export function validateLead(body) {
  const lead = {
    name: clean(body?.name, 100),
    phone: clean(body?.phone, 40),
    email: clean(body?.email, 120),
    note: clean(body?.note, 2000),
    website: clean(body?.website, 200), // honeypot: люди це поле не бачать і не заповнюють
  };
  const phoneOk = lead.phone.replace(/\D/g, "").length >= 9;
  const emailOk = EMAIL_RE.test(lead.email);

  if (!lead.name) return { error: "name" };
  if (!phoneOk && !emailOk) return { error: "contact" };
  if (lead.phone && !phoneOk) return { error: "phone" };
  if (lead.email && !emailOk) return { error: "email" };
  return { lead };
}
