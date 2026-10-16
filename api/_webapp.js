/* Перевірка підпису Telegram Mini App (initData).
   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   Без цього будь-хто міг би надіслати запит від імені адміна. */
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE = 24 * 60 * 60; // initData дійсні добу

export function checkInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  if (Date.now() / 1000 - Number(params.get("auth_date") || 0) > MAX_AGE) return null;
  try {
    return { user: JSON.parse(params.get("user") || "null"), startParam: params.get("start_param") || "" };
  } catch {
    return null;
  }
}
