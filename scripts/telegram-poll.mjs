/* Локальна розробка бота: npm run tg:local
   1. Якщо підключений вебхук продакшну — тимчасово вимикає його (щоб натискання йшли сюди, а не на прод).
   2. Сам опитує Telegram і обробляє кнопки й нотатки тією ж логікою, що й вебхук (api/telegram.js),
      а кожні 30 с перевіряє нагадування — як /api/cron на сайті.
   3. На Ctrl+C повертає вебхук продакшну назад.
   Поки скрипт працює, кнопки на продакшні обробляє ваш компʼютер. */
import { tg, handleUpdate, runReminders } from "../api/_telegram.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

// TG_DEV: показувати тестову кнопку «⚡ 1 хв» у виборі часу нагадування
const env = { ...process.env, TG_DEV: "1" };
const token = env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("✗ Немає TELEGRAM_BOT_TOKEN у .env.local");
  process.exit(1);
}

const ALLOWED = ["callback_query", "channel_post"];
const hook = await tg(token, "getWebhookInfo", {});
// Куди повертати вебхук на виході: поточний, а якщо він уже вимкнений (минулий запуск обірвався) —
// адреса продакшну з аргументу (npm run tg:local передає її сам).
const prodUrl = hook.url || (process.argv[2] ? new URL("/api/telegram", process.argv[2]).toString() : "");
if (hook.url) {
  await tg(token, "deleteWebhook", {});
  console.log(`⏸  Вебхук продакшну тимчасово вимкнено (${prodUrl}). Ctrl+C — увімкнути назад.`);
}

let restoring = false;
async function restore() {
  if (restoring) return;
  restoring = true;
  if (prodUrl) {
    try {
      await tg(token, "setWebhook", { url: prodUrl, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ALLOWED });
      console.log(`\n▶  Вебхук продакшну повернуто: ${prodUrl}`);
    } catch (e) {
      console.error(`\n✗ Не вдалося повернути вебхук: ${e.message}\n   Виконайте вручну: npm run tg:prod`);
    }
  }
  process.exit(0);
}
process.on("SIGINT", restore);
process.on("SIGTERM", restore);

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
    const updates = await tg(token, "getUpdates", { offset, timeout: 30, allowed_updates: ALLOWED });
    for (const u of updates) {
      offset = u.update_id + 1;
      if (u.callback_query) console.log(`→ ${u.callback_query.from.first_name}: ${u.callback_query.data}`);
      if (u.channel_post) console.log(`→ пост у каналі: ${(u.channel_post.text || "").slice(0, 40)}`);
      await handleUpdate(u, env);
    }
  } catch (e) {
    if (restoring) break;
    console.error("Помилка:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
