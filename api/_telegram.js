/* ============================================================
   Telegram-бот заявок: формат повідомлення, кнопки статусів, нотатки, нагадування
   (день і час обирають у міні-застосунку public/tg-remind.html).
   Без бази даних: стан заявки живе в самому повідомленні, а список
   нагадувань — у закріпленому повідомленні каналу.
   Файли з "_" Vercel не робить ендпоінтами.

   Змінні середовища:
     TELEGRAM_BOT_TOKEN      — токен бота від @BotFather
     TELEGRAM_CHAT_ID        — id закритого каналу, куди бот пише заявки
     TELEGRAM_WEBHOOK_SECRET — секрет для вебхука Telegram і для /api/cron
   ============================================================ */

import { MIN, HOUR, kyiv, kyivAt, fmtAt, fmtWhen, fmtShort, parseShort } from "./_time.js";

export const GROUPS = {
  open: { tag: "відкрита", dot: "🟠" },
  work: { tag: "вроботі", dot: "🔵" },
  closed: { tag: "закрита", dot: "⚪️" },
};

export const STATUSES = {
  new: { emoji: "🆕", title: "Нова заявка", label: "Нова", tag: "нова", group: "open" },
  noanswer: { emoji: "📵", title: "Не взяли трубку", label: "Не взяли трубку", tag: "недодзвонились", group: "open" },
  later: { emoji: "⏰", title: "Передзвонити пізніше", label: "Пізніше", tag: "пізніше", group: "open" },
  called: { emoji: "✅", title: "Передзвонили", label: "Передзвонили", tag: "передзвонили", group: "work" },
  deal: { emoji: "🤝", title: "Оформили замовлення", label: "Замовлення", tag: "замовлення", group: "closed" },
  declined: { emoji: "❌", title: "Відмова", label: "Відмова", tag: "відмова", group: "closed" },
};

/* «⏰ Нагадати» — кнопка типу url з t.me-посиланням на міні-застосунок.
   web_app не працює в каналах; url-кнопка працює, але Telegram щоразу просить
   підтвердження переходу на зовнішній сайт. */
const LAYOUT = [
  ["called", "noanswer"],
  ["deal", "declined"],
];

/* Маркери — за ними бот розпізнає свої повідомлення. */
const STATUS_MARK = "📌 ";
const NOTES_MARK = "💬 ";
const APP_MARK = "⏰ Нагадати: ";
const NOTE_PROMPT = "✍️ ";
const BOARD_MARK = "📋 ";
const HISTORY_MAX = 8;
const BOARD_MAX = 100; // скільки нагадувань вміщає закріплене повідомлення (ліміт Telegram — 4096 символів)
const TG_LIMIT = 4000;
const PROMPT_TTL = 15 * 60; // сек: запит бота «протухає» через 15 хв
const THANKS_DELAY = 2500; // мс: скільки висить «Дякую» перед прибиранням

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? `@${u.username}` : "Адмін");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => kyiv(Date.now(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* ---------- Bot API ---------- */

export async function tg(token, method, params) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(params),
  });
  const data = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!data.ok) throw Object.assign(new Error(data.description || "Telegram error"), { tg: data });
  return data.result;
}

const quiet = (p) => p.catch(() => null);
const call = (env, method, params) => tg(env.TELEGRAM_BOT_TOKEN, method, params);
const del = (env, chat, id) => quiet(call(env, "deleteMessage", { chat_id: chat, message_id: id }));

/** Посилання на повідомлення в приватному каналі (працює для його учасників). */
const msgLink = (chat, msg) => `https://t.me/c/${String(chat).replace(/^-100/, "")}/${msg}`;
const LINK_RE = /\/c\/\d+\/(\d+)$/;

/* Bot API не вміє «прочитати повідомлення за id». Обхід: відповісти на нього —
   у відповіді Telegram повертає оригінал (текст, форматування). */
async function readMessage(env, chat, id, text = "⏳") {
  const probe = await quiet(
    call(env, "sendMessage", {
      chat_id: chat,
      text,
      disable_notification: true,
      reply_parameters: { message_id: id, allow_sending_without_reply: false },
    })
  );
  return probe ? { probe, original: probe.reply_to_message } : null;
}

/* ---------- клавіатури ---------- */

let botUser = null;
async function botUsername(env) {
  if (env.TELEGRAM_BOT_USERNAME) return env.TELEGRAM_BOT_USERNAME;
  if (!botUser) botUser = (await call(env, "getMe", {})).username;
  return botUser;
}

/* «⏰ Нагадати» відкриває міні-застосунок «Дата й час» (public/tg-remind.html).
   start_param дозволяє лише [A-Za-z0-9_-]: id заявки + імʼя клієнта в base64url (для заголовка). */
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const startParam = (leadId, client) => `${leadId}_${b64url(client.slice(0, 40))}`.slice(0, 500);

async function miniAppUrl(env, leadId, client) {
  const param = startParam(leadId, client);
  const bot = await botUsername(env);
  return env.TELEGRAM_APP_NAME
    ? `t.me/${bot}/${env.TELEGRAM_APP_NAME}?startapp=${param}`
    : `t.me/${bot}?startapp=${param}`;
}

/** Кнопки під заявкою. appUrl — якщо є, додає url-кнопку «⏰ Нагадати». */
export function leadKeyboard(current, appUrl) {
  const rows = LAYOUT.map((row) =>
    row.map((key) => {
      const s = STATUSES[key];
      return { text: `${key === current ? "✔︎ " : ""}${s.emoji} ${s.label}`, callback_data: `st:${key}` };
    })
  );
  if (appUrl) rows.push([{ text: "⏰ Нагадати", url: `https://${appUrl}` }]);
  rows.push([{ text: "📝 Нотатка", callback_data: "nt" }]);
  return { inline_keyboard: rows };
}

const cancelKeyboard = { inline_keyboard: [[{ text: "✖️ Скасувати", callback_data: "nc" }]] };

/* ---------- повідомлення заявки: модель ⇄ HTML ---------- */

const header = (key) => `${STATUSES[key].emoji} <b>${STATUSES[key].title}</b>`;

/* Модель: { status, body: [html-блоки], notes: [рядки], history: [рядки], remind: "30.10 о 10:00" | null } */
function render(m) {
  const s = STATUSES[m.status];
  const notes = [...m.notes];
  const history = m.history.slice(-HISTORY_MAX);
  const build = () => {
    const blocks = [header(m.status), ...m.body];
    if (notes.length) blocks.push(`${NOTES_MARK}<b>Нотатки:</b>\n${notes.join("\n")}`);
    const tags = [`#${s.tag}`, `#${GROUPS[s.group].tag}`, notes.length && "#нотатки"].filter(Boolean).join(" ");
    const remind = m.status === "later" && m.remind ? ` · 🔔 ${m.remind}` : "";
    const st = [`${STATUS_MARK}<b>Статус:</b> ${s.emoji} ${s.label}${remind}`, tags];
    if (m.app) st.push(`${APP_MARK}${m.app}`);
    if (history.length) st.push("<i>Історія:</i>", ...history);
    blocks.push(st.join("\n"));
    return blocks.join("\n\n");
  };
  let text = build();
  // Ліміт Telegram — 4096 символів: спершу скорочуємо історію, потім найстаріші нотатки.
  while (text.length > TG_LIMIT && (history.length > 1 || notes.length > 1)) {
    if (history.length > 1) history.shift();
    else notes.shift();
    text = build();
  }
  return text;
}

/* Telegram віддає повідомлення як plain text + entities (зсуви в UTF-16 — як у JS-рядках).
   Відновлюємо HTML лише для того, що ставимо самі; телефони, email і хештеги Telegram розпізнає сам. */
const TAGS = { bold: "b", italic: "i", code: "code" };
function toHtml(text, entities = []) {
  const ents = entities.filter((e) => TAGS[e.type] || e.type === "text_link").sort((a, b) => a.offset - b.offset);
  let out = "";
  let pos = 0;
  for (const e of ents) {
    if (e.offset < pos) continue;
    out += esc(text.slice(pos, e.offset));
    const inner = esc(text.slice(e.offset, e.offset + e.length));
    out += e.type === "text_link" ? `<a href="${esc(e.url)}">${inner}</a>` : `<${TAGS[e.type]}>${inner}</${TAGS[e.type]}>`;
    pos = e.offset + e.length;
  }
  return out + esc(text.slice(pos));
}

const isLead = (message) => !!message?.text?.includes(`\n\n${STATUS_MARK}`);

function parse(message) {
  const blocks = toHtml(message.text || "", message.entities).split("\n\n");
  const m = { status: "new", body: [], notes: [], history: [], remind: null };
  for (const b of blocks.slice(1)) {
    if (b.startsWith(STATUS_MARK)) {
      const lines = b.split("\n");
      const tags = (lines[1] || "").split(" ");
      m.status = Object.keys(STATUSES).find((k) => tags.includes(`#${STATUSES[k].tag}`)) || "new";
      m.remind = lines[0].split(" · 🔔 ")[1] || null;
      m.app = (lines.find((l) => l.startsWith(APP_MARK)) || "").slice(APP_MARK.length) || null;
      m.history = lines.filter((l) => l.startsWith("• "));
    } else if (b.startsWith(NOTES_MARK)) {
      m.notes = b.split("\n").slice(1);
    } else {
      m.body.push(b);
    }
  }
  return m;
}

/** Імʼя клієнта з тексту заявки (для запитів і списку нагадувань), plain text. */
const clientName = (m) => {
  const html = (m.body[0] || "").match(/Ім'я:<\/b> ([^\n]+)/)?.[1] || "клієнт";
  return html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
};

/** Текст нової заявки (HTML). */
export function leadMessage(lead) {
  // Користувацький текст не повинен виглядати як наші службові маркери.
  const safe = (s) => esc(s).replace(/📌|💬|✍️|⏱|📋/g, "•");
  const contacts = [
    `👤 <b>Ім'я:</b> ${safe(lead.name)}`,
    lead.phone && `📞 <b>Телефон:</b> ${safe(lead.phone)}`,
    lead.email && `✉️ <b>Email:</b> ${safe(lead.email)}`,
  ].filter(Boolean);
  const body = [
    contacts.join("\n"),
    lead.note && `📝 <b>Що потрібно:</b>\n${safe(lead.note).replace(/\n{2,}/g, "\n")}`,
    `🕒 ${kyiv(Date.now(), { dateStyle: "short", timeStyle: "short" })}`,
  ].filter(Boolean);
  return render({ status: "new", body, notes: [], history: [], remind: null });
}

async function editLead(env, chat, id, m) {
  const appUrl = await miniAppUrl(env, id, clientName(m));
  m.app = null; // посилання в кнопці, в тексті більше не потрібне
  return call(env, "editMessageText", {
    chat_id: chat,
    message_id: id,
    text: render(m),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: leadKeyboard(m.status, appUrl),
  });
}

/** Після надсилання нової заявки: дописати посилання на застосунок (воно містить id повідомлення). */
export async function finishLead(env, sent) {
  await editLead(env, sent.chat.id, sent.message_id, parse(sent));
}

/* ---------- закріплене повідомлення: фільтри + список нагадувань ---------- */

export function boardText(chat, entries = []) {
  const t = (k) => `#${STATUSES[k].tag}`;
  const g = (k) => `${GROUPS[k].dot} #${GROUPS[k].tag}`;
  const list = [...entries]
    .sort((a, b) => a.at - b.at)
    .slice(0, BOARD_MAX)
    .map((e) => `• <a href="${msgLink(chat, e.id)}">${fmtShort(e.at)} · ${esc(e.name)}</a>`);
  return [
    `${BOARD_MARK}<b>Швидкі фільтри заявок</b>`,
    "Тапніть на хештег — Telegram покаже всі заявки з ним.",
    [
      `${g("open")} — потребують дзвінка`,
      `      ${t("new")} · ${t("noanswer")} · ${t("later")}`,
      `${g("work")} — ${t("called")}`,
      `${g("closed")} — ${t("deal")} · ${t("declined")}`,
      `💬 #нотатки — заявки з нотатками`,
    ].join("\n"),
    `⏰ <b>Найближчі нагадування</b>\n${list.length ? list.join("\n") : "<i>немає</i>"}`,
    [
      "<b>Як працювати із заявкою</b>",
      "• Статус — кнопки під заявкою",
      "• «⏰ Нагадати» — посилання в заявці: обрати день і час (або «Пізніше» без нагадування)",
      "• «📝 Нотатка» — бот попросить написати текст і додасть його в заявку",
    ].join("\n"),
  ].join("\n\n");
}

function parseBoard(message) {
  const text = message.text || "";
  return (message.entities || [])
    .filter((e) => e.type === "text_link" && LINK_RE.test(e.url))
    .map((e) => {
      const label = text.slice(e.offset, e.offset + e.length);
      const at = parseShort(label.slice(0, 11));
      return at && { id: +e.url.match(LINK_RE)[1], at, name: label.slice(14) };
    })
    .filter(Boolean);
}

/** Закріплене повідомлення бота; якщо його немає — публікує й закріплює нове. */
async function getBoard(env, chat) {
  const info = await call(env, "getChat", { chat_id: chat });
  const p = info.pinned_message;
  if (p?.text?.startsWith(BOARD_MARK)) return { id: p.message_id, entries: parseBoard(p) };
  const sent = await call(env, "sendMessage", { chat_id: chat, text: boardText(chat), parse_mode: "HTML", disable_web_page_preview: true });
  await call(env, "pinChatMessage", { chat_id: chat, message_id: sent.message_id, disable_notification: true });
  return { id: sent.message_id, entries: [] };
}

async function updateBoard(env, chat, change) {
  const board = await getBoard(env, chat);
  const entries = change(board.entries);
  await call(env, "editMessageText", {
    chat_id: chat,
    message_id: board.id,
    text: boardText(chat, entries),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }).catch((e) => {
    if (!/not modified/.test(e.message)) throw e;
  });
}

const setReminder = (env, chat, id, at, name) =>
  updateBoard(env, chat, (list) => {
    const rest = list.filter((e) => e.id !== id);
    if (at && rest.length >= BOARD_MAX) throw new Error("board-full");
    return [...rest, ...(at ? [{ id, at, name }] : [])];
  });

/** Викликається з /api/cron (і з npm run tg:local): надсилає нагадування, час яких настав. */
export async function runReminders(env, chat = env.TELEGRAM_CHAT_ID) {
  const board = await getBoard(env, chat);
  const due = board.entries.filter((e) => e.at <= Date.now() + 30 * 1000);
  if (!due.length) return { sent: 0, pending: board.entries.length };
  for (const e of due) {
    const sent = await quiet(
      call(env, "sendMessage", {
        chat_id: chat,
        text: `🔔 <b>Нагадування: передзвонити</b> — ${esc(e.name)}\n<i>Тапніть на цитату, щоб відкрити заявку.</i>`,
        parse_mode: "HTML",
        reply_parameters: { message_id: e.id, allow_sending_without_reply: true },
      })
    );
    // Відповідь повертає саму заявку — знімаємо з неї «🔔 …», щоб не висіло вже минуле нагадування.
    const lead = sent?.reply_to_message;
    if (isLead(lead)) {
      const m = parse(lead);
      if (m.remind) {
        m.history.push(`• ${stamp()} · 🔔 нагадування надіслано (${m.remind})`);
        m.remind = null;
        await quiet(editLead(env, chat, e.id, m));
      }
    }
  }
  const ids = new Set(due.map((e) => e.id));
  await updateBoard(env, chat, (list) => list.filter((e) => !ids.has(e.id)));
  return { sent: due.length, pending: board.entries.length - due.length };
}

/* ---------- обробка апдейтів ---------- */

export async function handleUpdate(update, env) {
  if (update?.callback_query) return onButton(update.callback_query, env);
  if (update?.channel_post) return onChannelPost(update.channel_post, env);
}

async function isAdmin(env, chat, userId) {
  try {
    const m = await call(env, "getChatMember", { chat_id: chat, user_id: userId });
    return ["creator", "administrator"].includes(m.status);
  } catch {
    return false;
  }
}

/** Змінити статус заявки. remindAt: мітка часу нагадування (лише для «пізніше»). */
async function applyStatus(env, chat, id, m, status, remindAt, who) {
  const s = STATUSES[status];
  const wasLater = m.status === "later";
  // У заявці — абсолютна дата: «завтра о 10:00» назавтра (напр. після нової нотатки) вже бреше.
  const at = remindAt ? fmtAt(remindAt) : null;
  m.status = status;
  m.remind = at;
  m.history.push(`• ${stamp()} · ${esc(who)} — ${s.emoji} ${s.label}${at ? ` (нагадати ${at})` : ""}`);
  await editLead(env, chat, id, m);
  if (remindAt || wasLater) await setReminder(env, chat, id, remindAt, clientName(m));
  return remindAt ? `🔔 Нагадаю ${fmtWhen(remindAt)}` : `${s.emoji} ${s.label}`;
}

/** Запит у каналі «напишіть нотатку…» — наступне повідомлення адміна бот забере собі. */
function askNote(env, chat, leadId, who, client) {
  const lead = `<a href="${msgLink(chat, leadId)}">${esc(client)}</a>`;
  return call(env, "sendMessage", {
    chat_id: chat,
    text: `${NOTE_PROMPT}<b>${esc(who)}</b>, напишіть нотатку до заявки ${lead} наступним повідомленням.`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_parameters: { message_id: leadId, allow_sending_without_reply: true },
    reply_markup: cancelKeyboard,
  });
}

async function onButton(cq, env) {
  const answer = (text) => quiet(call(env, "answerCallbackQuery", { callback_query_id: cq.id, text }));
  const msg = cq.message;
  if (!msg || !cq.data) return answer();
  const chat = msg.chat.id;
  const id = msg.message_id;
  const who = fullName(cq.from);

  if (!(await isAdmin(env, chat, cq.from.id))) return answer("Працювати із заявками можуть лише адміністратори каналу");

  if (cq.data === "nc") {
    await del(env, chat, id);
    return answer("Скасовано");
  }

  const m = parse(msg);
  try {
    if (cq.data === "nt") {
      await askNote(env, chat, id, who, clientName(m));
      return answer("Напишіть нотатку в канал");
    }
    // Старі кнопки (до оновлення) і заявка, якій ще не встигли поставити посилання на застосунок
    if (cq.data === "st:later" || cq.data === "bk" || cq.data === "lc" || cq.data.startsWith("lt:")) {
      await editLead(env, chat, id, m);
      return answer("Тапніть посилання «⏰ Нагадати» в заявці — відкриється вибір дати й часу");
    }
    const status = cq.data.startsWith("st:") ? cq.data.slice(3) : null;
    if (!STATUSES[status]) return answer();
    return answer(await applyStatus(env, chat, id, m, status, null, who));
  } catch (e) {
    console.error("[tg] button failed:", e.message);
    return answer(/pin|rights|admin/i.test(e.message) ? "Дайте боту право закріплювати повідомлення" : "Не вдалося оновити заявку");
  }
}

/** Виклик із міні-застосунку: { y, m, d, h, mi } за Києвом → статус «пізніше» з нагадуванням. */
export async function setReminderFromApp(env, leadId, t, user, chat = env.TELEGRAM_CHAT_ID) {
  if (!(await isAdmin(env, chat, user.id))) return { ok: false, error: "Ставити нагадування можуть лише адміністратори каналу" };

  // «Без нагадування» — просто статус «Пізніше».
  // Службову відповідь (нею читаємо заявку) прибираємо одразу: підтвердження показує сам застосунок,
  // а не канал — раніше застосунок чекав 2,5 с і «Нагадаю…» зникало ще до того, як він закривався.
  if (t.none) {
    const r = await readMessage(env, chat, leadId);
    if (!r) return { ok: false, error: "Заявку не знайдено — можливо, її видалили" };
    try {
      if (!isLead(r.original)) return { ok: false, error: "Заявку не знайдено — можливо, її видалили" };
      await applyStatus(env, chat, leadId, parse(r.original), "later", null, fullName(user));
    } finally {
      await del(env, chat, r.probe.message_id);
    }
    return { ok: true };
  }

  const nums = ["y", "m", "d", "h", "mi"].map((k) => Number(t[k]));
  if (nums.some((n) => !Number.isInteger(n))) return { ok: false, error: "Оберіть дату й час" };
  const at = kyivAt(...nums);
  // Найраніше — наступна хвилина: о 00:12:40 можна поставити 00:13 («будильник» спрацьовує щохвилини)
  if (at < Math.floor(Date.now() / MIN) * MIN + MIN) return { ok: false, error: "Цей час уже минув — оберіть пізніший" };
  if (at > Date.now() + 400 * 24 * HOUR) return { ok: false, error: "Задалеко — оберіть дату в межах року" };

  const r = await readMessage(env, chat, leadId);
  if (!r) return { ok: false, error: "Заявку не знайдено — можливо, її видалили" };
  try {
    if (!isLead(r.original)) return { ok: false, error: "Заявку не знайдено — можливо, її видалили" };
    await applyStatus(env, chat, leadId, parse(r.original), "later", at, fullName(user));
  } catch (e) {
    if (e.message === "board-full") return { ok: false, error: `Заплановано вже ${BOARD_MAX} нагадувань — це максимум. Закрийте старі заявки.` };
    throw e;
  } finally {
    await del(env, chat, r.probe.message_id);
  }
  return { ok: true, when: fmtWhen(at) };
}

/* Повідомлення адміна в каналі: якщо перед ним висить запит «напишіть нотатку» — це нотатка. */
async function onChannelPost(post, env) {
  const text = (post.text || post.caption || "").trim();
  if (!text || text.startsWith("/")) return;
  const chat = post.chat.id;

  // Запит зазвичай — попереднє повідомлення; дивимось ще одне назад, якщо щось вклинилось.
  let prompt = null;
  for (let back = 1; back <= 2 && !prompt; back++) {
    const r = await readMessage(env, chat, post.message_id - back);
    if (!r) continue;
    await del(env, chat, r.probe.message_id);
    const p = r.original;
    const ours = p?.text?.startsWith(NOTE_PROMPT);
    if (ours && post.date - p.date <= PROMPT_TTL) prompt = p;
  }
  if (!prompt) return;

  const ents = prompt.entities || [];
  const link = ents.find((e) => e.type === "text_link" && LINK_RE.test(e.url));
  const bold = ents.find((e) => e.type === "bold");
  const leadId = link && +link.url.match(LINK_RE)[1];
  if (!leadId) return;
  const who = bold ? prompt.text.slice(bold.offset, bold.offset + bold.length) : "Адмін";

  // «Дякую» одночасно читає заявку (відповідь на неї повертає її вміст).
  const r = await readMessage(env, chat, leadId, "✅ Дякую, нотатку додано");
  if (!r || !isLead(r.original)) return;

  const m = parse(r.original);
  m.notes.push(`— ${stamp()} · ${esc(who)}: ${esc(text.replace(/\s*\n+\s*/g, " ").slice(0, 600))}`);
  try {
    await editLead(env, chat, leadId, m);
  } catch (e) {
    console.error("[tg] note failed:", e.message);
    await quiet(call(env, "editMessageText", { chat_id: chat, message_id: r.probe.message_id, text: "⚠️ Не вдалося додати нотатку" }));
  }

  // Прибираємо діалог: запит і ваше повідомлення — одразу, «Дякую» — за мить.
  await del(env, chat, prompt.message_id);
  await del(env, chat, post.message_id);
  await sleep(THANKS_DELAY);
  await del(env, chat, r.probe.message_id);
}
