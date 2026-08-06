import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   ЗАГЛУШКА — дерев'яні ящики. Стиль v2.
   ============================================================ */

const C = {
  bg: "oklch(0.985 0.006 85)",
  bgAlt: "oklch(0.955 0.008 85)",
  card: "oklch(1 0 0)",
  ink: "oklch(0.2 0.01 80)",
  inkHover: "oklch(0.32 0.01 80)",
  body: "oklch(0.45 0.01 80)",
  muted: "oklch(0.5 0.01 80)",
  soft: "oklch(0.55 0.01 80)",
  line: "oklch(0.93 0.006 85)",
  accent: "oklch(0.62 0.13 45)",
  accentDeep: "oklch(0.5 0.13 45)",
  accentSoft: "oklch(0.93 0.06 45)",
  accentText: "oklch(0.42 0.13 45)",
  green: "oklch(0.72 0.15 145)",
  onDark: "oklch(0.985 0.006 85)",
  onDarkSoft: "oklch(0.78 0.01 80)",
};

const DISPLAY = "'Sora', sans-serif";
const BODY = "'Public Sans', sans-serif";

/* ============================================================
   ВАРІАНТИ СТОРІНКИ
   contact: "form"  — секція із зворотною формою
            "phone" — тільки номер телефону
   SHOW_SWITCHER — плаваючий перемикач для показу клієнту.
                   Перед здачею в прод постав false.
   ============================================================ */
const DEFAULT_VARIANT = { contact: "form" };
const SHOW_SWITCHER = true; // true — лишити для демонстрації клієнту, false — для продакшну

/* ============================================================
   ДАНІ КОМПАНІЇ — обов'язково замінити перед публікацією
   ============================================================ */
const PHONE_HREF = "tel:+380000000000"; // TODO: реальний номер, формат tel:+380XXXXXXXXX
const PHONE_TEXT = "+38 (000) 000-00-00"; // TODO: той самий номер у зручному для читання форматі
const COMPANY_NAME = "Заглушка"; // TODO: назва компанії
const COMPANY_ADDRESS = "м. Місто, вул. Прикладна, 1"; // TODO: реальна адреса
const PRODUCTION_AREA = "[м²]"; // TODO: площа власного виробництва, напр. "2 400 м²"

/* Локальні фото — public/images/. Завантажуються один раз скриптом
   scripts/fetch-images.mjs (npm run fetch:images), див. README. */
const IMG = {
  warehouse: "warehouse",
  wineBoxes: "small-crates",
  apples: "medium-crates",
  planks: "custom-crates",
  timber: "large-crates",
};

const src = (id) => `/images/${id}.jpg`;

/* ---------- утиліти ---------- */

const fmt = (n) => new Intl.NumberFormat("uk-UA").format(Math.round(n));

function useMedia(q) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function useReveal(threshold = 0.15) {
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
      { threshold, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on];
}

function Reveal({ children, delay = 0, y = 28, style, as: Tag = "div", ...rest }) {
  const [ref, on] = useReveal();
  return (
    <Tag
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : `translate3d(0,${y}px,0)`,
        transition: `opacity 800ms cubic-bezier(.16,1,.3,1) ${delay}ms, transform 800ms cubic-bezier(.16,1,.3,1) ${delay}ms`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function CountUp({ to, suffix = "", duration = 1600 }) {
  const [ref, on] = useReveal(0.4);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(to);
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, duration]);
  return (
    <span ref={ref}>
      {fmt(v)}
      {suffix}
    </span>
  );
}

/* ---------- фото з плавною появою ---------- */

function Photo({ id, alt, w = 1400, h, ratio, radius = 0, zoom = true, style, imgStyle }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={zoom ? "ph-wrap" : ""}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        background: C.bgAlt,
        aspectRatio: ratio,
        ...style,
      }}
    >
      <div
        className="shimmer"
        style={{
          position: "absolute",
          inset: 0,
          opacity: loaded ? 0 : 1,
          transition: "opacity 500ms",
        }}
      />
      <img
        src={src(id, w, h)}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={zoom ? "ph-img" : ""}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 700ms ease, transform 900ms cubic-bezier(.16,1,.3,1)",
          ...imgStyle,
        }}
      />
    </div>
  );
}

/* ---------- дані ---------- */

const PRODUCTS = [
  {
    id: "small",
    name: "Малі ящики",
    note: "Ручне перенесення",
    size: "20–30 см",
    load: "до 10 кг",
    min: 10,
    price: 45,
    lead: "3–5 днів",
    photo: IMG.wineBoxes,
    alt: "Малі дерев'яні ящики",
    desc:
      "Компактний формат для дрібного пакування та комплектуючих. Легко штабелюються, зручні для ручного перенесення.",
    fits: ["Ягоди й зелень", "Комплектуючі", "Подарункове пакування"],
  },
  {
    id: "medium",
    name: "Середні ящики",
    note: "Найчастіше замовляють",
    size: "30–40 см",
    load: "до 25 кг",
    min: 10,
    price: 65,
    lead: "3–7 днів",
    photo: IMG.apples,
    alt: "Середні дерев'яні ящики з яблуками",
    desc:
      "Універсальний робочий формат: овочі, фрукти, деталі, інструмент. Найпопулярніша позиція серед постійних клієнтів.",
    fits: ["Овочі та фрукти", "Інструмент", "Складське зберігання"],
  },
  {
    id: "large",
    name: "Великі ящики",
    note: "Посилена конструкція",
    size: "від 50 см",
    load: "до 80 кг",
    min: 5,
    price: 110,
    lead: "5–10 днів",
    photo: IMG.timber,
    alt: "Великі тарні дерев'яні ящики",
    desc:
      "Формат від пів метра для транспортування та зберігання важких вантажів. Посилена конструкція витримує багаторазове використання.",
    fits: ["Обладнання", "Металовироби", "Міжміська логістика"],
  },
  {
    id: "custom",
    name: "Під ваш розмір",
    note: "За вашим кресленням",
    size: "за кресленням",
    load: "за ТЗ",
    min: 20,
    price: 95,
    lead: "7–12 днів",
    photo: IMG.planks,
    alt: "Виготовлення ящиків під розмір замовника",
    desc:
      "Виготовимо ящик під конкретний вузол, палету чи стелаж. Надішліть розміри або креслення — прорахуємо й зробимо зразок.",
    fits: ["Нестандартні вузли", "Під палету", "Під стелаж"],
  },
];


const INDUSTRIES = [
  "Агропідприємства",
  "Логістика",
  "Овочесховища",
  "Меблеві цехи",
  "Металообробка",
  "Фермерські господарства",
  "Виноробні",
  "Пасіки",
  "Пакувальні компанії",
];

const STEPS = [
  { t: "Дзвінок або заявка", d: "Кажете розмір, орієнтовний об'єм і куди везти. Не знаєте розмір — підберемо за вашим вантажем.", time: "5 хв" },
  { t: "Прорахунок і зразок", d: "Даємо точну ціну та дату відвантаження. За потреби надсилаємо зразок перед стартом партії.", time: "до 24 год" },
  { t: "Виробництво", d: "Розкрій, сушіння, збірка, контроль вологості й міцності. Тримаємо дату, узгоджену на старті.", time: "3–10 днів" },
  { t: "Відвантаження", d: "Пакуємо на палети, передаємо перевізнику або своїм транспортом. Документи — разом із партією.", time: "у день готовності" },
];

const CASES = [
  { t: "Овочі та фрукти", d: "Вентильовані стінки, безпечно для харчових продуктів." },
  { t: "Складське зберігання", d: "Штабелюються без деформації, витримують сезон за сезоном." },
  { t: "Міжміська логістика", d: "Посилені кути й дно — вантаж доїжджає цілим." },
  { t: "Обладнання й деталі", d: "Конструкція під конкретну вагу та габарит." },
  { t: "Фірмове маркування", d: "Охайний вигляд, можна нанести логотип чи маркування." },
  { t: "Експорт", d: "Пакет документів на партію, палетне пакування." },
];

const FAQ = [
  { q: "Яка мінімальна партія?", a: "Від 5 штук для великих ящиків і від 10 — для малих і середніх. На нестандартні розміри мінімум — 20 штук, бо потрібне окреме налаштування розкрою." },
  { q: "Скільки чекати замовлення?", a: "Типово 3–7 днів. Великі партії та нестандарт — до 12 днів. Точну дату називаємо на етапі прорахунку й фіксуємо її в домовленості." },
  { q: "Чи можна зробити ящик під мій розмір?", a: "Так. Надішліть габарити вантажу або креслення — прорахуємо конструкцію, зробимо зразок і тільки після вашого «ок» запускаємо партію." },
  { q: "Яка деревина використовується?", a: "Хвойні породи камерного сушіння. Контролюємо вологість перед збіркою, тому ящик не веде й не розсихається на складі." },
  { q: "Ви доставляєте?", a: "Так, по всій Україні. Відвантажуємо на палетах перевізником або власним транспортом — залежно від об'єму та напрямку." },
  { q: "Як оплатити?", a: "Готівкою або безготівково з ПДВ. Для постійних клієнтів — відтермінування платежу за окремою домовленістю." },
];

/* ---------- глобальні стилі ---------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Public+Sans:wght@300;400;500;600&display=swap');

* { box-sizing: border-box; }
body { margin: 0; background: ${C.bg}; }
::selection { background: oklch(0.88 0.08 45); }
html { scroll-behavior: smooth; }

.shimmer {
  background: linear-gradient(100deg, ${C.bgAlt} 30%, oklch(0.975 0.008 85) 50%, ${C.bgAlt} 70%);
  background-size: 220% 100%;
  animation: shim 1.6s linear infinite;
}
@keyframes shim { from { background-position: 160% 0; } to { background-position: -60% 0; } }

.ph-wrap:hover .ph-img { transform: scale(1.045); }

@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.marquee-track { animation: marquee 38s linear infinite; }

.lift { transition: transform 420ms cubic-bezier(.16,1,.3,1), box-shadow 420ms cubic-bezier(.16,1,.3,1); }
.lift:hover { transform: translateY(-6px); box-shadow: 0 16px 44px oklch(0.2 0.01 80 / .09); }

.btn { transition: transform 240ms cubic-bezier(.16,1,.3,1), background 240ms, box-shadow 240ms, color 240ms; }
.btn:hover { transform: translateY(-2px); }
.btn:active { transform: translateY(0); }

.nav-a { transition: background 260ms, color 260ms; }
.nav-a:hover { background: ${C.card}; color: ${C.ink} !important; }

input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
input[type=range]::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: ${C.bgAlt}; }
input[type=range]::-moz-range-track { height: 6px; border-radius: 999px; background: ${C.bgAlt}; }
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 26px; height: 26px; border-radius: 50%;
  background: ${C.card}; border: 7px solid ${C.accent}; margin-top: -10px; cursor: grab;
  box-shadow: 0 3px 12px oklch(0.2 0.01 80 / .2); transition: transform 200ms;
}
input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.12); }
input[type=range]::-moz-range-thumb {
  width: 26px; height: 26px; border-radius: 50%; background: ${C.card};
  border: 7px solid ${C.accent}; cursor: grab; box-shadow: 0 3px 12px oklch(0.2 0.01 80 / .2);
}

.fi { transition: border-color 240ms, box-shadow 240ms; }
.fi:focus { border-color: ${C.accent}; box-shadow: 0 0 0 4px ${C.accentSoft}; }

a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2.5px solid ${C.accent}; outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
`;

/* ---------- базові компоненти ---------- */

function Btn({ children, href, onClick, variant = "dark", size = "md", style, ...rest }) {
  const pads = { sm: "13px 24px", md: "16px 30px", lg: "19px 36px" };
  const fs = { sm: 14, md: 15, lg: 16 };
  const v = {
    dark: { background: C.ink, color: C.onDark, boxShadow: "none" },
    accent: { background: C.accent, color: "oklch(0.99 0.005 85)", boxShadow: "0 6px 20px oklch(0.62 0.13 45 / .28)" },
    white: { background: C.card, color: C.ink, boxShadow: "0 1px 3px oklch(0.2 0.01 80 / .1)" },
  }[variant];
  const Tag = href ? "a" : "button";
  return (
    <Tag
      className="btn"
      href={href}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: pads[size],
        borderRadius: 999,
        border: "none",
        fontFamily: BODY,
        fontWeight: 600,
        fontSize: fs[size],
        letterSpacing: "0.01em",
        textDecoration: "none",
        cursor: "pointer",
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function Eyebrow({ children, dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: C.accent }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: dark ? C.onDarkSoft : C.accentText,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub, dark, align = "left", max = 640 }) {
  return (
    <Reveal style={{ marginBottom: 56, textAlign: align }}>
      <div style={{ display: "inline-block", textAlign: "left" }}>{eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}</div>
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: "clamp(29px, 4.6vw, 46px)",
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          margin: 0,
          color: dark ? C.onDark : C.ink,
          maxWidth: align === "center" ? "100%" : max,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: dark ? C.onDarkSoft : C.muted,
            margin: "16px 0 0",
            marginLeft: align === "center" ? "auto" : 0,
            marginRight: align === "center" ? "auto" : 0,
            maxWidth: 540,
            fontWeight: 300,
          }}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}

/* ============================================================
   СЕКЦІЇ
   ============================================================ */

function Header({ isMobile }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 16);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const links = [
    ["#advantages", "Переваги"],
    ["#catalog", "Каталог"],
    ["#process", "Як працюємо"],
    ["#quality", "Якість"],
    ["#faq", "Питання"],
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        padding: isMobile ? "14px 20px" : "20px 40px",
        background: scrolled ? "oklch(0.985 0.006 85 / 0.82)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        transition: "background 400ms",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: C.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="6" width="20" height="14" rx="1.5" fill="none" stroke={C.onDark} strokeWidth="2" />
              <path d="M2 11h20" stroke={C.onDark} strokeWidth="1.8" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.01em",
              color: C.ink,
            }}
          >
            {COMPANY_NAME}
          </span>
        </a>

        {!isMobile && (
          <nav
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              padding: 6,
              borderRadius: 999,
              background: C.bgAlt,
            }}
          >
            {links.map(([h, t]) => (
              <a
                key={h}
                href={h}
                className="nav-a"
                style={{
                  color: "oklch(0.35 0.01 80)",
                  fontWeight: 500,
                  fontSize: 14,
                  padding: "10px 18px",
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {t}
              </a>
            ))}
          </nav>
        )}

        <Btn href={PHONE_HREF} size="sm" variant="dark" style={{ whiteSpace: "nowrap" }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: C.green,
              boxShadow: `0 0 0 3px oklch(0.72 0.15 145 / .25)`,
            }}
          />
          {isMobile ? "Дзвінок" : PHONE_TEXT}
        </Btn>
      </div>
    </header>
  );
}

function Hero({ isMobile, variant }) {
  return (
    <section id="top" style={{ padding: isMobile ? "40px 20px 60px" : "80px 40px 110px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <Reveal
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px 8px 10px",
            borderRadius: 999,
            background: C.card,
            boxShadow: "0 1px 3px oklch(0.2 0.01 80 / .06)",
            fontSize: 13,
            color: "oklch(0.4 0.01 80)",
            marginBottom: isMobile ? 26 : 40,
          }}
        >
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: C.accentSoft,
              color: C.accentText,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Своє виробництво
          </span>
          Сушіння, розкрій і збірка — на одній ділянці
        </Reveal>

        <Reveal delay={60}>
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(38px, 7.6vw, 84px)",
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              margin: "0 0 36px",
              maxWidth: 1000,
              color: C.ink,
            }}
          >
            Ящики, на яких
            <br />
            тримається ваша
            <br />
            <span style={{ color: C.accent }}>логістика</span>
          </h1>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            gap: isMobile ? 28 : 64,
            alignItems: "end",
          }}
        >
          <Reveal delay={120}>
            <p
              style={{
                fontSize: isMobile ? 17 : 20,
                lineHeight: 1.6,
                color: "oklch(0.42 0.01 80)",
                maxWidth: 560,
                margin: 0,
                fontWeight: 300,
              }}
            >
              Виробництво дерев'яних ящиків для транспортування, зберігання та пакування.
              Стабільна якість, ціни від виробника, доставка по всій Україні.
            </p>
          </Reveal>
          <Reveal delay={180} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn href="#catalog" variant="accent" size={isMobile ? "md" : "lg"}>
              Обрати ящик
            </Btn>
            <Btn
              href={variant.contact === "form" ? "#contact" : PHONE_HREF}
              variant="white"
              size={isMobile ? "md" : "lg"}
            >
              {variant.contact === "form" ? "Залишити заявку" : PHONE_TEXT}
            </Btn>
          </Reveal>
        </div>

        <Reveal delay={140} y={40} style={{ marginTop: isMobile ? 44 : 96, position: "relative" }}>
          <Photo
            id={IMG.warehouse}
            alt="Стос дерев'яних ящиків на виробництві"
            w={1900}
            ratio={isMobile ? "4 / 3" : "21 / 9"}
            radius={isMobile ? 20 : 32}
          />
          <div
            style={{
              position: "absolute",
              left: isMobile ? 16 : 28,
              bottom: isMobile ? 16 : 28,
              background: "oklch(1 0 0 / .92)",
              backdropFilter: "blur(10px)",
              borderRadius: 999,
              padding: isMobile ? "10px 18px" : "14px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 8px 30px oklch(0.2 0.01 80 / .14)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: C.green,
                boxShadow: `0 0 0 4px oklch(0.72 0.15 145 / .2)`,
              }}
            />
            <span style={{ fontSize: isMobile ? 13 : 14.5, fontWeight: 500, color: C.ink }}>
              Виготовляємо за 3–7 днів
            </span>
          </div>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 26 : 40,
            marginTop: isMobile ? 36 : 48,
          }}
        >
          {[
            { v: 10, s: "+", l: "років на ринку" },
            { v: 50000, s: "", l: "ящиків на місяць" },
            { v: 120, s: "+", l: "постійних клієнтів" },
            { v: 7, s: " днів", l: "типовий термін" },
          ].map((x, i) => (
            <Reveal key={x.l} delay={i * 90}>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: isMobile ? 26 : 32,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: C.ink,
                }}
              >
                <CountUp to={x.v} suffix={x.s} />
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{x.l}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [...INDUSTRIES, ...INDUSTRIES];
  return (
    <section
      style={{ overflow: "hidden", padding: "26px 0", background: C.card }}
      aria-label="Галузі, для яких ми виробляємо"
    >
      <div className="marquee-track" style={{ display: "flex", width: "max-content" }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, paddingRight: 30 }}>
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "oklch(0.42 0.01 80)",
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </span>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.accent, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Advantages({ isMobile }) {
  const items = [
    {
      t: "Якість матеріалу",
      d: "Хвойна деревина камерного сушіння. Контроль вологості та міцності на кожному етапі — ящик не розсипається на другому рейсі.",
      shape: { width: 18, height: 18, borderRadius: 5 },
    },
    {
      t: "Будь-які об'єми",
      d: "Від десяти штук до регулярних вагонних поставок. Разові замовлення та довгострокові контракти з фіксованим графіком.",
      shape: { width: 18, height: 18, borderRadius: "50%" },
    },
    {
      t: "Чіткі терміни",
      d: "Узгоджуємо дату відвантаження на старті й тримаємо її. Власне виробництво — без черг у підрядників.",
      shape: { width: 18, height: 4, borderRadius: 2 },
    },
  ];
  return (
    <section id="advantages" style={{ padding: isMobile ? "70px 20px" : "110px 40px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <SectionHead
          eyebrow="Чому з нами працюють роками"
          title="Три речі, які важливіші за все інше"
          sub="Клієнти повертаються не через знижку, а через передбачуваність. Ось на чому вона тримається."
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 24 }}>
          {items.map((x, i) => (
            <Reveal
              key={x.t}
              delay={i * 120}
              className="lift"
              style={{
                background: C.card,
                borderRadius: 28,
                padding: isMobile ? "32px 28px" : 44,
                minHeight: isMobile ? "auto" : 300,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 34,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: C.bgAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ background: C.accent, ...x.shape }} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    margin: "0 0 12px",
                    color: C.ink,
                  }}
                >
                  {x.t}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: C.body, margin: 0, fontWeight: 300 }}>{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Catalog({ isMobile }) {
  const [idx, setIdx] = useState(1);
  const p = PRODUCTS[idx];

  return (
    <section id="catalog" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <SectionHead
          eyebrow="Каталог"
          title="Оберіть формат ящика"
          sub="Ціни орієнтовні й залежать від об'єму партії та розміру. Точний розрахунок називаємо за телефоном."
        />

        {/* Селектор — тільки назви. На мобільному: акуратна сітка 2×2, без горизонтального скролу. */}
        <Reveal>
          <div
            role="tablist"
            aria-label="Типи ящиків"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: isMobile ? 10 : 14,
              marginBottom: 24,
            }}
          >
            {PRODUCTS.map((x, i) => {
              const on = i === idx;
              return (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setIdx(i)}
                  className="btn"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: "none",
                    padding: isMobile ? "10px 12px 10px 10px" : 14,
                    borderRadius: isMobile ? 18 : 24,
                    background: on ? C.ink : C.card,
                    color: on ? C.onDark : C.ink,
                    boxShadow: on
                      ? "0 14px 38px oklch(0.2 0.01 80 / .22)"
                      : "0 1px 3px oklch(0.2 0.01 80 / .07)",
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? 10 : 16,
                    fontFamily: BODY,
                    minWidth: 0,
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <Photo
                      id={x.photo}
                      alt={x.alt}
                      w={220}
                      h={220}
                      radius={isMobile ? 12 : 16}
                      zoom={false}
                      style={{ width: isMobile ? 42 : 58, height: isMobile ? 42 : 58 }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: isMobile ? 14.5 : 18,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.2,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: isMobile ? "nowrap" : "normal",
                    }}
                  >
                    {x.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Панель товару */}
        <Reveal delay={80}>
          <div
            style={{
              borderRadius: isMobile ? 24 : 36,
              overflow: "hidden",
              background: C.card,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)",
            }}
          >
            <div style={{ position: "relative", minHeight: isMobile ? 240 : 520 }}>
              <Photo
                id={p.photo}
                alt={p.alt}
                w={1200}
                style={{ position: "absolute", inset: 0, height: "100%" }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  top: 20,
                  background: "oklch(1 0 0 / .9)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.ink,
                }}
              >
                Термін виготовлення: {p.lead}
              </div>
            </div>

            <div
              style={{
                padding: isMobile ? "30px 24px" : "52px 56px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: C.accent,
                  marginBottom: 18,
                }}
              >
                Дерево · {p.note}
              </div>
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: isMobile ? 30 : 40,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  margin: "0 0 18px",
                  color: C.ink,
                }}
              >
                {p.name}
              </h3>
              <p
                style={{
                  fontSize: 16.5,
                  lineHeight: 1.65,
                  color: C.body,
                  margin: "0 0 26px",
                  fontWeight: 300,
                  maxWidth: 440,
                }}
              >
                {p.desc}
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 30 }}>
                {p.fits.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 13,
                      padding: "7px 14px",
                      borderRadius: 999,
                      background: C.bgAlt,
                      color: "oklch(0.4 0.01 80)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 40, marginBottom: 34, flexWrap: "wrap" }}>
                {[
                  ["Розмір", p.size],
                  ["Навантаження", p.load],
                  ["Мін. партія", `${p.min} шт`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 13, color: C.soft, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, color: C.ink }}>{v}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 24,
                  flexWrap: "wrap",
                  paddingTop: 30,
                  borderTop: `1px solid ${C.line}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: C.soft }}>Ціна</div>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: isMobile ? 34 : 40,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: C.ink,
                      lineHeight: 1.15,
                    }}
                  >
                    від {p.price} ₴
                    <span style={{ fontSize: 16, fontWeight: 400, color: C.soft }}> / шт</span>
                  </div>
                </div>
                <Btn href="#contact" variant="accent" style={{ marginLeft: isMobile ? 0 : "auto" }}>
                  Дізнатись деталі
                </Btn>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}


function Process({ isMobile }) {
  return (
    <section id="process" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <SectionHead
          eyebrow="Порядок роботи"
          title="Від дзвінка до відвантаження"
          sub="Чотири кроки без сюрпризів. Дата, яку називаємо на другому кроці, — та сама, яку бачите на четвертому."
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 20 }}>
          {STEPS.map((s, i) => (
            <Reveal
              key={s.t}
              delay={i * 110}
              className="lift"
              style={{
                background: C.card,
                borderRadius: 28,
                padding: isMobile ? "28px 26px" : "36px 32px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: C.accentSoft,
                  color: C.accentText,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 15,
                  marginBottom: 22,
                }}
              >
                {i + 1}
              </div>
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: "0 0 10px",
                  color: C.ink,
                }}
              >
                {s.t}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.62, color: C.body, margin: "0 0 20px", fontWeight: 300 }}>
                {s.d}
              </p>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.accentText,
                  background: C.accentSoft,
                  padding: "6px 14px",
                  borderRadius: 999,
                }}
              >
                {s.time}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cases({ isMobile }) {
  return (
    <section style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "0.85fr 1.15fr",
          gap: isMobile ? 30 : 60,
          alignItems: "center",
        }}
      >
        <div>
          <SectionHead eyebrow="Для чого беруть" title="Що всередині наших ящиків" />
          <Photo
            id={IMG.apples}
            alt="Ящики з врожаєм"
            w={1000}
            ratio="4 / 3"
            radius={28}
            style={{ display: isMobile ? "none" : "block" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {CASES.map((c, i) => (
            <Reveal
              key={c.t}
              delay={i * 80}
              className="lift"
              style={{
                background: C.card,
                borderRadius: 22,
                padding: isMobile ? "24px 22px" : "28px 26px",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: C.bgAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 3, background: C.accent }} />
              </div>
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: "0 0 8px",
                  color: C.ink,
                }}
              >
                {c.t}
              </h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.body, margin: 0, fontWeight: 300 }}>{c.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quality({ isMobile }) {
  return (
    <section id="quality" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          background: C.ink,
          borderRadius: isMobile ? 24 : 36,
          padding: isMobile ? "44px 26px" : "96px 80px",
          color: C.onDark,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr",
            gap: isMobile ? 40 : 80,
            alignItems: "center",
          }}
        >
          <div>
            <SectionHead
              eyebrow="Документи"
              title="Сертифікати та якість"
              sub="Продукція відповідає стандартам пакувальних матеріалів для транспортування та зберігання. Повний пакет документів надаємо за запитом."
              dark
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[IMG.planks, IMG.timber, IMG.wineBoxes].map((im, i) => (
              <Reveal key={i} delay={i * 120} className="lift">
                <Photo id={im} alt={`Виробництво, фото ${i + 1}`} w={600} ratio="3 / 4" radius={20} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq({ isMobile, variant }) {
  const [open, setOpen] = useState(0);

  const item = (key, title, body, i, accent) => {
    const on = open === i;
    return (
      <Reveal
        key={key}
        delay={i * 60}
        style={{
          background: C.card,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: on ? "0 10px 34px oklch(0.2 0.01 80 / .08)" : "none",
          transition: "box-shadow 360ms",
          ...(accent ? { borderTop: `3px solid ${C.accent}` } : null),
        }}
      >
        <button
          onClick={() => setOpen(on ? -1 : i)}
          aria-expanded={on}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: isMobile ? "20px 22px" : "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            textAlign: "left",
            fontFamily: DISPLAY,
          }}
        >
          <span
            style={{
              fontSize: isMobile ? 16 : 18,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: on ? C.accent : C.ink,
              transition: "color 260ms",
            }}
          >
            {title}
          </span>
          <span
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              borderRadius: 999,
              background: on ? C.accent : C.bgAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 380ms cubic-bezier(.16,1,.3,1), background 260ms",
              transform: on ? "rotate(135deg)" : "none",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke={on ? "#fff" : C.ink} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        <div
          style={{
            maxHeight: on ? 320 : 0,
            opacity: on ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 480ms cubic-bezier(.16,1,.3,1), opacity 340ms",
          }}
        >
          <div style={{ padding: isMobile ? "0 22px 22px" : "0 28px 26px" }}>{body}</div>
        </div>
      </Reveal>
    );
  };

  const lastIdx = FAQ.length;

  return (
    <section id="faq" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <SectionHead eyebrow="Питання клієнтів" title="Умови співпраці" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.28fr 0.72fr",
            gap: isMobile ? 24 : 60,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {FAQ.map((f, i) =>
              item(
                f.q,
                f.q,
                <p
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.66,
                    color: C.body,
                    margin: 0,
                    fontWeight: 300,
                    maxWidth: 680,
                  }}
                >
                  {f.a}
                </p>,
                i,
                false
              )
            )}

            {/* "Не знайшли відповідь" — окрема картка, навмисно вирізняється на тлі акордеона */}
            <Reveal delay={lastIdx * 60}>
              <div
                style={{
                  background: C.card,
                  borderRadius: 20,
                  padding: isMobile ? "26px 24px" : "30px 32px",
                  borderTop: `3px solid ${C.accent}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: C.accentSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M21 11.5a8.5 8.5 0 01-12.36 7.57L4 20l1.05-4.24A8.5 8.5 0 1121 11.5z"
                      fill="none"
                      stroke={C.accentText}
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div style={{ flex: "1 1 240px" }}>
                  <h3
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      margin: "0 0 4px",
                      color: C.ink,
                    }}
                  >
                    Не знайшли відповідь?
                  </h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.body, margin: 0, fontWeight: 300 }}>
                    Опишіть вантаж — підкажемо розмір і конструкцію під ваше завдання.
                  </p>
                </div>
                {variant.contact === "form" ? (
                  <Btn href="#contact" variant="dark" size="sm" style={{ flexShrink: 0 }}>
                    Поставити питання
                  </Btn>
                ) : (
                  <a
                    href={PHONE_HREF}
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 20,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: C.ink,
                      textDecoration: "none",
                      flexShrink: 0,
                    }}
                  >
                    {PHONE_TEXT}
                  </a>
                )}
              </div>
            </Reveal>
          </div>

          {/* Фото заповнює простір праворуч замість порожнечі */}
          {!isMobile && (
            <div style={{ position: "sticky", top: 100 }}>
              <Photo id={IMG.apples} alt="Ящики з врожаєм на виробництві" w={800} ratio="3 / 4" radius={28} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}




/* ---------- Контакт: два варіанти ---------- */

function ContactForm({ isMobile }) {
  const [f, setF] = useState({ name: "", phone: "", note: "" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = useCallback(() => {
    if (!f.name.trim()) return setErr("Вкажіть імʼя, щоб знати, до кого звертатись.");
    if (f.phone.replace(/\D/g, "").length < 9) return setErr("Перевірте номер — здається, бракує цифр.");
    setErr("");
    setSent(true);
  }, [f]);

  const field = {
    width: "100%",
    padding: "15px 18px",
    background: C.bg,
    border: `1.5px solid ${C.line}`,
    borderRadius: 14,
    fontFamily: BODY,
    fontSize: 15.5,
    color: C.ink,
    outline: "none",
  };

  return (
    <section id="contact" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          borderRadius: isMobile ? 24 : 36,
          overflow: "hidden",
          background: C.card,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        <div
          style={{
            padding: isMobile ? "40px 26px" : "72px 60px",
            background: C.ink,
            color: C.onDark,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Eyebrow dark>Заявка на прорахунок</Eyebrow>
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(30px, 4.6vw, 50px)",
              lineHeight: 1.08,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              margin: "0 0 20px",
            }}
          >
            Назвемо точну ціну
            <br />
            <span style={{ color: C.accent }}>за один дзвінок</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.62, color: C.onDarkSoft, margin: "0 0 34px", fontWeight: 300 }}>
            Скажіть розмір і кількість — почуєте ціну й термін виготовлення відразу. Не знаєте
            розмір? Опишіть вантаж, підберемо самі.
          </p>
          <a
            href={PHONE_HREF}
            style={{
              fontFamily: DISPLAY,
              fontSize: isMobile ? 26 : 34,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: C.onDark,
              textDecoration: "none",
            }}
          >
            {PHONE_TEXT}
          </a>
          <div style={{ fontSize: 14.5, color: C.onDarkSoft, marginTop: 12 }}>Пн–Пт, 9:00–18:00</div>
        </div>

        <div
          style={{
            padding: isMobile ? "32px 26px" : "56px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: C.accentSoft,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke={C.accent}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: C.ink,
                  margin: "0 0 10px",
                }}
              >
                Заявку прийнято
              </h3>
              <p style={{ fontSize: 15.5, color: C.body, margin: 0, fontWeight: 300 }}>
                Передзвонимо на {f.phone} протягом 15 хвилин у робочий час.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setF({ name: "", phone: "", note: "" });
                }}
                style={{
                  marginTop: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: BODY,
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: C.accentText,
                }}
              >
                Надіслати ще одну
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13.5, color: C.muted, display: "block", marginBottom: 8 }}>Ваше імʼя</label>
                <input className="fi" style={field} value={f.name} onChange={set("name")} placeholder="Олександр" />
              </div>
              <div>
                <label style={{ fontSize: 13.5, color: C.muted, display: "block", marginBottom: 8 }}>Телефон</label>
                <input
                  className="fi"
                  style={field}
                  value={f.phone}
                  onChange={set("phone")}
                  placeholder="+38 (0__) ___-__-__"
                  inputMode="tel"
                />
              </div>
              <div>
                <label style={{ fontSize: 13.5, color: C.muted, display: "block", marginBottom: 8 }}>Що потрібно</label>
                <textarea
                  className="fi"
                  style={{ ...field, minHeight: 96, resize: "vertical" }}
                  value={f.note}
                  onChange={set("note")}
                  placeholder="Наприклад: середні ящики, 300 шт, під яблука, доставка у Львів"
                />
              </div>
              {err && (
                <div
                  style={{
                    fontSize: 14,
                    color: C.accentDeep,
                    background: C.accentSoft,
                    padding: "12px 16px",
                    borderRadius: 12,
                  }}
                >
                  {err}
                </div>
              )}
              <Btn onClick={submit} variant="accent" style={{ width: "100%" }}>
                Отримати прорахунок
              </Btn>
              <div style={{ fontSize: 13, color: C.soft, textAlign: "center" }}>
                Передзвонюємо за 15 хвилин · без спаму
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactPhone({ isMobile }) {
  return (
    <section id="contact" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          borderRadius: isMobile ? 24 : 36,
          overflow: "hidden",
          position: "relative",
          background: C.ink,
        }}
      >
        <Photo
          id={IMG.warehouse}
          alt=""
          w={1900}
          zoom={false}
          style={{ position: "absolute", inset: 0, height: "100%" }}
          imgStyle={{ opacity: 0.28 }}
        />
        <div
          style={{
            position: "relative",
            textAlign: "center",
            padding: isMobile ? "56px 24px" : "110px 40px",
            color: C.onDark,
          }}
        >
          <div style={{ display: "inline-block", textAlign: "left" }}>
            <Eyebrow dark>Зв'язок</Eyebrow>
          </div>
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(30px, 5.2vw, 56px)",
              lineHeight: 1.08,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              margin: "0 0 20px",
            }}
          >
            Назвемо точну ціну
            <br />
            за один дзвінок
          </h2>
          <p
            style={{
              fontSize: isMobile ? 16.5 : 19,
              color: C.onDarkSoft,
              margin: "0 auto 44px",
              maxWidth: 520,
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            Скажіть розмір і кількість — почуєте ціну й термін виготовлення відразу. Не знаєте
            розмір? Опишіть вантаж, підберемо самі.
          </p>
          <a
            href={PHONE_HREF}
            className="btn"
            style={{
              display: "inline-block",
              padding: isMobile ? "20px 34px" : "26px 56px",
              borderRadius: 999,
              background: C.accent,
              color: "oklch(0.99 0.005 85)",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: isMobile ? 22 : 30,
              letterSpacing: "-0.02em",
              textDecoration: "none",
              boxShadow: "0 10px 34px oklch(0.62 0.13 45 / .34)",
            }}
          >
            {PHONE_TEXT}
          </a>
          <div style={{ fontSize: 15, color: C.onDarkSoft, marginTop: 22 }}>Пн–Пт, 9:00–18:00</div>
        </div>
      </div>
    </section>
  );
}


function About({ isMobile }) {
  const facts = [
    ["Власне виробництво", PRODUCTION_AREA],
    ["Географія поставок", "Вся Україна"],
    ["Форма оплати", "Нал / безнал"],
    ["Мінімальне замовлення", "від 5 шт"],
  ];
  return (
    <section id="about" style={{ padding: isMobile ? "0 20px 70px" : "0 40px 110px" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 32 : 80,
          alignItems: "start",
        }}
      >
        <div>
          <SectionHead eyebrow="Про компанію" title="Працюємо напряму" />
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "oklch(0.42 0.01 80)", margin: "0 0 20px", fontWeight: 300 }}>
            «{COMPANY_NAME}» — виробник дерев'яних ящиків для бізнесу: аграрних підприємств, логістичних
            компаній та виробництв. Без посередників, тому ціна нижча за ринкову.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: "oklch(0.42 0.01 80)", margin: 0, fontWeight: 300 }}>
            Приймаємо як разові замовлення, так і довгострокові контракти на постачання з фіксованим
            графіком відвантажень.
          </p>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          {facts.map(([k, v], i) => (
            <Reveal
              key={k}
              delay={i * 90}
              style={{
                background: C.card,
                borderRadius: 24,
                padding: isMobile ? "24px 26px" : "30px 36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <span style={{ fontSize: 16, color: "oklch(0.42 0.01 80)", fontWeight: 300 }}>{k}</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.ink }}>{v}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ isMobile }) {
  return (
    <footer style={{ padding: isMobile ? "32px 20px 96px" : "40px", borderTop: `1px solid ${C.line}` }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 14,
          color: C.muted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: C.ink }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, color: C.ink }}>{COMPANY_NAME}</span>
        </div>
        <div>{COMPANY_ADDRESS}</div>
        <div>© {new Date().getFullYear()} {COMPANY_NAME}</div>
      </div>
    </footer>
  );
}

function MobileBar({ variant }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 520);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        padding: 12,
        display: "flex",
        gap: 10,
        background: "oklch(0.985 0.006 85 / .92)",
        backdropFilter: "blur(14px)",
        borderTop: `1px solid ${C.line}`,
        transform: show ? "none" : "translateY(115%)",
        transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      {variant.contact === "form" && (
        <Btn href="#contact" variant="white" size="sm" style={{ flex: 1 }}>
          Заявка
        </Btn>
      )}
      <Btn href={PHONE_HREF} variant="accent" size="sm" style={{ flex: 1.3 }}>
        Зателефонувати
      </Btn>
    </div>
  );
}

/* ---------- перемикач варіантів для показу клієнту ---------- */

function Switcher({ variant, setVariant }) {
  const [open, setOpen] = useState(false);
  const opt = (active, label, onClick) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 10px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontFamily: BODY,
        fontSize: 12.5,
        fontWeight: 600,
        background: active ? C.ink : "transparent",
        color: active ? C.onDark : C.muted,
        transition: "background 220ms, color 220ms",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 120 }}>
      {open && (
        <div
          style={{
            background: C.card,
            borderRadius: 20,
            padding: 16,
            marginBottom: 10,
            width: 230,
            boxShadow: "0 18px 50px oklch(0.2 0.01 80 / .22)",
          }}
        >
          <div style={{ fontSize: 12, color: C.soft, marginBottom: 8 }}>Спосіб звʼязку</div>
          <div style={{ display: "flex", gap: 4, background: C.bgAlt, borderRadius: 999, padding: 4 }}>
            {opt(variant.contact === "form", "Форма", () => setVariant({ ...variant, contact: "form" }))}
            {opt(variant.contact === "phone", "Телефон", () => setVariant({ ...variant, contact: "phone" }))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Перемкнути варіант сторінки"
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: C.ink,
          color: C.onDark,
          boxShadow: "0 10px 30px oklch(0.2 0.01 80 / .28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 8h11M4 16h7"
            stroke={C.onDark}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="8" r="2.6" fill="none" stroke={C.accent} strokeWidth="2" />
          <circle cx="14" cy="16" r="2.6" fill="none" stroke={C.accent} strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}

export default function App() {
  const isMobile = useMedia("(max-width: 900px)");
  const [variant, setVariant] = useState(DEFAULT_VARIANT);

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, width: "100%", overflowX: "hidden" }}>
      <style>{CSS}</style>
      <Header isMobile={isMobile} />
      <Hero isMobile={isMobile} variant={variant} />
      <Marquee />
      <Advantages isMobile={isMobile} />
      <Catalog isMobile={isMobile} />
      <Process isMobile={isMobile} />
      <Cases isMobile={isMobile} />
      <Quality isMobile={isMobile} />
      <Faq isMobile={isMobile} variant={variant} />
      {variant.contact === "form" ? (
        <ContactForm isMobile={isMobile} />
      ) : (
        <ContactPhone isMobile={isMobile} />
      )}
      <About isMobile={isMobile} />
      <Footer isMobile={isMobile} />
      {isMobile && <MobileBar variant={variant} />}
      {SHOW_SWITCHER && <Switcher variant={variant} setVariant={setVariant} />}
    </div>
  );
}
