# Заглушка — лендінг

React + Vite, один основний компонент `src/App.jsx`. Проєкт готовий до продакшн-деплою:
локальні зображення (без хотлінка на Unsplash), SEO-теги, favicon, кешування статики.

## Перед першим деплоєм — обов'язково

Усі бізнес-дані винесені в один блок на початку `src/App.jsx`:

```js
const PHONE_HREF = "tel:+380000000000";       // ← реальний номер, формат tel:+380XXXXXXXXX
const PHONE_TEXT = "+38 (000) 000-00-00";      // ← той самий номер у зручному для читання вигляді
const COMPANY_NAME = "Заглушка";               // ← назва компанії
const COMPANY_ADDRESS = "м. Місто, вул. Прикладна, 1"; // ← реальна адреса
const PRODUCTION_AREA = "[м²]";                // ← площа виробництва, напр. "2 400 м²"
```

Замінити всі п'ять значень — і в `index.html`:
- `<title>`, `description`, `og:*`, `twitter:*` — якщо назва компанії інша, ніж «Заглушка»
- рядки з `ваш-домен.com` (4 місця) — на реальний домен, коли він буде

І в `public/robots.txt` / `public/sitemap.xml` — та сама заміна `ваш-домен.com`.

Також вирішити спосіб зв'язку — на початку файлу:

```js
const DEFAULT_VARIANT = { contact: "form" }; // або "phone" — без форми, лише номер
```

`SHOW_SWITCHER` вже виставлено в `false` (плаваючий перемикач для показу клієнту вимкнено).

## Крок 0 — реальні фото (обов'язково для продакшну)

Пісочниця, в якій готувався код, не має доступу до фотохостингів, тому зображення
поки що не завантажені. У вас — повний доступ в інтернет, тому одна команда:

```bash
npm install
npm run fetch:images
```

Скрипт `scripts/fetch-images.mjs` завантажить 5 фото з Unsplash (Unsplash License —
вільне комерційне використання) у `public/images/`. Далі закомітити їх разом з кодом:

```bash
git add public/images
git commit -m "Додати реальні фото"
```

Так фото стають частиною репозиторію — сайт більше не залежить від Unsplash і не
зламається, якщо там щось зміниться. Якщо є власні фото виробництва — просто
покладіть їх у `public/images/` під тими самими іменами:

```
warehouse.jpg       — фото в шапці (широке, 21:9)
small-crates.jpg    — малі ящики
medium-crates.jpg   — середні ящики
large-crates.jpg    — великі ящики
custom-crates.jpg   — під замовлення
```

## Локальний перегляд

```bash
npm install
npm run dev
```

http://localhost:5173

## Деплой: GitHub + Vercel

### 1. GitHub

```bash
cd skyboxbud
git init
git add .
git commit -m "Перший коміт: лендінг"
```

На github.com: **New repository** → назва (напр. `skyboxbud`) → **Create repository**,
без README/gitignore на цьому кроці. Далі виконати команди, які покаже GitHub:

```bash
git remote add origin https://github.com/ВАШ_НІК/skyboxbud.git
git branch -M main
git push -u origin main
```

### 2. Vercel

1. **vercel.com** → Sign up через GitHub
2. **Add New… → Project** → обрати `skyboxbud` → **Import**
3. Framework Preset визначиться сам як **Vite** — нічого не змінювати
4. **Deploy**

Через хвилину-дві отримаєте безкоштовний домен:

```
https://skyboxbud-xxxx.vercel.app
```

Кожен `git push` у `main` автоматично оновлює сайт.

### 3. Свій домен пізніше

Vercel → проєкт → **Settings → Domains** → ввести домен → **Add**. Vercel покаже
DNS-записи (A/CNAME) — додати їх у панелі реєстратора домену. SSL-сертифікат
Vercel випустить сам. Безкоштовний `.vercel.app` продовжує працювати паралельно.

Після підключення домену не забути оновити `ваш-домен.com` у `index.html`,
`robots.txt` і `sitemap.xml` на реальний і задеплоїти ще раз.

## Продакшн-чекліст (коротко)

- [ ] `npm run fetch:images` виконано, `public/images/` закомічено
- [ ] `PHONE_HREF` / `PHONE_TEXT` — реальний номер
- [ ] `COMPANY_NAME` / `COMPANY_ADDRESS` / `PRODUCTION_AREA` — реальні дані
- [ ] `DEFAULT_VARIANT.contact` — обрано `"form"` або `"phone"`
- [ ] `ваш-домен.com` замінено в `index.html`, `robots.txt`, `sitemap.xml`
- [ ] Форма заявки (`ContactForm` у `App.jsx`) підключена до реального
      бекенду/сервісу (наразі показує успіх локально, нікуди не надсилає —
      див. нижче)

## Важливо: форма заявки поки нікуди не надсилає дані

Компонент `ContactForm` валідує поля й показує стан «Заявку прийнято», але
дані нікуди не відправляються — це заглушка, розрахована на підключення
реального способу прийому заявок. Найпростіші варіанти без бекенду:

- **Formspree** (formspree.io) — безкоштовний план, форма шле POST на їхній
  ендпоінт, лист приходить на пошту
- **Telegram-бот** — POST-запит на Telegram Bot API з чат-заявкою
- **Vercel Serverless Function** (`api/order.js` у цьому ж проєкті) — власний
  бекенд на пару рядків, шле лист через будь-який SMTP/Resend/SendGrid

Скажіть, який варіант зручніший — підключу.
