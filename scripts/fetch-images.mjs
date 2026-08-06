/**
 * Одноразовий скрипт: завантажує реальні фото з Unsplash у public/images/,
 * щоб сайт у продакшні не залежав від зовнішнього CDN (hotlink).
 *
 * Запустити ОДИН РАЗ локально (у вас є повний доступ в інтернет,
 * на відміну від пісочниці, в якій готувався цей проєкт):
 *
 *   npm run fetch:images
 *
 * Потім закомітити завантажені файли:
 *
 *   git add public/images
 *   git commit -m "Додати реальні фото"
 *
 * Усі фото — з Unsplash, ліцензія Unsplash License (вільне комерційне
 * використання, атрибуція не обов'язкова). Джерела вказані нижче.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("public/images");

// slug (використовується в коді App.jsx) -> { url, credit }
const IMAGES = {
  warehouse: {
    // Hemerson Coelho — стос дерев'яних ящиків
    url: "https://images.unsplash.com/photo-1552841287-6a0e47282441?auto=format&fit=crop&q=82&w=1920",
    credit: "Photo by Hemerson Coelho on Unsplash",
  },
  "small-crates": {
    // Jonathan Kemper — порожні дерев'яні ящики
    url: "https://images.unsplash.com/photo-1689693138530-cbcb0582a2ea?auto=format&fit=crop&q=82&w=1400",
    credit: "Photo by Jonathan Kemper on Unsplash",
  },
  "medium-crates": {
    // Terra Slaybaugh — ящики з яблуками
    url: "https://images.unsplash.com/photo-1617235178117-a1f5fecb72bd?auto=format&fit=crop&q=82&w=1400",
    credit: "Photo by Terra Slaybaugh on Unsplash",
  },
  "large-crates": {
    // Nareeta Martin — тарні дерев'яні ящики
    url: "https://images.unsplash.com/photo-1617085565703-f7bd307c6818?auto=format&fit=crop&q=82&w=1400",
    credit: "Photo by Nareeta Martin on Unsplash",
  },
  "custom-crates": {
    // Haberdoedas — дошки й ящики
    url: "https://images.unsplash.com/photo-1738965730744-0b9fd702649e?auto=format&fit=crop&q=82&w=1400",
    credit: "Photo by Haberdoedas on Unsplash",
  },
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const credits = [];

  for (const [slug, { url, credit }] of Object.entries(IMAGES)) {
    const dest = path.join(OUT_DIR, `${slug}.jpg`);
    process.stdout.write(`Завантажую ${slug}.jpg ... `);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`ПОМИЛКА (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`ок, ${(buf.length / 1024).toFixed(0)} КБ`);
    credits.push(`${slug}.jpg — ${credit}`);
  }

  await writeFile(
    path.join(OUT_DIR, "CREDITS.txt"),
    credits.join("\n") + "\n\nЛіцензія: Unsplash License — https://unsplash.com/license\n"
  );

  console.log("\nГотово. Файли лежать у public/images/.");
  console.log("Не забудьте: git add public/images && git commit -m \"Додати реальні фото\"");
}

main().catch((e) => {
  console.error("Не вдалося завантажити зображення:", e);
  process.exit(1);
});
