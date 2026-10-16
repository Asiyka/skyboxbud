/* Локальна перевірка бота без деплою: npm run tg:poll
   Telegram не може достукатися до localhost, тому скрипт сам опитує його й обробляє
   кнопки та нотатки тією ж логікою, що й вебхук на Vercel (api/telegram.js),
   а кожні 30 с перевіряє нагадування — як /api/cron на сайті.
   Працює лише поки вебхук не підключений (npm run tg:webhook -- delete). Ctrl+C — зупинити. */
import { tg, handleUpdate, runReminders } from "../api/_telegram.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

// TG_DEV: показувати тестову кнопку «⚡ 1 хв» у виборі часу нагадування
const env = { ...process.env, TG_DEV: "1" };
if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("✗ Немає TELEGRAM_BOT_TOKEN у .env.local");
  process.exit(1);
}

const hook = await tg(env.TELEGRAM_BOT_TOKEN, "getWebhookInfo", {});
if (hook.url) {
  console.error(`✗ Підключено вебхук (${hook.url}) — натискання йдуть туди. Для локальних тестів: npm run tg:webhook -- delete`);
  process.exit(1);
}

setInterval(async () => {
  try {
    const r = await runReminders(env);
    if (r.sent) console.log(`🔔 надіслано нагадувань: ${r.sent}`);
  } catch (e) {
    console.error("Нагадування:", e.message);
  }
}, 30 * 1000);

console.log("Слухаю кнопки й нотатки, перевіряю нагадування… (Ctrl+C — зупинити)");
let offset = 0;
for (;;) {
  try {
    const updates = await tg(env.TELEGRAM_BOT_TOKEN, "getUpdates", { offset, timeout: 30, allowed_updates: ["callback_query", "channel_post"] });
    for (const u of updates) {
      offset = u.update_id + 1;
      if (u.callback_query) console.log(`→ ${u.callback_query.from.first_name}: ${u.callback_query.data}`);
      if (u.channel_post) console.log(`→ пост у каналі: ${(u.channel_post.text || "").slice(0, 40)}`);
      await handleUpdate(u, env);
    }
  } catch (e) {
    console.error("Помилка:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
