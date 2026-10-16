import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleLead } from "./api/_lead-core.js";

/* У `npm run dev` Vercel-функцій немає — цей плагін обслуговує POST /api/lead
   тією ж логікою, що й api/lead.js, з ключами з .env.local. */
function localApi(env) {
  return {
    name: "local-api-lead",
    configureServer(server) {
      server.middlewares.use("/api/lead", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        // Збираємо байти й декодуємо разом: склеювання шматків як рядків
        // ламає кирилицю, якщо символ розрізало між двома шматками.
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          let body = {};
          try {
            body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {}
          const { status, body: out } = await handleLead(body, env);
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // "" — завантажити всі змінні, а не лише VITE_*; у браузер вони не потрапляють.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localApi(env)],
  };
});
