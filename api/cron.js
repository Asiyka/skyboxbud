/* Vercel Serverless Function: GET /api/cron?key=СЕКРЕТ — надіслати нагадування, час яких настав.
   Викликається зовнішнім «будильником» кожні 5 хвилин (див. README → «Нагадування»). */
import { runReminders } from "./_telegram.js";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = req.query?.key || (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!secret || given !== secret) return res.status(401).json({ ok: false });

  try {
    res.status(200).json({ ok: true, ...(await runReminders(process.env)) });
  } catch (e) {
    console.error("[cron] failed:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
