/* Підключити кнопки статусів на робочому сайті (один раз після деплою):
     npm run tg:webhook -- https://ваш-сайт.vercel.app
   Перевірити поточний стан:   npm run tg:webhook -- info
   Відключити вручну (зазвичай не треба — npm run tg:local робить це сам):   npm run tg:webhook -- delete

   Бере TELEGRAM_BOT_TOKEN і TELEGRAM_WEBHOOK_SECRET з .env.local —
   той самий секрет має бути заданий у Vercel → Environment Variables. */
import { tg } from "../api/_telegram.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = process.env;
const arg = process.argv[2];

if (!token) {
  console.error("✗ Немає TELEGRAM_BOT_TOKEN у .env.local");
  process.exit(1);
}

if (!arg || arg === "info") {
  console.log(await tg(token, "getWebhookInfo", {}));
} else if (arg === "delete") {
  await tg(token, "deleteWebhook", {});
  console.log("✓ Вебхук відключено");
} else {
  if (!secret) {
    console.error("✗ Немає TELEGRAM_WEBHOOK_SECRET у .env.local");
    process.exit(1);
  }
  const url = new URL("/api/telegram", arg).toString();
  await tg(token, "setWebhook", { url, secret_token: secret, allowed_updates: ["callback_query", "channel_post"], drop_pending_updates: true });
  console.log(`✓ Вебхук підключено: ${url}`);
}
