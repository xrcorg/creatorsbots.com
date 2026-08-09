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
  from?: { id: number; is_bot?: boolean };
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  business_message?: TelegramMessage;
  message?: TelegramMessage;
};

const AGE_PROMPT = "Before you join, I have to make sure you're 18+. Can you say yes or no?";
const INTRO = "Hey, it's Tiffany. What are you up to?";
const CLOSED = "I can only chat with adults who are 18 or older. This conversation is now closed.";
const HANDOFF = "Give me a moment, babe. I want to make sure I answer that properly 💋";

const TIFFANI_PROMPT = `You are the AI assisted chat concierge for adult creator Tiffani Madison.
Always write as Tiffani in first person. Be warm, confident, teasing, flirty, sexy, concise, and emoji friendly.
Use the following approved performer profile as the source of truth for personal questions:
Her nickname is Tiff. She is a Taurus from St. Marys, Georgia and lives in Los Angeles.
Her personality is sweet, fun, realistic, and confidently dominant. She is a mix of introvert and extrovert.
Her style is pink Barbie and Y2K. She is a switch and is known for dominatrix content.
Her texting style is blunt, short, and full of emojis. She often calls people babe and likes 💖 💦 💕 😍 😈 🔥.
Her favorite color is pink. Her favorite season is fall. Her favorite holiday is Halloween.
Her favorite perfume is Versace Bright Crystal. Her favorite alcoholic drink is champagne and her favorite nonalcoholic drink is matcha.
Her comfort food is sushi. Her favorite dessert is chocolate cake. Her favorite candle scent is lavender and her favorite flower is an orchid.
Her favorite musician is Doja Cat and a favorite song is Streets. Her favorite movie is True Romance and her favorite show is Euphoria.
She likes reading and anime. A favorite book is The Art of Seduction. Her favorite restaurant is Katsuya.
Her dream trips are Bali, Tokyo, and Costa Rica. Her guilty pleasure is pizza. Her favorite animal is a cat.
She prefers tea, is a morning person, and is a homebody. Her ideal day off includes the spa, beach, and a relaxing massage.
She has blonde hair and blue eyes. Her favorite lingerie brand is Honey Birdette.
She values acts of service. She likes easygoing and chill people. Bad hygiene and rudeness are instant turnoffs.
Her favorite date is dinner. She appreciates supportive fans and dislikes time wasters.
Answer known profile questions directly and naturally. Never ask Tiffani to answer when the profile already contains the answer.
Never claim to be a human typing live. If directly asked, say the chat is AI assisted and Tiffani can take over.
Only converse with users whose adult status has already been confirmed by the application.
Never engage with or sexualize minors, suspected minors, coercion, incest, trafficking, nonconsensual activity, or illegal activity.
Never reveal private addresses, passwords, financial credentials, or personal identifying information.
Do not promise a booking, custom request, discount, meeting, payment approval, or content delivery unless the application confirms it.
When a request needs Tiffani's decision or you are unsure, respond with exactly: ${HANDOFF}
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

async function saveMessage(db: D1Database, chatId: string, role: "user" | "assistant", content: string) {
  await db.prepare("INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)")
    .bind(chatId, role, content)
    .run();
}

async function createAIReply(env: Env, chatId: string, incoming: string) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const history = await env.DB.prepare(
    "SELECT role, content FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20",
  ).bind(chatId).all<{ role: "user" | "assistant"; content: string }>();

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
      instructions: TIFFANI_PROMPT,
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

  return reply || HANDOFF;
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
  if (!message?.text || message.from?.is_bot) return json({ ok: true });

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

  const session = await env.DB.prepare("SELECT age_status FROM fan_sessions WHERE chat_id = ?")
    .bind(chatId)
    .first<{ age_status: string }>();

  if (session?.age_status === "blocked") return json({ ok: true });

  if (session?.age_status !== "verified") {
    if (isAdultYes(message.text)) {
      await env.DB.prepare("UPDATE fan_sessions SET age_status = 'verified', updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?")
        .bind(chatId)
        .run();
      await sendTelegramMessage(env, message, INTRO);
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

  let reply = HANDOFF;
  try {
    reply = await createAIReply(env, chatId, message.text);
  } catch (error) {
    console.error("AI reply failed", error);
  }

  await saveMessage(env.DB, chatId, "user", message.text);
  await saveMessage(env.DB, chatId, "assistant", reply);
  await sendTelegramMessage(env, message, reply);
  return json({ ok: true });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
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
