/* Vercel Serverless Function: POST /api/telegram — вебхук для натискань кнопок під заявками.
   Підключається один раз після деплою: npm run tg:webhook -- https://ваш-сайт.vercel.app */
import { handleUpdate } from "./_telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Telegram підписує кожен запит секретом, який ми передали в setWebhook.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers["x-telegram-bot-api-secret-token"] !== secret) return res.status(401).end();

  try {
    await handleUpdate(req.body, process.env);
  } catch (e) {
    console.error("[tg] update failed:", e);
  }
  // Завжди 200 — інакше Telegram повторюватиме той самий апдейт.
  res.status(200).json({ ok: true });
}
