/* ============================================================
   Час за Києвом і розбір «свого терміну» нагадування:
   2 тижні · 25 днів · 3 години · пів години · завтра 15:00 · 15.11 · 15.11 14:00
   ============================================================ */

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const kyiv = (ms, opts) => new Date(ms).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", ...opts });
const kyivDay = (ms) => kyiv(ms, { year: "numeric", month: "2-digit", day: "2-digit" });

function kyivOffsetMin(date) {
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName").value; // "GMT+3"
  const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
}

/** Частини дати й часу за Києвом. */
export function kyivParts(ms = Date.now()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

/** Мітка часу для дати й часу за Києвом (переповнення днів/місяців Date.UTC обробляє сам). */
export function kyivAt(y, m, d, h = 10, min = 0) {
  const utc = Date.UTC(y, m - 1, d, h, min);
  return utc - kyivOffsetMin(new Date(utc)) * MIN;
}

export const kyivDayAt = (plusDays, h, min = 0) => {
  const t = kyivParts();
  return kyivAt(t.y, t.m, t.d + plusDays, h, min);
};

/** now + N календарних днів за Києвом, з тим самим часом на годиннику (навіть через перехід на зимовий час). */
function addKyivDays(now, n) {
  if (!n) return now;
  const p = kyivParts(now);
  return kyivAt(p.y, p.m, p.d + n, p.h, p.min) + (now % MIN);
}

/** «сьогодні о 14:30» / «завтра о 10:00» / «30.10 о 10:00» */
export function fmtWhen(ms) {
  const time = kyiv(ms, { hour: "2-digit", minute: "2-digit" });
  if (kyivDay(ms) === kyivDay(Date.now())) return `сьогодні о ${time}`;
  if (kyivDay(ms) === kyivDay(Date.now() + DAY)) return `завтра о ${time}`;
  const sameYear = kyivParts(ms).y === kyivParts().y;
  return `${kyiv(ms, { day: "2-digit", month: "2-digit", ...(sameYear ? {} : { year: "numeric" }) })} о ${time}`;
}

/** Компактна дата для списку нагадувань: «30.10 10:00». */
export const fmtShort = (ms) => {
  const p = kyivParts(ms);
  const z = (n) => String(n).padStart(2, "0");
  return `${z(p.d)}.${z(p.m)} ${z(p.h)}:${z(p.min)}`;
};

/** Зворотне до fmtShort: рік не пишемо, тому беремо найближчий, що не в далекому минулому. */
export function parseShort(s, now = Date.now()) {
  const m = s.match(/^(\d{2})\.(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const y = kyivParts(now).y;
  let at = kyivAt(y, +m[2], +m[1], +m[3], +m[4]);
  if (at < now - 60 * DAY) at = kyivAt(y + 1, +m[2], +m[1], +m[3], +m[4]);
  return at;
}

/* ---------- розбір «свого терміну» (українська, російська, англійська) ---------- */

/** День тижня за Києвом: 0 — неділя … 6 — субота. */
export const kyivWeekday = (ms = Date.now()) => {
  const p = kyivParts(ms);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
};

const UNITS = [
  [/^(хв|хвил|мин|min|m$|м$)/, MIN],
  [/^(год|годин|час|ч$|h$|hour|hr)/, HOUR],
  [/^(дн|ден|день|дня|днів|доб|сут|д$|d$|day)/, DAY],
  [/^(тиж|нед|week|wk|w$|т$)/, 7 * DAY],
  [/^(міс|мес|month|mo$)/, 30 * DAY],
  [/^(рік|року|рок|років|лет|года$|year|yr)/, 365 * DAY],
];

const NUM_WORDS = {
  1: ["один", "одна", "одну", "одного", "однієї", "one", "a", "an"],
  2: ["два", "дві", "двох", "две", "two", "пару", "пара", "пари", "couple"],
  3: ["три", "трьох", "трех", "three", "кілька", "декілька", "несколько", "few", "several"],
  4: ["чотири", "чотирьох", "четыре", "four"],
  5: ["п'ять", "пять", "five"],
  6: ["шість", "шесть", "six"],
  7: ["сім", "семь", "seven"],
  8: ["вісім", "восемь", "eight"],
  9: ["дев'ять", "девять", "nine"],
  10: ["десять", "ten"],
  11: ["одинадцять", "одиннадцать", "eleven"],
  12: ["дванадцять", "двенадцать", "twelve"],
  14: ["чотирнадцять", "четырнадцать", "fourteen"],
  15: ["п'ятнадцять", "пятнадцать", "fifteen"],
  20: ["двадцять", "двадцать", "twenty"],
  30: ["тридцять", "тридцать", "thirty"],
  40: ["сорок", "forty"],
  45: ["сорокп'ять"],
  60: ["шістдесят", "шестьдесят", "sixty"],
  90: ["дев'яносто", "девяносто", "ninety"],
  1.5: ["півтора", "півтори", "полтора", "полторы"],
  0.5: ["пів", "пол", "половину", "half"],
};
const NUM = new Map(Object.entries(NUM_WORDS).flatMap(([n, ws]) => ws.map((w) => [w, +n])));

const WEEKDAYS = [
  [/^(неділ|воскрес|sun|нд$)/, 0],
  [/^(понеділ|понедел|mon|пн$)/, 1],
  [/^(вівтор|вторн|tue|вт$)/, 2],
  [/^(серед|сред|wed|ср$)/, 3],
  [/^(четвер|thu|чт$)/, 4],
  [/^(п'ятниц|пятниц|fri|пт$)/, 5],
  [/^(субот|суббот|sat|сб$)/, 6],
];

const MONTHS = [
  /^(січ|янв|jan)/, /^(лют|фев|feb)/, /^(берез|март|мар|mar)/, /^(квіт|апр|apr)/,
  /^(трав|мая|май|may)/, /^(черв|июн|jun)/, /^(лип|июл|jul)/, /^(серп|авг|aug)/,
  /^(верес|сент|сен|sep)/, /^(жовт|окт|oct)/, /^(листоп|нояб|ноя|nov)/, /^(груд|дек|dec)/,
];

/* Частини дня → година за замовчуванням */
const DAYPARTS = [
  [/^(вранці|зранку|ранку|утром|утра|morning)$/, 9],
  [/^(обід|обіду|обед|обеда|lunch|noon|опівдні|полдень)$/, 13],
  [/^(вечері|ввечері|увечері|вечора|вечером|вечора|evening|tonight)$/, 18],
];

// Слова, що не впливають на зміст: «нагадай мені через пару днів, будь ласка»
const FILLER = new Set(
  ("через in і й та и and на о об в у at about around десь приблизно близько десь-то " +
    "нагадай нагадати нагадайте напомни напомнить remind me мені мне будь ласка please пожалуйста " +
    "цей цю цього це этот эту this the на_тому о_цій").split(" ")
);
const NEXT = /^(наступн|следующ|next)/;
const AFTER = /^(після|после|after)$/;

const tokenize = (s) => s.match(/\d+(?:\.\d+)?|[a-zа-яіїєґ']+/gi) || [];

export function parseWhen(input, now = Date.now()) {
  let s = String(input)
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/[,!?;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  const today = kyivParts(now);
  const inRange = (at) => (at && at - now >= MIN && at - now <= 400 * DAY ? at : null);
  const cut = (re, fn) => {
    s = s.replace(re, (...a) => (fn(...a) ? " " : a[0])).replace(/\s+/g, " ").trim();
  };

  /* 1) Числова дата: 15.11 · 15.11.2026 · 15/11 (але не «о 15.30» — це час) */
  let date = null;
  cut(/(?:^| )(?<!(?:о|об|в|у|at|до) )(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?= |$)/, (_, d, m, y) => {
    if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return false;
    date = { d: +d, m: +m, y: y ? (y.length === 2 ? 2000 + +y : +y) : null };
    return true;
  });

  /* 2) Година: «о 15», «о 15.30», «15:00», «3pm», «о 7 вечора» */
  let clock = null;
  const setClock = (h, mi, ampm = "") => {
    let hh = +h;
    if (/pm|дня|вечора|вечера/.test(ampm) && hh < 12) hh += 12;
    if (/am|ранку|утра/.test(ampm) && hh === 12) hh = 0;
    if (hh > 23 || +(mi || 0) > 59) return false;
    clock = [hh, +(mi || 0)];
    return true;
  };
  cut(/(?:^| )(?:о|об|в|у|at|до) (\d{1,2})(?:[:.](\d{2}))?(?: ?(am|pm|ранку|утра|дня|вечора|вечера))?(?= |$)/, (_, h, mi, ap) => setClock(h, mi, ap));
  if (!clock) cut(/(?:^| )(\d{1,2}):(\d{2})(?: ?(am|pm|ранку|утра|дня|вечора|вечера))?(?= |$)/, (_, h, mi, ap) => setClock(h, mi, ap));
  if (!clock) cut(/(?:^| )(\d{1,2}) ?(am|pm)(?= |$)/, (_, h, ap) => setClock(h, 0, ap));

  /* 3) Слова: день, день тижня, місяць, частина дня; решта — у тривалість */
  let dayShift = null; // зсув у календарних днях від сьогодні
  let partHour = null;
  let after = false;
  let next = false;
  const rest = [];
  const wdNow = kyivWeekday(now);
  const untilWeekday = (wd) => ((wd - wdNow + 7) % 7) || 7; // найближчий такий день, не сьогодні

  for (const t of tokenize(s)) {
    if (FILLER.has(t)) continue;
    if (NEXT.test(t)) next = true;
    else if (AFTER.test(t)) after = true;
    else if (/^(сьогодні|сегодня|today)$/.test(t)) dayShift = 0;
    else if (/^(завтра|tomorrow)$/.test(t)) dayShift = 1;
    else if (/^(післязавтра|послезавтра)$/.test(t)) dayShift = 2;
    else if (/^(вихідн|выходн|weekend)/.test(t)) dayShift = untilWeekday(6);
    else if (next && /^(тиж|недел|week)/.test(t)) dayShift = untilWeekday(1); // «наступного тижня» = понеділок
    else if (next && /^(міс|месяц|month)/.test(t)) date = { d: 1, m: today.m + 1, y: today.y };
    else if (WEEKDAYS.some(([re]) => re.test(t))) dayShift = untilWeekday(WEEKDAYS.find(([re]) => re.test(t))[1]);
    else if (MONTHS.some((re) => re.test(t)) && /^\d+$/.test(rest[rest.length - 1] || "")) {
      date = { d: +rest.pop(), m: MONTHS.findIndex((re) => re.test(t)) + 1, y: null }; // «15 листопада»
    } else if (DAYPARTS.some(([re]) => re.test(t))) {
      partHour = DAYPARTS.find(([re]) => re.test(t))[1] + (after ? 1 : 0); // «після обіду» = 14:00
    } else rest.push(t);
  }
  if (clock && partHour >= 12 && clock[0] < 12) clock[0] += 12; // «о 7 вечора»

  /* 4) Конкретний день + година («завтра 15», «у пʼятницю ввечері», «15 листопада о 14:00») */
  if (date || dayShift != null || (partHour != null && !rest.length)) {
    if (!clock && rest.length === 1 && /^\d{1,2}$/.test(rest[0]) && +rest[0] <= 23) clock = [+rest.shift(), 0];
    if (rest.length) return null; // лишились незрозумілі слова — краще перепитати
    const [h, mi] = clock || [partHour ?? 10, 0];
    if (date) {
      let at = kyivAt(date.y ?? today.y, date.m, date.d, h, mi);
      if (date.y == null && at < now) at = kyivAt(today.y + 1, date.m, date.d, h, mi);
      return inRange(at);
    }
    let at = kyivAt(today.y, today.m, today.d + (dayShift ?? 0), h, mi);
    if (dayShift == null && at <= now) at = kyivAt(today.y, today.m, today.d + 1, h, mi); // «ввечері», що вже минув
    return inRange(at);
  }

  /* 5) Лише година: «о 15:00» → сьогодні, а якщо вже минуло — завтра */
  if (clock && !rest.length) {
    let at = kyivAt(today.y, today.m, today.d, clock[0], clock[1]);
    if (at <= now) at = kyivAt(today.y, today.m, today.d + 1, clock[0], clock[1]);
    return inRange(at);
  }

  /* 6) Тривалість: «2 тижні», «двадцять пʼять днів», «пару годин», «півтора місяці» */
  let ms = 0;
  let days = 0;
  let num = null;
  let any = false;
  for (const t of rest) {
    if (/^\d/.test(t)) {
      num = parseFloat(t);
      continue;
    }
    if (NUM.has(t)) {
      const v = NUM.get(t);
      num = num != null && num >= 20 && num % 10 === 0 && v < 10 ? num + v : v; // «двадцять пʼять» = 25
      continue;
    }
    const unit = UNITS.find(([re]) => re.test(t));
    if (!unit) return null;
    if (unit[1] >= DAY) days += (num ?? 1) * (unit[1] / DAY);
    else ms += (num ?? 1) * unit[1];
    num = null;
    any = true;
  }
  // Просто ціле число без одиниці — вважаємо днями («5» = через 5 днів)
  if (num != null) {
    if (!Number.isInteger(num)) return null;
    days += num;
    any = true;
  }
  if (!any) return null;
  const whole = Math.floor(days);
  let at = addKyivDays(now, whole) + (days - whole) * DAY + ms;
  // «через 2 дні о 15:00» — дні + конкретна година
  if (clock && ms === 0) {
    const p = kyivParts(at);
    at = kyivAt(p.y, p.m, p.d, clock[0], clock[1]);
  }
  return inRange(at);
}
