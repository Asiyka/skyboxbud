/* ============================================================
   Обробка заявки з форми → повідомлення в Telegram.
   Спільна логіка для Vercel-функції (api/lead.js) і локального
   dev-сервера (vite.config.js).
   ============================================================ */

import { tg, leadMessage, keyboard } from "./_telegram.js";
import { validateLead } from "./_validate.js";

export { validateLead };

/** Повертає { status, body } — обгортки самі віддають це як HTTP-відповідь. */
export async function handleLead(body, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("[lead] TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задано");
    return { status: 500, body: { ok: false, error: "config" } };
  }

  const { lead, error } = validateLead(body);
  if (error) return { status: 400, body: { ok: false, error } };

  // Бот заповнив приховане поле — робимо вигляд, що все ок, але нікуди не шлемо.
  if (lead.website) return { status: 200, body: { ok: true } };

  try {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text: leadMessage(lead),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard("new"),
    });
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error("[lead] Telegram error:", e.message);
    return { status: 502, body: { ok: false, error: "telegram" } };
  }
}
