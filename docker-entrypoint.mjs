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
  CREATOR_KEY: process.env.CREATOR_KEY || "tiffani",
  CREATOR_DISPLAY_NAME: process.env.CREATOR_DISPLAY_NAME || "Tiffani Madison",
  CREATOR_CHAT_NAME: process.env.CREATOR_CHAT_NAME || "Tiffany",
  CREATOR_PROFILE_SEED: process.env.CREATOR_PROFILE_SEED || "tiffani",
  CREATOR_CASHAPP: process.env.CREATOR_CASHAPP || "",
  CREATOR_VENMO: process.env.CREATOR_VENMO || "",
  CREATOR_ZELLE: process.env.CREATOR_ZELLE || "",
};
writeFileSync("/app/dist/server/.dev.vars", Object.entries(workerSettings)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join("\n"), { mode: 0o600 });

const child = spawn("pnpm", ["exec", "wrangler", "dev", "--config", "dist/server/wrangler.json",
  "--local", "--ip", "0.0.0.0", "--port", "3000", "--persist-to", "/data"], {
  stdio: "inherit",
  env: process.env,
});

const wakeReplies = async () => {
  try {
    await fetch("http://127.0.0.1:3000/api/system/wake-replies", {
      method: "POST",
      headers: { "x-internal-wake-token": process.env.TELEGRAM_WEBHOOK_SECRET },
    });
  } catch {
    // The local worker may still be starting. The next check will retry.
  }
};
const wakeTimer = setInterval(wakeReplies, 60_000);
setTimeout(wakeReplies, 15_000);

let webhookRegistrationAttempts = 0;
const registerTelegramWebhook = async () => {
  const appDomain = process.env.APP_DOMAIN?.trim();
  if (!appDomain) return;
  webhookRegistrationAttempts += 1;
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: `https://${appDomain}/api/telegram/webhook`,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: [
          "business_connection",
          "business_message",
          "edited_business_message",
          "deleted_business_messages",
          "message",
          "pre_checkout_query",
          "paid_media_purchased",
        ],
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("Telegram rejected the webhook settings.");
  } catch {
    if (webhookRegistrationAttempts < 5) {
      console.error("Telegram webhook registration failed and will retry shortly.");
      setTimeout(registerTelegramWebhook, 30_000);
    } else {
      console.error("Telegram webhook registration failed after five attempts.");
    }
  }
};
setTimeout(registerTelegramWebhook, 5_000);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    clearInterval(wakeTimer);
    child.kill(signal);
  });
}
child.on("exit", (code) => process.exit(code ?? 1));
