import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext } from "react";
import { T } from "./i18n.js";
import { validateLead } from "../api/_validate.js";

/* ============================================================
   ЗАГЛУШКА — дерев'яні ящики. Стиль 1:1 з Claude Design
   («Лендінг ящиків v3»). Усі тексти — у src/i18n.js.
   ============================================================ */

const C = {
  bg: "oklch(0.982 0.007 84)",
  bgAlt: "oklch(0.955 0.014 82)",
  card: "oklch(1 0 0)",
  ink: "oklch(0.2 0.01 80)",
  inkHover: "oklch(0.32 0.01 80)",
  text2: "oklch(0.35 0.01 80)",
  lead: "oklch(0.42 0.01 80)",
  body: "oklch(0.45 0.01 80)",
  muted: "oklch(0.5 0.01 80)",
  soft: "oklch(0.55 0.01 80)",
  line: "oklch(0.905 0.009 84)",
  lineSoft: "oklch(0.94 0.006 85)",
  chip: "oklch(0.955 0.008 84)",
  accent: "oklch(0.62 0.13 45)",
  accentDeep: "oklch(0.54 0.13 45)",
  accentSoft: "oklch(0.93 0.06 45)",
  accentTint: "oklch(0.945 0.04 60)",
  accentText: "oklch(0.42 0.13 45)",
  accentHead: "oklch(0.58 0.14 45)",
  onDark: "oklch(0.985 0.006 85)",
  onDarkSoft: "oklch(0.78 0.01 80)",
};

const DISPLAY = "'Sora', sans-serif";
const BODY = "'Public Sans', sans-serif";

const PAD_H = "min(6vw, 88px)";
const MAXW = 1200;

/* Плавна крива для розкриття/згортання — довго «доїжджає», без ривка в кінці. */
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/* ============================================================
   ДАНІ КОМПАНІЇ — обов'язково замінити перед публікацією
   (назва та адреса — у src/i18n.js, окремо для кожної мови)
   ============================================================ */
const PHONE_HREF = "tel:+380000000000"; // TODO: реальний номер, формат tel:+380XXXXXXXXX
const PHONE_TEXT = "+38 (000) 000-00-00"; // TODO: той самий номер у зручному для читання форматі

/* Локальні фото — public/images/. Завантажуються один раз скриптом
   scripts/fetch-images.mjs (npm run fetch:images), див. README. */
const IMG = {
  warehouse: "warehouse",
  small: "small-crates",
  medium: "medium-crates",
  custom: "custom-crates",
  large: "large-crates",
};
const PRODUCT_PHOTOS = [IMG.small, IMG.medium, IMG.large, IMG.custom];

/* Галерея кожного формату (у тому ж порядку, що й каталог). Перше фото — обкладинка слайда.
   TODO: замінити на реальні фото кожного формату — покласти в public/images/ і вписати сюди імена файлів без .jpg */
const PRODUCT_GALLERIES = [
  [IMG.small, IMG.warehouse, IMG.medium, IMG.custom, IMG.large],
  [IMG.medium, IMG.warehouse, IMG.small, IMG.large, IMG.custom],
  [IMG.large, IMG.warehouse, IMG.custom, IMG.medium, IMG.small],
  [IMG.custom, IMG.warehouse, IMG.large, IMG.small, IMG.medium],
];

const src = (id) => `/images/${id}.jpg`;

/* ---------- мова ---------- */

const LangCtx = createContext(null);
const useT = () => useContext(LangCtx);

function readLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "uk" || saved === "en") return saved;
  } catch {}
  return "uk";
}

/* ---------- утиліти ---------- */

function useMedia(q) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function useReveal(threshold = 0.05) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on];
}

function Reveal({ children, delay = 0, style, as: Tag = "div", ...rest }) {
  const [ref, on] = useReveal();
  return (
    <Tag
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : "translateY(18px)",
        transition: `opacity 620ms cubic-bezier(0.2,0,0.2,1) ${delay}ms, transform 620ms cubic-bezier(0.2,0,0.2,1) ${delay}ms`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function CountUp({ to, suffix = "", duration = 1400 }) {
  const { t } = useT();
  const [ref, on] = useReveal(0.4);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(to);
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, duration]);
  return (
    <span ref={ref}>
      {new Intl.NumberFormat(t.locale).format(Math.round(v))}
      {suffix}
    </span>
  );
}

/* ---------- телефон: на компʼютері копіюємо номер (tel: там нікуди не веде) ---------- */

const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Копіює текст; повертає true, якщо вдалося. Clipboard API іноді «зависає» без фокусу вікна —
    тоді за мить пробуємо старий спосіб через прихований textarea. */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(no, 700))]);
      return true;
    }
  } catch {}
  const ta = Object.assign(document.createElement("textarea"), { value: text });
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  ta.remove();
  return ok;
}

const toast = (text) => window.dispatchEvent(new CustomEvent("toast", { detail: text }));

/** Пропси для посилання на телефон: на телефоні дзвонить, на компʼютері копіює номер. */
function phoneProps(t) {
  return {
    href: PHONE_HREF,
    onClick: (e) => {
      if (!canHover()) return;
      e.preventDefault();
      // Навіть якщо браузер не дав скопіювати — показуємо номер, щоб його можна було переписати.
      copyText(PHONE_TEXT).then((ok) => toast(ok ? `✓ ${t.copied}: ${PHONE_TEXT}` : `📞 ${PHONE_TEXT}`));
    },
    onMouseEnter: (e) => {
      if (canHover()) e.currentTarget.title = t.copyHint;
    },
  };
}

function Toast() {
  // Текст і видимість окремо: при зникненні текст лишається, поки йде анімація.
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(false);
  useEffect(() => {
    let timer;
    const on = (e) => {
      setText(e.detail);
      setMsg(true);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(false), 2400);
    };
    window.addEventListener("toast", on);
    return () => {
      window.removeEventListener("toast", on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        zIndex: 100,
        transform: `translate(-50%, ${msg ? 0 : 16}px)`,
        opacity: msg ? 1 : 0,
        pointerEvents: "none",
        transition: `opacity 260ms ease, transform 360ms ${EASE_OUT}`,
        padding: "12px 20px",
        borderRadius: 999,
        background: C.ink,
        color: C.onDark,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 10px 30px oklch(0.2 0.01 80 / 0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

/* ---------- фото з плавною появою (фон — смугастий плейсхолдер з дизайну) ---------- */

const STRIPES = "repeating-linear-gradient(115deg, oklch(0.915 0.014 82) 0 14px, oklch(0.945 0.012 82) 14px 28px)";

function Photo({ id, alt, radius = 0, style, fit = "cover" }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius, background: STRIPES, ...style }}>
      <img
        src={src(id)}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: fit,
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 700ms ease",
        }}
      />
    </div>
  );
}

/* shape — форма акцентної мітки в іконці переваг (як у дизайні: квадрат, коло, риска) */
const ADV_SHAPES = [
  { width: 15, height: 15, borderRadius: 4 },
  { width: 15, height: 15, borderRadius: "50%" },
  { width: 15, height: 4, borderRadius: 2 },
];

/* Пункти меню в порядку секцій на сторінці */
const NAV = ["advantages", "catalog", "process", "quality", "about", "order"];
const SECTION_ID = {
  advantages: "advantages",
  catalog: "catalog",
  process: "process",
  quality: "quality",
  about: "about",
  order: "order",
};
/* Секції, що підсвічують пункт меню: «Як працюємо» = кроки + застосування + питання */
const SECTION_NAV = { ...Object.fromEntries(NAV.map((k) => [SECTION_ID[k], k])), "use-cases": "process", faq: "process" };

/* ============================================================
   МЕСЕНДЖЕРИ — замінити на реальні контакти
   ============================================================ */
const MESSENGERS = [
  {
    id: "telegram",
    name: "Telegram",
    href: "https://t.me/your_username", // TODO: ваш username у Telegram (без @)
    color: "#229ED9",
    icon: (
      <path
        fill="currentColor"
        d="M21.4 4.1 2.9 11.2c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.6ZM9.6 14.4l-.4 4 -1.4-4.6 10.4-6.6c.5-.3.9-.1.5.2l-9.1 7Z"
      />
    ),
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    href: "https://wa.me/380000000000", // TODO: номер у міжнародному форматі без «+» і пробілів
    color: "#25D366",
    icon: (
      <>
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
        <path
          fill="currentColor"
          d="M9 7.6c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.4l.7 1.7c.1.2.1.4 0 .6l-.5.6c-.1.2-.2.4 0 .6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6 0l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .7-.3 1.3-.9 1.6-.6.3-1.3.4-2.1.2-1.3-.4-2.5-1.2-3.5-2.2s-1.7-2.1-2-3.3c-.2-.8-.2-1.5.1-2.1Z"
        />
      </>
    ),
  },
  {
    id: "viber",
    name: "Viber",
    href: "viber://chat?number=%2B380000000000", // TODO: номер після %2B — без «+» і пробілів
    color: "#7360F2",
    icon: (
      <>
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M12 3c-5 0-8 2.3-8 7.3 0 2.7.9 4.5 2.7 5.6V20l2.9-2.4c.8.1 1.6.2 2.4.2 5 0 8-2.3 8-7.5S17 3 12 3Z" />
        <path
          fill="currentColor"
          d="M9.4 7.4c.2-.3.4-.3.6-.3h.4c.2 0 .3 0 .5.3l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.1-.1.3 0 .5.4.7 1 1.3 1.7 1.7.2.1.3.1.5 0l.5-.5c.1-.1.3-.2.5-.1l1.3.6c.2.1.3.2.3.4 0 .6-.3 1.1-.7 1.3-.5.2-1.1.3-1.7.1-1.1-.3-2-.9-2.8-1.7-.8-.8-1.4-1.8-1.6-2.7-.2-.6-.1-1.2.1-1.6Z"
        />
        <path fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" d="M13.2 6.6a3.4 3.4 0 0 1 3.1 3.1M13.3 8.2a1.7 1.7 0 0 1 1.5 1.5" />
      </>
    ),
  },
];

const isExternal = (href) => href.startsWith("http");

function MessengerIcon({ m, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {m.icon}
    </svg>
  );
}

/* ---------- глобальні стилі (включно з hover-станами з дизайну) ---------- */

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: ${C.bg}; }
a { color: ${C.accent}; text-decoration: none; }
a:hover { color: oklch(0.45 0.13 45); }
::selection { background: oklch(0.88 0.08 45); }
html { scroll-behavior: smooth; }
section[id] { scroll-margin-top: calc(84px + env(safe-area-inset-top, 0px)); }

@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.marquee-track { animation: marquee 32s linear infinite; }

.lift { transition: box-shadow 240ms ease, transform 240ms ease; }
.lift:hover { box-shadow: 0 12px 32px oklch(0.2 0.01 80 / 0.08); transform: translateY(-3px); }

.h-dark { transition: background 200ms ease; }
.h-dark:hover { background: ${C.inkHover} !important; color: ${C.onDark} !important; }
.h-white { transition: background 200ms ease; }
.h-white:hover { background: oklch(0.975 0.006 84) !important; color: ${C.ink} !important; }
.h-nav { transition: background 220ms ease, color 220ms ease; }
.h-nav:hover { background: ${C.chip} !important; color: ${C.ink} !important; }
.h-lang { transition: background 200ms ease; }
.h-lang:hover { background: oklch(0.97 0.006 84) !important; }
.h-arrow { transition: background 200ms ease; }
.h-arrow:hover { background: oklch(0.94 0.008 84) !important; }
.h-accent { transition: background 200ms ease; }
.h-accent:hover { background: ${C.accentDeep} !important; }
.h-phone { transition: color 200ms ease; }
.h-phone:hover { color: oklch(0.8 0.1 45) !important; }
.h-faq:hover .faq-icon { background: oklch(0.93 0.01 85); }
.h-msg { transition: background 200ms ease, border-color 200ms ease, transform 200ms ease; }
.h-msg:hover { background: oklch(1 0 0 / 0.14) !important; border-color: var(--brand) !important; color: ${C.onDark} !important; transform: translateY(-1px); }
.h-lift { transition: transform 200ms ease; }
.h-lift:hover { transform: translateY(-1px); }
.h-gal-close { transition: background 200ms ease; }
.h-gal-close:hover { background: oklch(1 0 0 / 0.18) !important; }
.h-foot-msg { transition: transform 200ms ease, box-shadow 200ms ease; }
.h-foot-msg:hover { transform: translateY(-2px); box-shadow: 0 6px 14px oklch(0.2 0.01 80 / 0.1); }

.noscroll::-webkit-scrollbar { display: none; }
.noscroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }

input:focus, textarea:focus { outline: none; border-color: ${C.accent} !important; }

a:focus-visible, button:focus-visible {
  outline: 2px solid ${C.accent}; outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
`;

/* ---------- базові стилі ---------- */

const eyebrowStyle = {
  fontFamily: DISPLAY,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: C.accentHead,
  marginBottom: 18,
};

const h2Style = {
  fontFamily: DISPLAY,
  fontSize: "clamp(30px, 3.2vw, 40px)",
  lineHeight: 1.08,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  margin: "0 0 12px",
};

const subStyle = { fontSize: 17, color: C.muted, margin: 0, fontWeight: 300 };

const darkBtn = {
  display: "inline-block",
  padding: "12px 22px",
  borderRadius: 999,
  background: C.ink,
  color: C.onDark,
  fontWeight: 600,
  fontSize: 14,
  whiteSpace: "nowrap",
};

function Title({ children, accent, style }) {
  return (
    <h2 style={{ ...h2Style, ...style }}>
      {children}
      <br />
      <span style={{ color: C.accentHead }}>{accent}</span>
    </h2>
  );
}

const section = (extra) => ({ padding: `96px ${PAD_H} 0`, ...extra });
const wrap = { maxWidth: MAXW, margin: "0 auto" };

/* ============================================================
   СЕКЦІЇ
   ============================================================ */

function useActiveSection() {
  const [active, setActive] = useState(null);
  useEffect(() => {
    const els = Object.keys(SECTION_NAV).map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(SECTION_NAV[e.target.id]);
        });
      },
      // «активна» — та секція, що перетинає смугу трохи вище середини екрана
      { rootMargin: "-40% 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    const onTop = () => window.scrollY < 200 && setActive(null);
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, []);
  return active;
}

function Header({ isMobile, isWide }) {
  const { t, lang, setLang } = useT();
  const en = lang === "en";
  const active = useActiveSection();
  const navRef = useRef(null);

  // На вузьких екранах меню прокручується — тримаємо активний пункт у видимій зоні.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth + 1) return;
    const a = nav.querySelector(`[data-key="${active}"]`);
    if (!a) return;
    nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  // Затухання країв — лише коли меню справді не вміщається й прокручується.
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const check = () => setOverflow(nav.scrollWidth > nav.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(nav);
    document.fonts?.ready.then(check);
    return () => ro.disconnect();
  }, [lang, isMobile, isWide]);

  // Мобільне меню («гамбургер»): закривається пунктом меню, тапом поза шапкою або Escape.
  const headerRef = useRef(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!isMobile) setMenu(false);
  }, [isMobile]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    const onDown = (e) => !headerRef.current?.contains(e.target) && setMenu(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [menu]);

  const navMask = overflow ? "linear-gradient(to right, transparent 0, black 18px, black calc(100% - 18px), transparent 100%)" : "none";
  // Повний номер у кнопці — лише на широких екранах, інакше іконка (звільняє місце для меню).
  const phoneCompact = isMobile || !isWide;

  // Рамка й фон — на зовнішньому «овалі», прокрутка із затуханням — всередині,
  // щоб маска не з'їдала край овалу і пункти не виглядали такими, що вилазять за нього.
  const nav = (
    <nav
      style={{
        display: "flex",
        padding: 5,
        borderRadius: 999,
        background: "oklch(1 0 0 / 0.94)",
        backdropFilter: "blur(14px)",
        border: `1px solid ${C.line}`,
        overflow: "hidden",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
    <div
      ref={navRef}
      className="noscroll"
      style={{
        display: "flex",
        flex: "1 1 auto",
        gap: 2,
        alignItems: "center",
        justifyContent: "flex-start",
        borderRadius: 999,
        overflowX: "auto",
        minWidth: 0,
        WebkitMaskImage: navMask,
        maskImage: navMask,
      }}
    >
      {NAV.map((k) => {
        const on = active === k;
        return (
          <a
            key={k}
            data-key={k}
            href={`#${SECTION_ID[k]}`}
            className="h-nav"
            aria-current={on ? "true" : undefined}
            style={{
              color: on ? C.ink : C.text2,
              background: on ? C.chip : "transparent",
              fontWeight: 500,
              fontSize: "clamp(13px, 1.05vw, 15px)",
              padding: "9px clamp(10px, 1vw, 15px)",
              borderRadius: 999,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t.nav[k]}
          </a>
        );
      })}
    </div>
    </nav>
  );

  const mobileMenu = (
    <nav
      id="mobile-menu"
      aria-hidden={!menu}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "calc(100% + 12px)",
        display: "grid",
        gap: 2,
        padding: 6,
        borderRadius: 20,
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "0 16px 40px oklch(0.2 0.01 80 / 0.14)",
        opacity: menu ? 1 : 0,
        transform: menu ? "none" : "translateY(-8px)",
        visibility: menu ? "visible" : "hidden",
        transition: `opacity 200ms ease, transform 280ms ${EASE_OUT}, visibility 0s linear ${menu ? 0 : 280}ms`,
      }}
    >
      {NAV.map((k) => {
        const on = active === k;
        return (
          <a
            key={k}
            href={`#${SECTION_ID[k]}`}
            onClick={() => setMenu(false)}
            tabIndex={menu ? 0 : -1}
            aria-current={on ? "true" : undefined}
            className="h-nav"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 500,
              color: on ? C.ink : C.text2,
              background: on ? C.chip : "transparent",
            }}
          >
            {t.nav[k]}
            {on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />}
          </a>
        );
      })}
    </nav>
  );

  // Три риски, що перетворюються на «×»
  const bar = (i) => ({
    position: "absolute",
    left: 13,
    width: 18,
    height: 2,
    borderRadius: 2,
    background: "currentColor",
    top: 21 + (menu ? 0 : (i - 1) * 6),
    opacity: menu && i === 1 ? 0 : 1,
    transform: menu && i !== 1 ? `rotate(${i === 0 ? 45 : -45}deg)` : "none",
    transition: `top 240ms ${EASE_OUT}, transform 240ms ${EASE_OUT}, opacity 160ms ease`,
  });

  return (
    <header
      ref={headerRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        // safe-area: на iPad/iPhone з viewport-fit=cover шапка заходить під статус-бар,
        // тож над нею більше не просвічує контент сторінки
        padding: `calc(16px + env(safe-area-inset-top, 0px)) ${PAD_H} 16px`,
        background: C.bg,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto", minWidth: 0, color: C.ink }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: C.ink, flexShrink: 0 }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(16px, 1.5vw, 19px)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
              {t.company}
            </span>
          </a>

          {!isMobile && <div style={{ flex: "0 1 auto", minWidth: 0, margin: "0 auto", display: "flex" }}>{nav}</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
            {isMobile && (
              <button
                onClick={() => setMenu((v) => !v)}
                aria-label={menu ? t.menuClose : t.menuOpen}
                aria-expanded={menu}
                aria-controls="mobile-menu"
                className="h-lang"
                style={{
                  position: "relative",
                  width: 46,
                  height: 46,
                  padding: 0,
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  background: C.card,
                  color: C.ink,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span key={i} style={bar(i)} />
                ))}
              </button>
            )}
            <a
              {...phoneProps(t)}
              className="h-dark"
              aria-label={phoneCompact ? `${t.callAria} ${PHONE_TEXT}` : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 46,
                width: phoneCompact ? 46 : "auto",
                padding: phoneCompact ? 0 : "0 clamp(14px, 1.6vw, 22px)",
                borderRadius: 999,
                background: C.ink,
                color: C.onDark,
                fontWeight: 600,
                fontSize: "clamp(13px, 1.2vw, 15px)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </svg>
              {!phoneCompact && <span>{PHONE_TEXT}</span>}
            </a>

            <button
              onClick={() => setLang(en ? "uk" : "en")}
              aria-label={t.langLabel}
              className="h-lang"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 46,
                width: isMobile ? 46 : "auto",
                padding: isMobile ? 0 : "0 16px",
                borderRadius: 999,
                border: `1px solid ${C.line}`,
                background: C.card,
                cursor: "pointer",
                fontFamily: DISPLAY,
                fontSize: 13,
                fontWeight: 600,
                color: "oklch(0.3 0.01 80)",
                flexShrink: 0,
              }}
            >
              {isMobile ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
                </svg>
              ) : (
                <>
                  <span style={{ color: en ? "oklch(0.62 0.01 84)" : C.ink, transition: "color 200ms ease" }}>UA</span>
                  <span style={{ color: "oklch(0.82 0.01 84)" }}>/</span>
                  <span style={{ color: en ? C.ink : "oklch(0.62 0.01 84)", transition: "color 200ms ease" }}>EN</span>
                </>
              )}
            </button>
          </div>

          {/* На мобільному меню в рядок не вміщається — ховаємо під «гамбургер» */}
          {isMobile && mobileMenu}
        </div>
      </div>
    </header>
  );
}

function Check({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "oklch(0.93 0.05 45)",
          color: "oklch(0.5 0.13 45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        ✓
      </span>
      <span style={{ fontSize: 15, color: C.lead }}>{children}</span>
    </div>
  );
}

function Hero({ isMobile }) {
  const { t } = useT();
  const h = t.hero;
  return (
    <section
      id="top"
      style={{
        padding: `0 ${PAD_H}`,
        minHeight: isMobile ? "calc(100svh - 78px)" : "calc(100vh - 78px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "24px 0 48px" : "40px 0 64px" }}>
        <Reveal
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px 6px 8px",
            borderRadius: 999,
            background: C.card,
            boxShadow: "0 1px 3px oklch(0.2 0.01 80 / 0.06)",
            fontSize: 13,
            color: "oklch(0.4 0.01 80)",
            marginBottom: 28,
          }}
        >
          <span style={{ padding: "3px 9px", borderRadius: 999, background: C.accentSoft, color: C.accentText, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
            {h.badge}
          </span>
          {h.badgeText}
        </Reveal>

        <Reveal
          as="h1"
          delay={60}
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(40px, 5vw, 62px)",
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            margin: "0 0 24px",
            maxWidth: 780,
            textWrap: "pretty",
          }}
        >
          {h.titlePre}
          <span style={{ color: C.accent }}>{h.titleAccent}</span>
          {h.titlePost}
        </Reveal>

        <Reveal as="p" delay={110} style={{ fontSize: 18, lineHeight: 1.6, color: C.lead, maxWidth: 560, margin: "0 0 36px", fontWeight: 300 }}>
          {h.lead}
        </Reveal>

        {/* На мобільному кнопки — одна під одною й однакової ширини */}
        <Reveal
          delay={160}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            width: isMobile ? "min(100%, 340px)" : "auto",
          }}
        >
          <a href="#catalog" className="h-dark" style={{ padding: "15px 28px", borderRadius: 999, background: C.ink, color: C.onDark, fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", textAlign: "center" }}>
            {h.ctaCatalog}
          </a>
          <a href="#order" className="h-white" style={{ padding: "15px 28px", borderRadius: 999, background: C.card, color: C.ink, fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", textAlign: "center", border: `1px solid ${C.line}` }}>
            {h.ctaQuote}
          </a>
        </Reveal>

        {/* На мобільному — стовпчиком, щоб пункти не розповзались по краях екрана */}
        <Reveal
          delay={210}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 10 : 18,
            rowGap: isMobile ? 10 : 12,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 28,
          }}
        >
          {h.checks.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && !isMobile && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.88 0.01 82)" }} />}
              <Check>{c}</Check>
            </React.Fragment>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function PhotoStats({ isMobile }) {
  const { t } = useT();
  const s = t.stats;
  const stats = [
    { v: 10, s: "+" },
    { v: 50000, s: "" },
    { v: 120, s: "+" },
    { text: s.lead },
  ];
  return (
    <section style={{ padding: `0 max(28px, ${PAD_H}) 72px` }}>
      <div
        style={{
          maxWidth: MAXW,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1.3fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
          gap: 24,
          alignItems: isMobile ? "center" : "stretch",
        }}
      >
        <Reveal style={{ alignSelf: "stretch" }}>
          <Photo id={IMG.warehouse} alt={s.photoAlt} radius={24} style={{ height: "100%", minHeight: isMobile ? 260 : 460 }} />
        </Reveal>
        <div
          style={{
            alignSelf: "center",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: isMobile ? "center" : "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: isMobile ? 0 : "0 clamp(0px, 4vw, 72px)",
          }}
        >
          {stats.map((x, i) => (
            <Reveal key={i} delay={i * 70}>
              <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                {x.text ?? <CountUp to={x.v} suffix={x.s} />}
              </div>
              <div style={{ fontSize: 15, color: C.muted, marginTop: 6 }}>{s.items[i]}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const { t } = useT();
  const list = t.industries;
  const items = [...list, ...list];
  return (
    <div style={{ background: C.card, padding: "18px 0", overflow: "hidden", position: "relative" }} aria-label={t.marqueeAria}>
      <div className="marquee-track" style={{ display: "flex", width: "max-content" }}>
        {items.map((label, i) => (
          <div key={i} aria-hidden={i >= list.length} style={{ display: "flex", alignItems: "center", gap: 32, padding: "0 16px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
            <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: "oklch(0.28 0.01 80)", whiteSpace: "nowrap" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Advantages({ isMobile }) {
  const { t } = useT();
  const a = t.advantages;
  return (
    <section id="advantages" style={section()}>
      <div style={wrap}>
        <Reveal style={eyebrowStyle}>{a.eyebrow}</Reveal>
        <Title accent={a.accent}>{a.title}</Title>
        <Reveal as="p" style={{ ...subStyle, margin: "0 0 40px", maxWidth: 520 }}>
          {a.sub}
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {a.items.map((x, i) => (
            <Reveal key={i} delay={i * 80}>
              <div
                className="lift"
                style={{
                  height: "100%",
                  background: C.card,
                  borderRadius: 20,
                  padding: "28px 30px",
                  border: `1px solid ${C.line}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "oklch(0.955 0.008 85)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ ...ADV_SHAPES[i], background: C.accent }} />
                  </div>
                  <h3 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{x.t}</h3>
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.65, color: C.body, margin: 0, fontWeight: 300 }}>{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CatalogTabs({ idx, go, products }) {
  const ref = useRef(null);
  const [m, setM] = useState({ frac: 1, ratio: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !el.scrollWidth) return;
    const frac = el.clientWidth / el.scrollWidth;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = max > 0 ? el.scrollLeft / max : 0;
    setM((p) => (Math.abs(p.frac - frac) > 0.005 || Math.abs(p.ratio - ratio) > 0.005 ? { frac, ratio } : p));
  }, []);

  useLayoutEffect(() => {
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Підписи табів різної довжини в різних мовах — перемірюємо після зміни мови.
  useLayoutEffect(() => {
    measure();
  }, [products, measure]);

  // Активний таб завжди тримаємо у видимій зоні.
  useEffect(() => {
    const el = ref.current;
    const btn = el?.children[idx];
    if (!el || !btn || m.frac >= 0.97) return;
    const left = btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
  }, [idx, m.frac]);

  const fits = m.frac >= 0.97;
  const fadeL = fits ? 0 : Math.min(1, Math.max(0, m.ratio / 0.12));
  const fadeR = fits ? 0 : Math.min(1, Math.max(0, (1 - m.ratio) / 0.12));

  const seekTo = (track, clientX) => {
    const el = ref.current;
    if (!el) return;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    el.scrollLeft = p * (el.scrollWidth - el.clientWidth);
    measure();
  };

  const onTrackDown = (e) => {
    const track = e.currentTarget;
    e.preventDefault();
    document.body.style.userSelect = "none";
    seekTo(track, e.clientX);
    const move = (ev) => {
      if (ev.buttons === 0) return up();
      ev.preventDefault();
      seekTo(track, ev.clientX);
    };
    const up = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
  };

  const fade = (dir, op) => ({
    opacity: op,
    transition: "opacity 260ms ease",
    position: "absolute",
    top: -2,
    bottom: 2,
    [dir]: 0,
    width: 24,
    pointerEvents: "none",
    zIndex: 2,
    background: `linear-gradient(${dir === "left" ? 90 : 270}deg, rgba(243,239,231,1), rgba(243,239,231,0))`,
  });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative" }}>
        <div style={fade("left", fadeL)} />
        <div style={fade("right", fadeR)} />
        <div
          ref={ref}
          onScroll={measure}
          role="tablist"
          className="noscroll"
          style={{ display: "flex", flexWrap: "nowrap", gap: 10, overflowX: "auto", padding: "2px 2px 4px" }}
        >
          {products.map((p, i) => {
            const on = i === idx;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={on}
                onClick={() => go(i)}
                style={{
                  flex: fits ? "1 1 0" : "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "none",
                  cursor: "pointer",
                  padding: "13px 18px",
                  borderRadius: 16,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  fontFamily: DISPLAY,
                  transition: "background 260ms ease, color 260ms ease, box-shadow 260ms ease",
                  background: on ? C.ink : C.card,
                  color: on ? C.onDark : C.text2,
                  boxShadow: on ? "none" : `inset 0 0 0 1px ${C.line}`,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.tab}</span>
              </button>
            );
          })}
        </div>
      </div>
      {!fits && (
        <div
          onPointerDown={onTrackDown}
          style={{ marginTop: 8, height: 10, padding: "3px 0", cursor: "pointer", borderRadius: 999, background: "oklch(0.9 0.009 84)", overflow: "hidden", touchAction: "none" }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              background: C.accent,
              width: `${Math.round(m.frac * 100)}%`,
              transform: `translateX(${Math.round(m.ratio * (100 / Math.max(m.frac, 0.01) - 100))}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* Галерея фото формату: фото фіксованого розміру по центру (не на весь екран), мініатюри — завжди по центру знизу. */
function Gallery({ title, photos, alt, start, onClose, isMobile }) {
  const { t } = useT();
  const c = t.catalog;
  const [i, setI] = useState(start);
  const n = photos.length;
  const step = useCallback((d) => setI((v) => (v + d + n) % n), [n]);
  const touchX = useRef(null);
  const thumbsRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, step]);

  // Активна мініатюра — завжди у видимій зоні
  useEffect(() => {
    thumbsRef.current?.children[i]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [i]);

  const stop = (e) => e.stopPropagation();
  // Десктоп: стрілки поверх фото по краях. Мобільний: окремим рядком під фото — не закривають знімок.
  const navBtn = (dir) => (
    <button
      onClick={(e) => {
        stop(e);
        step(dir);
      }}
      aria-label={dir < 0 ? c.prevPhoto : c.nextPhoto}
      className="h-white"
      style={{
        ...(!isMobile && { position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 16, transform: "translateY(-50%)" }),
        width: isMobile ? 52 : 48,
        height: isMobile ? 44 : 48,
        borderRadius: 14,
        border: "none",
        background: "oklch(1 0 0 / 0.95)",
        color: C.ink,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );

  // Фіксована рамка: однакова для всіх фото, вписується в екран і не розтягується на весь
  const frameW = isMobile ? "calc(100vw - 32px)" : "min(880px, calc(100vw - 80px))";
  const frameH = isMobile ? "min(48vh, 400px)" : "min(62vh, 560px)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${c.gallery}: ${title}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "oklch(0.16 0.01 80 / 0.94)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 16 : "28px 40px",
      }}
    >
      <div onClick={stop} style={{ width: frameW, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, color: "oklch(0.97 0.006 85)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "oklch(0.75 0.11 45)" }}>{c.gallery}</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, color: "oklch(0.8 0.01 80)" }}>
              {i + 1} / {n}
            </span>
            <button
              onClick={onClose}
              aria-label={c.close}
              className="h-gal-close"
              style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "oklch(1 0 0 / 0.1)", color: "oklch(0.97 0.006 85)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ display: "block" }}>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
          style={{
            position: "relative",
            height: frameH,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* key — щоб кожне фото плавно проявлялось, а не «перестрибувало» */}
          <Photo key={photos[i]} id={photos[i]} alt={`${alt} — ${i + 1}`} fit="contain" style={{ position: "absolute", inset: 0, background: "transparent" }} />
          {n > 1 && !isMobile && navBtn(-1)}
          {n > 1 && !isMobile && navBtn(1)}
        </div>

        {n > 1 && isMobile && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            {navBtn(-1)}
            {navBtn(1)}
          </div>
        )}

        {/* Мініатюри: ряд завжди по центру; якщо не вміщаються — гортаються */}
        <div className="noscroll" style={{ overflowX: "auto", display: "flex", padding: 2 }}>
          <div ref={thumbsRef} style={{ display: "flex", gap: 10, margin: "0 auto", flexShrink: 0 }}>
            {photos.map((id, k) => (
              <button
                key={k}
                onClick={() => setI(k)}
                aria-label={`${c.photo} ${k + 1}`}
                aria-current={k === i}
                style={{
                  flex: "0 0 auto",
                  width: isMobile ? 64 : 96,
                  height: isMobile ? 48 : 64,
                  borderRadius: 12,
                  border: `2px solid ${k === i ? "oklch(0.75 0.11 45)" : "transparent"}`,
                  opacity: k === i ? 1 : 0.55,
                  padding: 0,
                  cursor: "pointer",
                  overflow: "hidden",
                  background: "oklch(0.3 0.012 80)",
                  transition: "opacity 200ms ease, border-color 200ms ease",
                }}
              >
                <img src={src(id)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Catalog({ isMobile }) {
  const { t } = useT();
  const c = t.catalog;
  const products = c.products;
  const [idx, setIdx] = useState(0);
  const [gallery, setGallery] = useState(false);
  const closeGallery = useCallback(() => setGallery(false), []);
  const touchX = useRef(null);
  const n = products.length;
  const go = useCallback((next) => setIdx(((next % n) + n) % n), [n]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (gallery || tag === "INPUT" || tag === "TEXTAREA") return; // у галереї стрілки гортають фото
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go, gallery]);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  const arrowBtn = (dir, label) => (
    <button
      onClick={() => go(idx + dir)}
      aria-label={label}
      className="h-arrow"
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        color: "oklch(0.25 0.01 80)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );

  return (
    <section id="catalog" style={{ marginTop: 96, padding: `88px ${PAD_H}`, background: C.bgAlt }}>
      <div style={wrap}>
        <Reveal style={{ marginBottom: 24 }}>
          <div style={eyebrowStyle}>{c.eyebrow}</div>
          <Title accent={c.accent}>{c.title}</Title>
          <p style={{ ...subStyle, maxWidth: 560 }}>{c.sub}</p>
        </Reveal>

        <CatalogTabs idx={idx} go={go} products={products} />

        <Reveal style={{ position: "relative", border: `1px solid ${C.line}`, borderRadius: 24, overflow: "hidden", background: C.card }}>
          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", width: "100%", transition: "transform 560ms cubic-bezier(0.4, 0, 0.15, 1)", transform: `translateX(-${idx * 100}%)` }}>
              {products.map((p, i) => (
                <article
                  key={i}
                  aria-hidden={i !== idx}
                  style={{
                    minWidth: "100%",
                    display: "grid",
                    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 0.9fr) minmax(0, 1.1fr)",
                    alignItems: "stretch",
                  }}
                >
                  <div onClick={() => setGallery(true)} style={{ position: "relative", minWidth: 0, minHeight: 240, cursor: "zoom-in" }}>
                    <Photo id={PRODUCT_PHOTOS[i]} alt={p.alt} style={{ position: "absolute", inset: 0 }} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGallery(true);
                      }}
                      tabIndex={i === idx ? 0 : -1}
                      aria-label={c.morePhotos}
                      className="h-lift"
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        height: 40,
                        padding: "0 14px 0 12px",
                        borderRadius: 12,
                        border: "none",
                        background: "oklch(1 0 0 / 0.96)",
                        cursor: "pointer",
                        fontFamily: DISPLAY,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "oklch(0.25 0.01 80)",
                        boxShadow: "0 4px 14px oklch(0.2 0.01 80 / 0.08)",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                      {c.photosCount(PRODUCT_GALLERIES[i].length)}
                    </button>
                  </div>
                  <div style={{ minWidth: 0, padding: isMobile ? "28px 24px" : 36, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>{p.note}</span>
                    <h3 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 10px" }}>{p.name}</h3>
                    <p style={{ fontSize: 17, lineHeight: 1.65, color: C.body, margin: "0 0 24px", fontWeight: 300, maxWidth: 480 }}>{p.desc}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
                      {p.tags.map((tg) => (
                        <span key={tg} style={{ padding: "8px 14px", borderRadius: 999, background: C.chip, fontSize: 14, color: C.text2 }}>{tg}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "16px 28px" : 32, marginBottom: 18 }}>
                      {p.stats.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16 }}>
                          <span style={{ color: C.soft, fontWeight: 300, fontSize: 14 }}>{k}</span>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ position: "relative", marginTop: "auto", display: "flex", alignItems: "center", gap: 20, paddingTop: 20, borderTop: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 23, fontWeight: 700, letterSpacing: "-0.03em", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {p.price}
                        {p.priceSuffix && <span style={{ fontSize: 14, fontWeight: 400, color: C.soft }}> {p.priceSuffix}</span>}
                      </div>
                      <a href="#order" tabIndex={i === idx ? 0 : -1} className="h-dark" style={{ ...darkBtn, marginLeft: "auto" }}>{p.cta}</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Стрілки — один блок поверх слайдів, не їде разом із фото.
              Десктоп: лівий нижній кут фото-колонки. Мобільний: лівий нижній кут фото (вгорі праворуч — кнопка галереї). */}
          <div
            style={{
              position: "absolute",
              ...(isMobile ? { top: 240 - 16 - 48, left: 16 } : { left: 32, bottom: 32 }),
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 4,
              borderRadius: 999,
              background: "oklch(1 0 0 / 0.96)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: `1px solid ${C.line}`,
              boxShadow: "0 4px 16px oklch(0.2 0.01 80 / 0.08)",
              zIndex: 3,
            }}
          >
            {arrowBtn(-1, c.prev)}
            <span style={{ width: 1, height: 18, background: "oklch(0.93 0.008 84)" }} />
            {arrowBtn(1, c.next)}
          </div>
        </Reveal>
      </div>
      {gallery && (
        <Gallery
          key={idx}
          title={products[idx].name}
          photos={PRODUCT_GALLERIES[idx]}
          alt={products[idx].alt}
          start={0}
          onClose={closeGallery}
          isMobile={isMobile}
        />
      )}
    </section>
  );
}

function FaqItem({ q, a, on, onToggle }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "18px 22px" }}>
      <button
        onClick={onToggle}
        aria-expanded={on}
        className="h-faq"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: DISPLAY,
          fontSize: 16,
          fontWeight: 600,
          color: on ? "oklch(0.55 0.13 45)" : C.ink,
          transition: "color 300ms ease",
        }}
      >
        <span style={{ flex: 1 }}>{q}</span>
        {/* Один «+», який повертається на 45° і стає «×» */}
        <span
          className="faq-icon"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: `background 300ms ease, color 300ms ease, transform 460ms ${EASE_OUT}`,
            transform: on ? "rotate(45deg)" : "none",
            background: on ? C.accent : "oklch(0.96 0.008 85)",
            color: on ? "oklch(0.99 0.005 85)" : "oklch(0.4 0.01 80)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: "block" }}>
            <path d="M6 1v10M1 6h10" />
          </svg>
        </span>
      </button>
      {/* grid-template-rows 0fr → 1fr анімує реальну висоту відповіді, тож немає «доїзду» до фіксованого max-height і різкої зупинки */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: on ? "1fr" : "0fr",
          transition: `grid-template-rows 460ms ${EASE_OUT}`,
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: C.body,
              fontWeight: 300,
              margin: "14px 0 4px",
              opacity: on ? 1 : 0,
              transform: on ? "none" : "translateY(-6px)",
              transition: on
                ? `opacity 360ms ease 80ms, transform 460ms ${EASE_OUT} 40ms`
                : "opacity 200ms ease, transform 300ms ease",
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

function Faq({ isMobile }) {
  const { t } = useT();
  const f = t.faq;
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={section()}>
      <div style={wrap}>
        <Reveal style={eyebrowStyle}>{f.eyebrow}</Reveal>
        <Title accent={f.accent} style={{ marginBottom: 28 }}>{f.title}</Title>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1.15fr) minmax(0, 0.85fr)", gap: 24, alignItems: "stretch" }}>
          <Reveal style={{ display: "grid", gap: 10, alignContent: "start" }}>
            {f.items.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} on={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: C.card,
                border: `1px solid ${C.accent}`,
                borderRadius: 16,
                padding: "18px 22px",
                flexWrap: isMobile ? "wrap" : "nowrap",
              }}
            >
              <div style={{ minWidth: 0, flex: isMobile ? "1 1 220px" : "0 1 auto" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{f.ctaTitle}</div>
                <div style={{ fontSize: 15, color: C.muted, fontWeight: 300 }}>{f.ctaText}</div>
              </div>
              <a href="#order" className="h-dark" style={{ ...darkBtn, marginLeft: "auto", flexShrink: 0 }}>{f.ctaBtn}</a>
            </div>
          </Reveal>
          <Reveal delay={80} style={{ order: isMobile ? -1 : 1, height: isMobile ? 180 : "100%", minHeight: isMobile ? 180 : "100%" }}>
            <Photo id={IMG.medium} alt={f.photoAlt} radius={20} style={{ height: "100%" }} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function UseCases({ isMobile }) {
  const { t } = useT();
  const u = t.useCases;
  return (
    <section id="use-cases" style={section()}>
      <div style={wrap}>
        <Reveal style={{ marginBottom: 20 }}>
          <div style={eyebrowStyle}>{u.eyebrow}</div>
          <Title accent={u.accent}>{u.title}</Title>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: C.body, margin: 0, fontWeight: 300, maxWidth: 520 }}>{u.sub}</p>
        </Reveal>
        <Reveal delay={60} style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: isMobile ? 12 : 16, marginTop: 28 }}>
          {u.items.map((x, i) => (
            <div
              key={i}
              style={{
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 20,
                padding: isMobile ? "20px 18px 22px" : "32px 32px 34px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* На мобільному 2 колонки вузькі — іконка над заголовком (useIconDir з дизайну) */}
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: 14 }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: C.accentTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, background: C.accent }} />
                </span>
                <span style={{ fontFamily: DISPLAY, fontSize: isMobile ? 16 : 19, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.3 }}>{x.t}</span>
              </div>
              <p style={{ fontSize: isMobile ? 14 : 16, lineHeight: 1.65, color: "oklch(0.47 0.01 80)", margin: 0, fontWeight: 300 }}>{x.d}</p>
            </div>
          ))}
        </Reveal>
        <Reveal delay={100} style={{ marginTop: 32 }}>
          <Photo id={IMG.large} alt={u.photoAlt} radius={20} style={{ height: 300 }} />
        </Reveal>
      </div>
    </section>
  );
}

function Process({ isMobile }) {
  const { t } = useT();
  const p = t.process;
  const chip = (label, small) => (
    <span
      style={{
        flexShrink: 0,
        padding: small ? "5px 11px" : "6px 12px",
        borderRadius: 999,
        background: C.accentTint,
        color: "oklch(0.48 0.13 45)",
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
  return (
    <section id="process" style={section()}>
      <div style={wrap}>
        <Reveal style={{ marginBottom: 44 }}>
          <div style={eyebrowStyle}>{p.eyebrow}</div>
          <Title accent={p.accent}>{p.title}</Title>
          <p style={{ ...subStyle, maxWidth: 560 }}>{p.sub}</p>
        </Reveal>
        <Reveal delay={60} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {p.steps.map((s, i) => (
            <div key={i} style={{ position: "relative", background: C.card, borderRadius: 20, padding: "28px 26px", border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px 12px", minWidth: 0 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "oklch(0.93 0.05 45)",
                    color: "oklch(0.48 0.13 45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: DISPLAY,
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <h3 style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3, flex: "1 1 140px", minWidth: 0, margin: 0 }}>{s.t}</h3>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: C.body, margin: 0, fontWeight: 300 }}>{s.d}</p>
              {/* Термін — завжди під описом зліва: праворуч від заголовка у вузькій картці він переносився й «висів» */}
              <span style={{ alignSelf: "flex-start", marginTop: "auto" }}>{chip(s.time, isMobile)}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function Quality({ isMobile }) {
  const { t } = useT();
  const q = t.quality;
  return (
    <section id="quality" style={section()}>
      <Reveal style={{ ...wrap, background: C.ink, borderRadius: 24, padding: isMobile ? "32px 24px" : "40px 36px", color: C.onDark }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1.1fr)", gap: isMobile ? 32 : 56, alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 26, lineHeight: 1.12, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 14px" }}>{q.title}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: C.onDarkSoft, margin: 0, fontWeight: 300 }}>{q.text}</p>
          </div>
          {/* minmax(0, 1fr): інакше довгий підпис не дає колонці стиснутись і ряд вилазить за край картки */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: isMobile ? 10 : 14 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ minWidth: 0, aspectRatio: "3 / 4", borderRadius: 14, background: "oklch(0.26 0.01 80)", display: "flex", alignItems: "flex-end", padding: isMobile ? 10 : 14 }}>
                <span style={{ minWidth: 0, fontFamily: "monospace", fontSize: isMobile ? 9 : 10, color: "oklch(0.65 0.01 80)", overflowWrap: "anywhere" }}>[{q.cert} {n}]</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function About({ isMobile }) {
  const { t } = useT();
  const a = t.about;
  const para = { fontSize: 17, lineHeight: 1.7, color: C.lead, fontWeight: 300 };
  return (
    <section id="about" style={{ marginTop: 96, padding: `88px ${PAD_H}`, background: C.bgAlt }}>
      <div style={{ ...wrap, display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: isMobile ? 32 : 72, alignItems: "center" }}>
        <Reveal>
          <div style={eyebrowStyle}>{a.eyebrow}</div>
          <Title accent={a.accent} style={{ fontSize: "clamp(32px, 3.6vw, 46px)", lineHeight: 1.06, letterSpacing: "-0.035em", margin: "0 0 22px" }}>
            {a.title}
          </Title>
          <p style={{ ...para, margin: "0 0 14px" }}>{a.p1(t.company)}</p>
          <p style={{ ...para, margin: 0 }}>{a.p2}</p>
        </Reveal>
        <Reveal delay={80} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {a.facts.map(([k, v]) => (
            <div key={k} style={{ background: C.card, borderRadius: 16, padding: isMobile ? "16px 20px" : "18px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <span style={{ fontSize: 15, color: C.body, fontWeight: 300 }}>{k}</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function OrderForm({ isMobile }) {
  const { t } = useT();
  const o = t.order;
  const empty = { name: "", phone: "", email: "", note: "", website: "" };
  const [f, setF] = useState(empty);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null); // код помилки: name | contact | phone | email | send
  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    if (err) setErr(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const { error } = validateLead(f);
    if (error) return setErr(error);
    setErr(null);
    setSending(true);
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || r.status);
      setSent(true);
    } catch {
      setErr("send");
    } finally {
      setSending(false);
    }
  };

  const errText = { name: o.errName, contact: o.errContact, phone: o.errPhone, email: o.errEmail, send: o.errSend }[err];
  // Підсвічуємо саме ті поля, через які форма не пройшла.
  const bad = (k) => err === k || (err === "contact" && (k === "phone" || k === "email"));
  const errBorder = "oklch(0.62 0.16 30)";

  const field = {
    padding: "13px 16px",
    borderRadius: 12,
    border: "1px solid oklch(0.91 0.008 85)",
    background: "oklch(0.985 0.006 85)",
    fontFamily: BODY,
    fontSize: 15,
    color: C.ink,
    width: "100%",
    transition: "border-color 200ms ease",
  };
  const label = { display: "grid", gap: 6, fontSize: 14, color: "oklch(0.4 0.01 80)" };

  return (
    <section id="order" style={{ padding: `96px ${PAD_H}` }}>
      <Reveal
        style={{
          ...wrap,
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <div style={{ background: C.ink, color: C.onDark, padding: isMobile ? "32px 24px" : 36, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ ...eyebrowStyle, color: "oklch(0.72 0.11 45)", marginBottom: 16 }}>{o.eyebrow}</div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 31, lineHeight: 1.12, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
            {o.title}
            <br />
            <span style={{ color: "oklch(0.75 0.11 45)" }}>{o.accent}</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: C.onDarkSoft, margin: "0 0 32px", fontWeight: 300 }}>{o.text}</p>
          <a {...phoneProps(t)} className="h-phone" style={{ fontFamily: DISPLAY, fontSize: isMobile ? 24 : "clamp(20px, 2.2vw, 30px)", fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap", color: C.onDark }}>
            {PHONE_TEXT}
          </a>
          <div style={{ fontSize: 14, color: "oklch(0.62 0.01 80)", marginTop: 10 }}>{o.hours}</div>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid oklch(1 0 0 / 0.1)" }}>
            <div style={{ fontSize: 14, color: "oklch(0.7 0.01 80)", marginBottom: 12 }}>{o.messengers}</div>
            {/* На мобільному три рівні плитки (іконка над назвою) — Viber не падає сам на другий рядок */}
            <div style={isMobile ? { display: "grid", gridTemplateColumns: `repeat(${MESSENGERS.length}, minmax(0, 1fr))`, gap: 8 } : { display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MESSENGERS.map((m) => (
                <a
                  key={m.id}
                  href={m.href}
                  {...(isExternal(m.href) && { target: "_blank", rel: "noopener noreferrer" })}
                  className="h-msg"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: isMobile ? "column" : "row",
                    gap: isMobile ? 6 : 8,
                    padding: isMobile ? "12px 4px 10px" : "10px 16px 10px 12px",
                    borderRadius: isMobile ? 16 : 999,
                    minWidth: 0,
                    background: "oklch(1 0 0 / 0.08)",
                    border: "1px solid oklch(1 0 0 / 0.12)",
                    color: C.onDark,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    "--brand": m.color,
                  }}
                >
                  <span style={{ color: m.color, display: "flex" }}>
                    <MessengerIcon m={m} />
                  </span>
                  {m.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: isMobile ? "28px 24px" : "32px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {sent ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "oklch(0.93 0.06 145)", color: "oklch(0.42 0.13 145)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✓</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{o.okTitle}</div>
              <p style={{ fontSize: 15, color: C.body, fontWeight: 300, margin: 0 }}>{o.okText(f.phone.trim(), f.email.trim())}</p>
              <button
                onClick={() => { setSent(false); setF(empty); }}
                style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.accentText, padding: 0 }}
              >
                {o.again}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate style={{ display: "grid", gap: 16 }}>
              {/* Honeypot від спам-ботів: прихований від людей і скрінрідерів */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={f.website}
                onChange={set("website")}
                style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
              />
              <label style={label}>
                {o.name}
                <input type="text" autoComplete="name" aria-invalid={bad("name")} style={{ ...field, ...(bad("name") && { borderColor: errBorder }) }} value={f.name} onChange={set("name")} placeholder={o.namePh} />
              </label>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: isMobile ? 16 : 12 }}>
                  <label style={label}>
                    {o.phone}
                    <input type="tel" autoComplete="tel" inputMode="tel" aria-invalid={bad("phone")} style={{ ...field, ...(bad("phone") && { borderColor: errBorder }) }} value={f.phone} onChange={set("phone")} placeholder={o.phonePh} />
                  </label>
                  <label style={label}>
                    {o.email}
                    <input type="email" autoComplete="email" inputMode="email" aria-invalid={bad("email")} style={{ ...field, ...(bad("email") && { borderColor: errBorder }) }} value={f.email} onChange={set("email")} placeholder={o.emailPh} />
                  </label>
                </div>
                <div style={{ fontSize: 13, color: C.soft }}>{o.contactHint}</div>
              </div>

              <label style={label}>
                {o.need}
                <textarea rows={3} style={{ ...field, resize: "vertical" }} value={f.note} onChange={set("note")} placeholder={o.needPh} />
              </label>
              {err && (
                <div role="alert" style={{ fontSize: 14, color: C.accentDeep, background: C.accentSoft, padding: "10px 14px", borderRadius: 12 }}>{errText}</div>
              )}
              <button
                type="submit"
                disabled={sending}
                className="h-accent"
                style={{
                  padding: "15px 24px",
                  borderRadius: 999,
                  border: "none",
                  cursor: sending ? "progress" : "pointer",
                  background: C.accent,
                  color: "oklch(0.99 0.005 85)",
                  fontFamily: DISPLAY,
                  fontSize: 16,
                  fontWeight: 700,
                  opacity: sending ? 0.75 : 1,
                  transition: "background 200ms ease, opacity 200ms ease",
                }}
              >
                {sending ? o.sending : o.submit}
              </button>
              <div style={{ fontSize: 13, color: C.soft, textAlign: "center" }}>{o.note}</div>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ isMobile }) {
  const { t } = useT();
  return (
    <footer style={{ padding: `28px ${PAD_H} calc(28px + env(safe-area-inset-bottom, 0px))`, borderTop: "1px solid oklch(0.93 0.006 85)" }}>
      {/* На мобільному — стовпчиком по центру: у рядку з переносом іконки й © «губились» під адресою */}
      <div
        style={{
          ...wrap,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: isMobile ? 16 : 14,
          fontSize: 13,
          color: C.muted,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: C.ink }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, color: C.ink }}>{t.company}</span>
        </div>
        <div>{t.address}</div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", gap: isMobile ? 14 : 16 }}>
          <div style={{ display: "flex", gap: isMobile ? 10 : 6 }}>
            {MESSENGERS.map((m) => (
              <a
                key={m.id}
                href={m.href}
                aria-label={m.name}
                title={m.name}
                {...(isExternal(m.href) && { target: "_blank", rel: "noopener noreferrer" })}
                className="h-foot-msg"
                style={{ width: isMobile ? 40 : 34, height: isMobile ? 40 : 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: C.card, border: `1px solid ${C.line}`, color: m.color }}
              >
                <MessengerIcon m={m} size={18} />
              </a>
            ))}
          </div>
          <div>© {new Date().getFullYear()} {t.company}</div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const isMobile = useMedia("(max-width: 819px)");
  // Від 1360px поруч із 8 пунктами меню вміщається кнопка з повним номером телефону.
  const isWide = useMedia("(min-width: 1360px)");
  const [lang, setLangState] = useState(readLang);
  const t = T[lang];

  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  }, []);

  // Якірні посилання (#catalog, #order…) прокручують сторінку, але не дописують хештег в адресу:
  // при прокрутці він не оновлювався й лише плутав. Якщо сторінку відкрили з хештегом — прибираємо його.
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      history.replaceState(null, "", location.pathname + location.search);
      // Після шрифтів — інакше висота блоків ще зміниться й розділ «з'їде»
      if (el) Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => el.scrollIntoView({ block: "start" })));
    }
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      const el = id === "top" ? null : document.getElementById(id);
      if (id !== "top" && !el) return;
      e.preventDefault();
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [lang, t]);

  return (
    <LangCtx.Provider value={{ t, lang, setLang }}>
      <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, width: "100%", overflowX: "clip" }}>
        <style>{CSS}</style>
        <Header isMobile={isMobile} isWide={isWide} />
        <main>
          <Hero isMobile={isMobile} />
          <PhotoStats isMobile={isMobile} />
          <Marquee />
          <Advantages isMobile={isMobile} />
          <Catalog isMobile={isMobile} />
          {/* «Як працюємо»: кроки → під які задачі → питання */}
          <Process isMobile={isMobile} />
          <UseCases isMobile={isMobile} />
          <Faq isMobile={isMobile} />
          <Quality isMobile={isMobile} />
          <About isMobile={isMobile} />
          <OrderForm isMobile={isMobile} />
        </main>
        <Footer isMobile={isMobile} />
        <Toast />
      </div>
    </LangCtx.Provider>
  );
}
