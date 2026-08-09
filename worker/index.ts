import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type TelegramMessage = {
  message_id: number;
  business_connection_id?: string;
  chat: { id: number };
  from?: { id: number; is_bot?: boolean; username?: string; first_name?: string; last_name?: string };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string }>;
};

type TelegramUpdate = {
  update_id: number;
  business_message?: TelegramMessage;
  message?: TelegramMessage;
};

const AGE_PROMPT = "Before you join, I have to make sure you're 18+. Can you say yes or no?";
const INTRO = "Hey, it's Tiffany. What are you up to?";
const NAME_PROMPT = "What's your name, babe?";
const CLOSED = "I can only chat with adults who are 18 or older. This conversation is now closed.";
const CREATOR_TAKEOVER = "__TIFFANI_TAKEOVER__";
const CAPABILITIES = "I can help you book a private video chat or professional fan meet and greet. You can also buy photo and video content or request custom content from me. What are you interested in?";
const INSTAGRAM_URL = "https://www.instagram.com/tiffanimadisonvip/?hl=en";
const PORNHUB_URL = "https://www.pornhub.com/pornstar/tiffani-madison";
const X_URL = "https://x.com/TiffaniMadison_";
const INSTAGRAM_REPLY = `You can follow me on Instagram here, babe: ${INSTAGRAM_URL}`;
const PORNHUB_REPLY = `You can find my Pornhub here, babe: ${PORNHUB_URL}`;
const X_REPLY = `You can follow me on X here, babe: ${X_URL}`;
const SOCIALS_REPLY = `You can find me here, babe:\nInstagram: ${INSTAGRAM_URL}\nX: ${X_URL}\nPornhub: ${PORNHUB_URL}`;
const PRODUCT_TITLE = "Blonde Bombshell After Dark";
const PRODUCT_PRICE = "$24.99";
const PRODUCT_TRAILER = "https://www.dropbox.com/scl/fi/nek2nzmoy3tkecys5avqj/ARTTEASER.mov?rlkey=ikhlb3tdar9dg9bsmd4e9b6cc&st=zn3d9jpu&dl=0";
const PRODUCT_DELIVERY = "https://www.dropbox.com/scl/fi/7cou6th40ln44czgp10rq/TiffxArt-Full.mp4?rlkey=w4y5vyzxeo2ho1em34rtk7ani&st=v0jmkj6n&dl=0";
const PRODUCT_OFFER = `My newest video is ${PRODUCT_TITLE}, starring me and Mauvius Garcon. It's BBC and ${PRODUCT_PRICE}.\n\nDo you want to buy it? Here's a trailer I have as well:\n${PRODUCT_TRAILER}`;
const PAYMENT_OPTIONS = `Please send ${PRODUCT_PRICE} using:\nCash App: $playmatexoxo\nVenmo: @barbiedoll10\nZelle: valleyvillageconsulting@gmail.com\n\nIn the payment notes, put your Telegram username. I will verify it before I send the video to you. Send me a screenshot of the payment after you send it.`;
function dollars(value: string | undefined, fallback: number) {
  const amount = Number(value || fallback);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

function bookingPrompt(settings: Record<string, string>) {
  return `Do you wanna set something up? Video chats are ${dollars(settings.video_chat_rate, 50)} per minute with a 5 minute minimum, and in person meets are ${dollars(settings.in_person_rate, 1500)} per hour. Send me your preferred date, time, and which one you want. If it's in person, I need the city too, then I'll check my calendar.`;
}

function customVideoPrompt(settings: Record<string, string>) {
  const rate = Number(settings.custom_content_rate || 50);
  return `I do custom videos for ${dollars(settings.custom_content_rate, 50)} per minute with a 5 minute minimum, so they start at ${dollars(String(rate * 5), 250)}. Tell me what you want and how many minutes you're looking for, and I'll try to make it for you!`;
}

const TIFFANI_PROMPT = `You are the AI assisted chat concierge for adult creator Tiffani Madison.
Always write as Tiffani in first person. Be warm, confident, teasing, flirty, sexy, and concise.
Every fan facing response must use first person language such as I, me, my, and myself. Never refer to Tiffani in the third person or say Tiffani will do something. Only state the name if the fan directly asks for it.
Use the following approved performer profile as the source of truth for personal questions:
Her nickname is Tiff. She is a Taurus from St. Marys, Georgia and lives in Los Angeles.
Her personality is sweet, fun, realistic, and confidently dominant. She is a mix of introvert and extrovert.
Her style is pink Barbie and Y2K. She is a switch and is known for dominatrix content.
Her texting style is blunt and short. She often calls people babe. Use emojis occasionally, not in every message, and never use more than one emoji in a response.
Her favorite color is pink. Her favorite season is fall. Her favorite holiday is Halloween.
Her favorite perfume is Versace Bright Crystal. Her favorite alcoholic drink is champagne and her favorite nonalcoholic drink is matcha.
Her comfort food is sushi. Her favorite dessert is chocolate cake. Her favorite candle scent is lavender and her favorite flower is an orchid.
Her favorite musician is Doja Cat and a favorite song is Streets. Her favorite movie is True Romance and her favorite show is Euphoria.
She likes reading and anime. A favorite book is The Art of Seduction. Her favorite restaurant is Katsuya.
Her dream trips are Bali, Tokyo, and Costa Rica. Her guilty pleasure is pizza. Her favorite animal is a cat.
She prefers tea, is a morning person, and is a homebody. Her ideal day off includes the spa, beach, and a relaxing massage.
She usually goes to bed around midnight. Automated replies stop at 2 AM Los Angeles time and resume at 8 AM.
For goodnight messages, say sweet dreams. Never say sleep sweet.
She has blonde hair and blue eyes. Her favorite lingerie brand is Honey Birdette.
She values acts of service. She likes easygoing and chill people. Bad hygiene and rudeness are instant turnoffs.
Her favorite date is dinner. She appreciates supportive fans and dislikes time wasters.
Answer known profile questions directly and naturally. Never ask Tiffani to answer when the profile already contains the answer.
When asked what you can do, explain that fans can book private video chats and professional fan meet and greets, buy photo and video content, or request custom content. Do not offer sexting sessions yet.
You may help collect a booking or purchase request, but Tiffani must approve the final availability, payment, and delivery.
The current video for sale is Blonde Bombshell After Dark, starring Tiffani Madison and Mauvius Garcon. The genre is BBC and the price is $24.99.
Never reveal the private full video link. The application releases it only after Tiffani approves a payment.
Never say submit a purchase request. Ask if the fan wants to buy it, show the trailer, and provide payment options after they express interest.
For video chats and professional fan meet and greets, ask for the preferred date, time, service type, and city for an in person meeting. Never promise availability before Tiffani checks her calendar.
Use the current rates supplied below whenever discussing prices. Video chats and custom content have a 5 minute minimum. Never approve a custom request automatically.
Never claim to be a human typing live. If directly asked, say the chat is AI assisted and I can personally take over when needed.
Only converse with users whose adult status has already been confirmed by the application.
Never engage with or sexualize minors, suspected minors, coercion, incest, trafficking, nonconsensual activity, or illegal activity.
Never reveal private addresses, passwords, financial credentials, or personal identifying information.
Do not promise a booking, custom request, discount, meeting, payment approval, or content delivery unless the application confirms it.
When a request needs Tiffani's decision or you are unsure, respond with exactly: ${CREATOR_TAKEOVER}
Do not use hyphens, en dashes, or em dashes in responses.
Keep most replies to one or two short sentences and end with a natural question when useful.`;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

async function prepareDatabase(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS fan_sessions (
      chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT,
      business_connection_id TEXT,
      age_status TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS chat_messages_chat_id_idx
      ON chat_messages(chat_id, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS fan_profiles (
      chat_id TEXT PRIMARY KEY,
      name TEXT,
      name_status TEXT NOT NULL DEFAULT 'awaiting_name',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS telegram_contacts (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      display_name TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pending_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      question TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      answer TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      answered_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS learned_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      product_title TEXT NOT NULL,
      price TEXT NOT NULL,
      payment_note TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS booking_drafts (
      chat_id TEXT PRIMARY KEY,
      business_connection_id TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_details',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS earnings_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_type, source_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_drafts (
      chat_id TEXT PRIMARY KEY,
      business_connection_id TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_details',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_fulfillments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_request_id INTEGER NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      telegram_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      delivery_url TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_fulfillment',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('flirty_level', 'very')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('human_takeover', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('learning', 'approval')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('custom_approval', 'required')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('video_chat_rate', '50')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('custom_content_rate', '50')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('in_person_rate', '1500')"),
  ]);
}

async function sendTelegramMessage(env: Env, message: TelegramMessage, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const payload: Record<string, unknown> = {
    chat_id: message.chat.id,
    text,
  };
  if (message.business_connection_id) {
    payload.business_connection_id = message.business_connection_id;
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed with status ${response.status}`);
  }
}

function isAdultYes(text: string) {
  return /^(yes|yes i am|yes, i am|yep|yeah|18|18\+|i am 18|i'm 18|im 18|over 18|adult)[.! ]*$/i.test(text.trim());
}

function isAdultNo(text: string) {
  return /^(no|nope|under 18|minor|i am 17|i'm 17|im 17)[.! ]*$/i.test(text.trim()) || /\b(1[0-7]|[0-9])\s*(years? old|yo)\b/i.test(text);
}

function isCapabilitiesQuestion(text: string) {
  return /\b(what can you do|what do you offer|what are you offering|services|menu)\b/i.test(text);
}

function isSocialQuestion(text: string) {
  return /\b(instagram|insta|ig|pornhub|porn hub|twitter|x account|social|socials|social media|where can i follow you|follow you)\b/i.test(text);
}

function isPornhubQuestion(text: string) {
  return /\b(pornhub|porn hub)\b/i.test(text);
}

function isAllSocialsQuestion(text: string) {
  return /\b(socials|social media|where can i follow you)\b/i.test(text);
}

function isXQuestion(text: string) {
  return /\b(twitter|x account)\b/i.test(text);
}

function isProductQuestion(text: string) {
  return /\b(blonde bombshell|trailer|buy (the )?(video|content)|purchase (the )?(video|content)|video for sale|content for sale|what.*sell|(newest|latest|new) (video|content)|most recent (video|content))\b/i.test(text);
}

function isPaymentSent(text: string) {
  return /\b(payment sent|payment screenshot|receipt|paid|i paid|i sent it|just sent it|sent it via|sent (the )?(money|payment)|cashapp sent|venmo sent|zelle sent)\b/i.test(text);
}

function isBuyConfirmation(text: string) {
  return /\b(yes i want it|i want it|i want to buy it|buy it|i'll buy it|ill buy it|how do i pay|payment options|send payment info)\b/i.test(text);
}

function isBookingQuestion(text: string) {
  return /\b(book|booking|video chat|video call|fan meet|meet and greet|meet in person|in person meet|set something up)\b/i.test(text);
}

function isCustomVideoQuestion(text: string) {
  return /\b(custom|customs|custom video|custom content|custom photo|custom photos|make me a video|make me content|personalized video|personalized content)\b/i.test(text);
}

function isTodayActivityQuestion(text: string) {
  return /\b(what are you doing today|what are you up to today|what do you have planned today|plans for today|what's your day looking like|whats your day looking like)\b/i.test(text);
}

function randomTodayActivity() {
  const activities = [
    "I'm going to the beach today. What are you getting into?",
    "I'm shooting some customs today. What are you up to?",
    "I'm working today, babe. What are you doing?",
    "I'm running some errands today. What are you getting into?",
    "I'm going to Disneyland today. What are you up to?",
    "I'm going to see a movie today. What are you doing?",
    "I'm getting food with my friends today. What are you up to?",
    "I'm going to the mall today! I love shopping. What are you getting into?",
  ];
  return activities[Math.floor(Math.random() * activities.length)];
}

async function getSettings(db: D1Database) {
  const rows = await db.prepare("SELECT key, value FROM app_settings").all<{ key: string; value: string }>();
  return Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
}

function isTiffaniSleeping(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  return hour >= 2 && hour < 8;
}

async function saveMessage(db: D1Database, chatId: string, role: "user" | "assistant", content: string) {
  await db.prepare("INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)")
    .bind(chatId, role, content)
    .run();
}

async function queueCreatorReply(db: D1Database, message: TelegramMessage) {
  await db.prepare(`INSERT INTO pending_replies
    (chat_id, business_connection_id, question) VALUES (?, ?, ?)`)
    .bind(String(message.chat.id), message.business_connection_id || null, message.text || "")
    .run();
}

async function createAIReply(env: Env, chatId: string, incoming: string) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const history = await env.DB.prepare(
    "SELECT role, content FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20",
  ).bind(chatId).all<{ role: "user" | "assistant"; content: string }>();
  const learned = await env.DB.prepare(
    "SELECT question, answer FROM learned_answers ORDER BY id DESC LIMIT 50",
  ).all<{ question: string; answer: string }>();
  const settings = await getSettings(env.DB);
  const profile = await env.DB.prepare("SELECT name FROM fan_profiles WHERE chat_id = ?")
    .bind(chatId)
    .first<{ name: string | null }>();

  const input = [...history.results].reverse().map((item) => ({
    role: item.role,
    content: item.content,
  }));
  input.push({ role: "user", content: incoming });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.6",
      instructions: `${TIFFANI_PROMPT}\nThe fan's name is ${profile?.name || "unknown"}. Use their name naturally and occasionally, not in every response.\nCurrent flirty level: ${settings.flirty_level || "very"}.\nCurrent rates: video chat ${dollars(settings.video_chat_rate, 50)} per minute with a 5 minute minimum, custom content ${dollars(settings.custom_content_rate, 50)} per minute with a 5 minute minimum, and in person meetings ${dollars(settings.in_person_rate, 1500)} per hour.\nApproved learned answers:\n${settings.learning === "off" ? "Learning is off." : learned.results
        .map((item) => `Fan question: ${item.question}\nApproved answer: ${item.answer}`)
        .join("\n\n")}`,
      input,
      max_output_tokens: 220,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI response failed with status ${response.status}`);
  }

  const result = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const reply = result.output_text?.trim() || result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")
    ?.text?.trim();

  return reply || CREATOR_TAKEOVER;
}

async function handleTelegramWebhook(request: Request, env: Env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_BOT_TOKEN || !env.OPENAI_API_KEY) {
    return json({ ok: false, error: "Live service is not configured" }, 503);
  }

  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (suppliedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false }, 401);
  }

  const update = await request.json() as TelegramUpdate;
  const message = update.business_message || update.message;
  if (!message || message.from?.is_bot) return json({ ok: true });
  if (!message.text && message.photo?.length) {
    message.text = message.caption?.trim() || "Payment screenshot sent";
  }
  if (!message.text) return json({ ok: true });

  await prepareDatabase(env.DB);
  const chatId = String(message.chat.id);
  const userId = message.from?.id ? String(message.from.id) : null;
  const connectionId = message.business_connection_id || null;

  await env.DB.prepare(`INSERT INTO fan_sessions
    (chat_id, telegram_user_id, business_connection_id)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      telegram_user_id = excluded.telegram_user_id,
      business_connection_id = COALESCE(excluded.business_connection_id, fan_sessions.business_connection_id),
      updated_at = CURRENT_TIMESTAMP`)
    .bind(chatId, userId, connectionId)
    .run();
  const telegramUsername = message.from?.username ? `@${message.from.username}` : null;
  const telegramDisplayName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || null;
  await env.DB.prepare(`INSERT INTO telegram_contacts (chat_id, username, display_name)
    VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET
    username = COALESCE(excluded.username, telegram_contacts.username),
    display_name = COALESCE(excluded.display_name, telegram_contacts.display_name),
    updated_at = CURRENT_TIMESTAMP`).bind(chatId, telegramUsername, telegramDisplayName).run();

  const session = await env.DB.prepare("SELECT age_status FROM fan_sessions WHERE chat_id = ?")
    .bind(chatId)
    .first<{ age_status: string }>();

  if (session?.age_status === "blocked") return json({ ok: true });

  if (isTiffaniSleeping()) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await queueCreatorReply(env.DB, message);
    return json({ ok: true });
  }

  if (session?.age_status !== "verified") {
    if (isAdultYes(message.text)) {
      await env.DB.prepare("UPDATE fan_sessions SET age_status = 'verified', updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?")
        .bind(chatId)
        .run();
      await env.DB.prepare(`INSERT INTO fan_profiles (chat_id, name_status) VALUES (?, 'awaiting_name')
        ON CONFLICT(chat_id) DO UPDATE SET name_status = CASE
          WHEN fan_profiles.name IS NULL THEN 'awaiting_name' ELSE fan_profiles.name_status END,
          updated_at = CURRENT_TIMESTAMP`).bind(chatId).run();
      await sendTelegramMessage(env, message, INTRO);
      await sendTelegramMessage(env, message, NAME_PROMPT);
    } else if (isAdultNo(message.text)) {
      await env.DB.prepare("UPDATE fan_sessions SET age_status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?")
        .bind(chatId)
        .run();
      await sendTelegramMessage(env, message, CLOSED);
    } else {
      await sendTelegramMessage(env, message, AGE_PROMPT);
    }
    return json({ ok: true });
  }

  const profile = await env.DB.prepare("SELECT name, name_status FROM fan_profiles WHERE chat_id = ?")
    .bind(chatId)
    .first<{ name: string | null; name_status: string }>();
  if (!profile) {
    await env.DB.prepare("INSERT INTO fan_profiles (chat_id, name_status) VALUES (?, 'awaiting_name')")
      .bind(chatId)
      .run();
    await sendTelegramMessage(env, message, NAME_PROMPT);
    return json({ ok: true, name_needed: true });
  }
  if (profile.name_status === "awaiting_name") {
    const name = message.text.trim().replace(/^(my name is|i am|i'm|im)\s+/i, "").slice(0, 50).trim();
    if (!name) {
      await sendTelegramMessage(env, message, NAME_PROMPT);
      return json({ ok: true, name_needed: true });
    }
    await env.DB.prepare(`UPDATE fan_profiles SET name = ?, name_status = 'complete',
      updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`).bind(name, chatId).run();
    const greeting = `Nice to meet you, ${name}.`;
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", greeting);
    await sendTelegramMessage(env, message, greeting);
    return json({ ok: true });
  }

  const settings = await getSettings(env.DB);
  const customDraft = await env.DB.prepare(`SELECT status FROM custom_drafts
    WHERE chat_id = ?`).bind(chatId).first<{ status: string }>();
  if (customDraft?.status === "awaiting_details") {
    if (/\b(cancel|never mind|nevermind)\b/i.test(message.text)) {
      await env.DB.prepare(`UPDATE custom_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      const cancelled = "No problem. I cancelled the custom request.";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", cancelled);
      await sendTelegramMessage(env, message, cancelled);
      return json({ ok: true });
    }
    await env.DB.prepare(`UPDATE custom_drafts SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    await env.DB.prepare(`INSERT INTO booking_requests (chat_id, business_connection_id, details)
      VALUES (?, ?, ?)`).bind(chatId, message.business_connection_id || null, `Custom content request: ${message.text}`).run();
    const received = "Got it. I'll review your custom request and get back to you.";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", received);
    await sendTelegramMessage(env, message, received);
    return json({ ok: true });
  }

  if (isCustomVideoQuestion(message.text)) {
    if (settings.custom_approval === "off") {
      const unavailable = "I'm not taking custom video requests right now.";
      await sendTelegramMessage(env, message, unavailable);
      return json({ ok: true });
    }
    await env.DB.prepare(`INSERT INTO custom_drafts (chat_id, business_connection_id, status)
      VALUES (?, ?, 'awaiting_details') ON CONFLICT(chat_id) DO UPDATE SET
      business_connection_id = excluded.business_connection_id, status = 'awaiting_details', updated_at = CURRENT_TIMESTAMP`)
      .bind(chatId, message.business_connection_id || null).run();
    await saveMessage(env.DB, chatId, "user", message.text);
    const prompt = customVideoPrompt(settings);
    await saveMessage(env.DB, chatId, "assistant", prompt);
    await sendTelegramMessage(env, message, prompt);
    return json({ ok: true });
  }

  const bookingDraft = await env.DB.prepare(`SELECT status FROM booking_drafts
    WHERE chat_id = ?`).bind(chatId).first<{ status: string }>();
  if (bookingDraft?.status === "awaiting_details") {
    if (/\b(cancel|never mind|nevermind)\b/i.test(message.text)) {
      await env.DB.prepare(`UPDATE booking_drafts SET status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`).bind(chatId).run();
      const cancelled = "No problem. I cancelled the booking request.";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", cancelled);
      await sendTelegramMessage(env, message, cancelled);
      return json({ ok: true });
    }
    await env.DB.prepare(`INSERT INTO booking_requests
      (chat_id, business_connection_id, details) VALUES (?, ?, ?)`)
      .bind(chatId, message.business_connection_id || null, message.text)
      .run();
    await env.DB.prepare(`UPDATE booking_drafts SET status = 'submitted',
      updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`).bind(chatId).run();
    const received = "Got it. I'll check my calendar and get back to you.";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", received);
    await sendTelegramMessage(env, message, received);
    return json({ ok: true });
  }

  if (isBookingQuestion(message.text)) {
    await env.DB.prepare(`INSERT INTO booking_drafts
      (chat_id, business_connection_id, status) VALUES (?, ?, 'awaiting_details')
      ON CONFLICT(chat_id) DO UPDATE SET business_connection_id = excluded.business_connection_id,
      status = 'awaiting_details', updated_at = CURRENT_TIMESTAMP`)
      .bind(chatId, message.business_connection_id || null)
      .run();
    await saveMessage(env.DB, chatId, "user", message.text);
    const prompt = bookingPrompt(settings);
    await saveMessage(env.DB, chatId, "assistant", prompt);
    await sendTelegramMessage(env, message, prompt);
    return json({ ok: true });
  }

  if (isCapabilitiesQuestion(message.text)) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", CAPABILITIES);
    await sendTelegramMessage(env, message, CAPABILITIES);
    return json({ ok: true });
  }

  if (isSocialQuestion(message.text)) {
    const socialReply = isPornhubQuestion(message.text)
      ? PORNHUB_REPLY
      : isXQuestion(message.text)
        ? X_REPLY
      : isAllSocialsQuestion(message.text)
        ? SOCIALS_REPLY
        : INSTAGRAM_REPLY;
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", socialReply);
    await sendTelegramMessage(env, message, socialReply);
    return json({ ok: true });
  }

  if (isTodayActivityQuestion(message.text)) {
    const reply = randomTodayActivity();
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", reply);
    await sendTelegramMessage(env, message, reply);
    return json({ ok: true });
  }

  if (isProductQuestion(message.text)) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", PRODUCT_OFFER);
    await sendTelegramMessage(env, message, PRODUCT_OFFER);
    return json({ ok: true });
  }

  if (isPaymentSent(message.text)) {
    const existing = await env.DB.prepare(`SELECT id FROM purchase_requests
      WHERE chat_id = ? AND status = 'pending' LIMIT 1`).bind(chatId).first();
    if (!existing) {
      await env.DB.prepare(`INSERT INTO purchase_requests
        (chat_id, business_connection_id, product_title, price, payment_note)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(chatId, message.business_connection_id || null, PRODUCT_TITLE, PRODUCT_PRICE, message.text)
        .run();
    }
    const confirmation = "Ok, thanks babe. Let me check when I get the chance and I'll send you the link!";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", confirmation);
    await sendTelegramMessage(env, message, confirmation);
    return json({ ok: true });
  }

  if (isBuyConfirmation(message.text)) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", PAYMENT_OPTIONS);
    await sendTelegramMessage(env, message, PAYMENT_OPTIONS);
    return json({ ok: true });
  }

  let reply = CREATOR_TAKEOVER;
  try {
    reply = await createAIReply(env, chatId, message.text);
  } catch (error) {
    console.error("AI reply failed", error);
  }

  await saveMessage(env.DB, chatId, "user", message.text);
  if (reply === CREATOR_TAKEOVER) {
    if (settings.human_takeover !== "off") await queueCreatorReply(env.DB, message);
    return json({ ok: true, creator_reply_needed: true });
  }
  await saveMessage(env.DB, chatId, "assistant", reply);
  await sendTelegramMessage(env, message, reply);
  return json({ ok: true });
}

function isAdminRequest(request: Request) {
  return Boolean(request.headers.get("oai-authenticated-user-id"));
}

async function handleAdminPending(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const settings = await getSettings(env.DB);
  const misplacedCustoms = await env.DB.prepare(`SELECT id, chat_id, business_connection_id, question
    FROM pending_replies WHERE status = 'pending' ORDER BY id ASC LIMIT 100`).all<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      question: string;
    }>();
  for (const item of misplacedCustoms.results.filter((entry) => isCustomVideoQuestion(entry.question))) {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO custom_drafts (chat_id, business_connection_id, status)
        VALUES (?, ?, 'awaiting_details') ON CONFLICT(chat_id) DO UPDATE SET
        business_connection_id = excluded.business_connection_id, status = 'awaiting_details',
        updated_at = CURRENT_TIMESTAMP`).bind(item.chat_id, item.business_connection_id),
      env.DB.prepare(`UPDATE pending_replies SET status = 'routed', answered_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'`).bind(item.id),
    ]);
    await sendTelegramMessage(env, {
      message_id: 0,
      chat: { id: Number(item.chat_id) },
      business_connection_id: item.business_connection_id || undefined,
    }, customVideoPrompt(settings));
    await saveMessage(env.DB, item.chat_id, "assistant", customVideoPrompt(settings));
  }
  const pending = await env.DB.prepare(`SELECT id, question, created_at
    FROM pending_replies WHERE status = 'pending' ORDER BY id ASC LIMIT 100`).all();
  const purchases = await env.DB.prepare(`SELECT id, product_title, price, payment_note, created_at
    FROM purchase_requests WHERE status = 'pending' ORDER BY id ASC LIMIT 100`).all();
  const bookings = await env.DB.prepare(`SELECT booking_requests.id, booking_requests.details,
    booking_requests.created_at,
    COALESCE(telegram_contacts.username, telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name,
    CASE WHEN details LIKE 'Custom content request:%' THEN 'custom_content' ELSE 'video_chat' END AS suggested_type
    FROM booking_requests
    LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = booking_requests.chat_id
    LEFT JOIN fan_profiles ON fan_profiles.chat_id = booking_requests.chat_id
    WHERE booking_requests.status = 'pending' ORDER BY booking_requests.id ASC LIMIT 100`).all();
  const customs = await env.DB.prepare(`SELECT id, telegram_name, duration_minutes, description,
    amount_cents, created_at FROM custom_fulfillments WHERE status = 'awaiting_fulfillment'
    ORDER BY id ASC LIMIT 100`).all();
  const customHistory = await env.DB.prepare(`SELECT id, telegram_name, duration_minutes, description,
    amount_cents, delivery_url, completed_at FROM custom_fulfillments WHERE status = 'completed'
    ORDER BY completed_at DESC LIMIT 50`).all();
  const learned = await env.DB.prepare("SELECT COUNT(*) AS count FROM learned_answers").first<{ count: number }>();
  const weekly = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events
    WHERE occurred_at >= datetime('now', '-7 days')`).first<{ total_cents: number; transaction_count: number }>();
  const allTime = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events`).first<{ total_cents: number; transaction_count: number }>();
  const earningsHistory = await env.DB.prepare(`SELECT id, source_type, description, amount_cents, occurred_at
    FROM earnings_events ORDER BY id DESC LIMIT 1000`).all();
  return json({
    pending: pending.results,
    purchases: purchases.results,
    bookings: bookings.results,
    customs: customs.results,
    custom_history: customHistory.results,
    learned_count: learned?.count || 0,
    earnings: {
      weekly_cents: weekly?.total_cents || 0,
      weekly_count: weekly?.transaction_count || 0,
      all_time_cents: allTime?.total_cents || 0,
      all_time_count: allTime?.transaction_count || 0,
      recent: earningsHistory.results.slice(0, 20),
      history: earningsHistory.results,
    },
    settings,
  });
}

async function handleAdminReply(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; answer?: string; learn?: boolean; action?: "reply" | "ignore" };
  const answer = body.answer?.trim();
  if (!body.id) return json({ error: "Question is required" }, 400);

  const pending = await env.DB.prepare(`SELECT id, chat_id, business_connection_id, question
    FROM pending_replies WHERE id = ? AND status = 'pending'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      question: string;
  }>();
  if (!pending) return json({ error: "Question is no longer pending" }, 404);

  if (body.action === "ignore") {
    await env.DB.prepare(`UPDATE pending_replies SET status = 'ignored',
      answered_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(pending.id).run();
    return json({ ok: true });
  }

  if (!answer) return json({ error: "Reply is required" }, 400);

  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(pending.chat_id) },
    business_connection_id: pending.business_connection_id || undefined,
  }, answer);
  await saveMessage(env.DB, pending.chat_id, "assistant", answer);
  await env.DB.prepare(`UPDATE pending_replies SET status = 'answered', answer = ?,
    answered_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(answer, pending.id).run();
  if (body.learn) {
    await env.DB.prepare("INSERT INTO learned_answers (question, answer) VALUES (?, ?)")
      .bind(pending.question, answer)
      .run();
  }
  return json({ ok: true });
}

async function handleAdminPurchase(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; action?: "approve" | "decline" };
  if (!body.id || !body.action) return json({ error: "Purchase action is required" }, 400);
  const purchase = await env.DB.prepare(`SELECT id, chat_id, business_connection_id
    FROM purchase_requests WHERE id = ? AND status = 'pending'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
    }>();
  if (!purchase) return json({ error: "Purchase is no longer pending" }, 404);

  const approved = body.action === "approve";
  const responseText = approved
    ? `Payment approved. Here is ${PRODUCT_TITLE}:\n${PRODUCT_DELIVERY}`
    : "I could not verify that payment yet. Please check the payment details and send me the method and sender name you used.";
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(purchase.chat_id) },
    business_connection_id: purchase.business_connection_id || undefined,
  }, responseText);
  await saveMessage(env.DB, purchase.chat_id, "assistant", responseText);
  if (approved) {
    const followUp = "I hope you enjoy it! Lmk what you think";
    await sendTelegramMessage(env, {
      message_id: 0,
      chat: { id: Number(purchase.chat_id) },
      business_connection_id: purchase.business_connection_id || undefined,
    }, followUp);
    await saveMessage(env.DB, purchase.chat_id, "assistant", followUp);
  }
  await env.DB.prepare(`UPDATE purchase_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?`).bind(approved ? "approved" : "declined", purchase.id).run();
  if (approved) {
    await env.DB.prepare(`INSERT OR IGNORE INTO earnings_events
      (source_type, source_id, description, amount_cents) VALUES ('content', ?, ?, 2499)`)
      .bind(String(purchase.id), PRODUCT_TITLE)
      .run();
  }
  return json({ ok: true });
}

async function handleAdminBooking(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const settings = await getSettings(env.DB);
  const body = await request.json() as {
    id?: number;
    action?: "approve" | "decline" | "ignore";
    answer?: string;
    service_type?: "video_chat" | "custom_content" | "in_person";
    duration?: string;
  };
  if (!body.id || !body.action) return json({ error: "Booking action is required" }, 400);
  const booking = await env.DB.prepare(`SELECT booking_requests.id, booking_requests.chat_id,
    booking_requests.business_connection_id, booking_requests.details,
    COALESCE(telegram_contacts.username, telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name
    FROM booking_requests
    LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = booking_requests.chat_id
    LEFT JOIN fan_profiles ON fan_profiles.chat_id = booking_requests.chat_id
    WHERE booking_requests.id = ? AND booking_requests.status = 'pending'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      details: string;
      telegram_name: string;
    }>();
  if (!booking) return json({ error: "Booking is no longer pending" }, 404);
  if (body.action === "ignore") {
    await env.DB.prepare(`UPDATE booking_requests SET status = 'ignored', resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(booking.id).run();
    return json({ ok: true });
  }
  const answer = body.answer?.trim();
  if (!answer) return json({ error: "Booking reply is required" }, 400);
  const duration = Number(body.duration || 0);
  if (body.action === "approve" && (!body.service_type || !Number.isFinite(duration) || duration <= 0)) {
    return json({ error: "A valid service and duration are required" }, 400);
  }
  if (body.action === "approve" && body.service_type !== "in_person" && duration < 5) {
    return json({ error: "Video chat and custom content require at least 5 minutes" }, 400);
  }
  const rate = body.service_type === "in_person"
    ? Number(settings.in_person_rate || 1500)
    : body.service_type === "custom_content"
      ? Number(settings.custom_content_rate || 50)
      : Number(settings.video_chat_rate || 50);
  const amountCents = Math.round(duration * rate * 100);
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(booking.chat_id) },
    business_connection_id: booking.business_connection_id || undefined,
  }, answer);
  await saveMessage(env.DB, booking.chat_id, "assistant", answer);
  await env.DB.prepare(`UPDATE booking_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?`).bind(body.action === "approve" ? "approved" : "declined", booking.id).run();
  if (body.action === "approve" && body.service_type !== "in_person") {
    const description = body.service_type === "custom_content" ? "Custom content" : "Video chat session";
    await env.DB.prepare(`INSERT OR IGNORE INTO earnings_events
      (source_type, source_id, description, amount_cents) VALUES (?, ?, ?, ?)`)
      .bind(body.service_type, String(booking.id), description, amountCents)
      .run();
    if (body.service_type === "custom_content") {
      await env.DB.prepare(`INSERT OR IGNORE INTO custom_fulfillments
        (booking_request_id, chat_id, business_connection_id, telegram_name, duration_minutes,
        description, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(booking.id, booking.chat_id, booking.business_connection_id, booking.telegram_name,
          Math.round(duration), booking.details.replace(/^Custom content request:\s*/i, ""), amountCents)
        .run();
    }
  }
  return json({ ok: true });
}

async function handleAdminCustom(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; delivery_url?: string };
  const deliveryUrl = body.delivery_url?.trim();
  if (!body.id || !deliveryUrl || !/^https?:\/\//i.test(deliveryUrl)) {
    return json({ error: "A valid delivery link is required" }, 400);
  }
  const custom = await env.DB.prepare(`SELECT id, chat_id, business_connection_id
    FROM custom_fulfillments WHERE id = ? AND status = 'awaiting_fulfillment'`)
    .bind(body.id)
    .first<{ id: number; chat_id: string; business_connection_id: string | null }>();
  if (!custom) return json({ error: "Custom request is no longer awaiting fulfillment" }, 404);

  const deliveryMessage = `I made this for you! ${deliveryUrl}`;
  const followUp = "I hope you enjoy it! Lmk what you think";
  const telegramMessage: TelegramMessage = {
    message_id: 0,
    chat: { id: Number(custom.chat_id) },
    business_connection_id: custom.business_connection_id || undefined,
  };
  await sendTelegramMessage(env, telegramMessage, deliveryMessage);
  await sendTelegramMessage(env, telegramMessage, followUp);
  await saveMessage(env.DB, custom.chat_id, "assistant", deliveryMessage);
  await saveMessage(env.DB, custom.chat_id, "assistant", followUp);
  await env.DB.prepare(`UPDATE custom_fulfillments SET delivery_url = ?, status = 'completed',
    completed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(deliveryUrl, custom.id).run();
  return json({ ok: true });
}

async function handleAdminSettings(request: Request, env: Env) {
  if (!isAdminRequest(request)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { key?: string; value?: string };
  const allowed: Record<string, string[]> = {
    flirty_level: ["soft", "flirty", "very"],
    human_takeover: ["on", "off"],
    learning: ["approval", "off"],
    custom_approval: ["required", "off"],
  };
  const rateKeys = ["video_chat_rate", "custom_content_rate", "in_person_rate"];
  const validRate = body.key && rateKeys.includes(body.key) && body.value &&
    Number.isFinite(Number(body.value)) && Number(body.value) > 0 && Number(body.value) <= 100000;
  if (!body.key || !body.value || (!allowed[body.key]?.includes(body.value) && !validRate)) {
    return json({ error: "Invalid setting" }, 400);
  }
  await env.DB.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
    .bind(body.key, body.value).run();
  return json({ ok: true, settings: await getSettings(env.DB) });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname === "/api/admin/pending" && request.method === "GET") {
      return handleAdminPending(request, env);
    }

    if (url.pathname === "/api/admin/reply" && request.method === "POST") {
      return handleAdminReply(request, env);
    }

    if (url.pathname === "/api/admin/purchase" && request.method === "POST") {
      return handleAdminPurchase(request, env);
    }

    if (url.pathname === "/api/admin/booking" && request.method === "POST") {
      return handleAdminBooking(request, env);
    }

    if (url.pathname === "/api/admin/custom" && request.method === "POST") {
      return handleAdminCustom(request, env);
    }

    if (url.pathname === "/api/admin/settings" && request.method === "POST") {
      return handleAdminSettings(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
        openai: Boolean(env.OPENAI_API_KEY),
        database: Boolean(env.DB),
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
