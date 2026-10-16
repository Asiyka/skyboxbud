/* Час за Києвом: форматування нагадувань і розбір дат зі списку в закріпленому повідомленні. */

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
