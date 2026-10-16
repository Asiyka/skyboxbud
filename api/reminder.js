/* Vercel Serverless Function: POST /api/reminder — міні-застосунок «Дата й час» ставить нагадування.
   Тіло: { initData, y, m, d, h, mi } — дата й час за Києвом. */
import { checkInitData } from "./_webapp.js";
import { setReminderFromApp } from "./_telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const env = process.env;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  const auth = checkInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  if (!auth?.user) return res.status(401).json({ ok: false, error: "Відкрийте застосунок із Telegram ще раз" });

  const leadId = Number(auth.startParam.split("_")[0]);
  if (!leadId) return res.status(400).json({ ok: false, error: "Не знайшла заявку — відкрийте з кнопки під нею" });

  try {
    const r = await setReminderFromApp(env, leadId, body, auth.user);
    res.status(r.ok ? 200 : 400).json(r);
  } catch (e) {
    console.error("[reminder] failed:", e);
    res.status(500).json({ ok: false, error: "Не вдалося поставити нагадування" });
  }
}
