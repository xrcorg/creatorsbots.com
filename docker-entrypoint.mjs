import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const required = ["OPENAI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required settings: ${missing.join(", ")}`);
  process.exit(1);
}

const workerSettings = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.6",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || "",
  CLOUDFLARE_ACCESS_AUD: process.env.CLOUDFLARE_ACCESS_AUD || "",
  PORTAL_OWNER_EMAILS: process.env.PORTAL_OWNER_EMAILS || "",
  PORTAL_CREATOR_EMAILS: process.env.PORTAL_CREATOR_EMAILS || "",
};
writeFileSync("/app/dist/server/.dev.vars", Object.entries(workerSettings)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join("\n"), { mode: 0o600 });

const child = spawn("pnpm", ["exec", "wrangler", "dev", "--config", "dist/server/wrangler.json",
  "--local", "--ip", "0.0.0.0", "--port", "3000", "--persist-to", "/data"], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
