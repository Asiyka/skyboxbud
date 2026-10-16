/* Vercel Serverless Function: POST /api/lead — заявка з форми → Telegram. */
import { handleLead } from "./_lead-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method" });
  }
  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const { status, body: out } = await handleLead(body, process.env);
  res.status(status).json(out);
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
