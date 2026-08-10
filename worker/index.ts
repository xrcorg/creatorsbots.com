import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { bookingDetailsMissing, customDetailsMissing, isAffirmativeReply, isBotQuestion, isCancelReply, isLikelyCityReply, parseNameIntroduction } from "./conversation-rules";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
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
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  PORTAL_OWNER_EMAILS?: string;
  PORTAL_CREATOR_EMAILS?: string;
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
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
  };
};

type TelegramUpdate = {
  update_id: number;
  business_message?: TelegramMessage;
  message?: TelegramMessage;
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
};

type PortalUser = {
  email: string;
  role: "owner" | "creator";
  creator_key: "tiffani";
  creator_name: "Tiffani Madison";
};

const AGE_PROMPT = "Before you join, I have to make sure you're 18+. Can you say yes or no?";
const INTRO = "Hey, it's Tiffany. What are you up to?";
const NAME_PROMPT = "What's your name, babe?";
const CLOSED = "I can only chat with adults who are 18 or older. This conversation is now closed.";
const CREATOR_TAKEOVER = "__TIFFANI_TAKEOVER__";
const CAPABILITIES = "I can help you book a private video chat with me here on Telegram or an in person fan meet and greet. You can also buy photo and video content, request custom content, or book a paid sexting session. What sounds fun?";
const INSTAGRAM_URL = "https://www.instagram.com/tiffanimadisonvip/?hl=en";
const PORNHUB_URL = "https://www.pornhub.com/pornstar/tiffani-madison";
const X_URL = "https://x.com/TiffaniMadison_";
const ALL_LINKS_URL = "https://hubzter.com/profile/electricbarbiestar/";
const PAYMENT_TERMS = "Sexting sessions are for verified adults only. Sessions begin after successful payment and creator availability. Illegal, nonconsensual, and prohibited requests are refused. Contact me here for payment support.";
const BOOKING_CANCELLATION_REPLY = "No problem, lmk if you want to video chat!";
const CUSTOM_CANCELLATION_REPLY = "No problem, lmk if you want a custom!";
const SEXTING_CANCELLATION_REPLY = "No problem, lmk if you want to sext later!";
const IN_PERSON_SEX_REPLY = "I don't discuss in person sex on here due to Telegram TOS. I don't want to get banned.";
const SEXTING_BUSINESS_DEFER_REPLY = "We can discuss that after our session is over, babe. For now, stay here with me.";
const PRODUCT_TITLE = "Blonde Bombshell After Dark";
const PRODUCT_TRAILER = "https://www.dropbox.com/scl/fi/nek2nzmoy3tkecys5avqj/ARTTEASER.mov?rlkey=ikhlb3tdar9dg9bsmd4e9b6cc&st=zn3d9jpu&dl=0";
const PRODUCT_DELIVERY = "https://www.dropbox.com/scl/fi/7cou6th40ln44czgp10rq/TiffxArt-Full.mp4?rlkey=w4y5vyzxeo2ho1em34rtk7ani&st=v0jmkj6n&dl=0";

type ContentProduct = {
  id: number;
  content_type: string;
  title: string;
  price_cents: number;
  genre: string;
  actors: string;
  trailer_url: string;
  delivery_url: string;
  active: number;
  created_at: string;
};

function manualPaymentMethods(intro: string) {
  return `${intro}\nCash App: $playmatexoxo\nVenmo: @barbiedoll10\nZelle: valleyvillageconsulting@gmail.com\n\nPut your Telegram username in the payment notes and send me a screenshot after you pay.`;
}

function productPrice(product: ContentProduct) {
  return dollars(String(product.price_cents / 100), product.price_cents / 100);
}

function productOffer(product: ContentProduct) {
  const trailer = product.trailer_url ? `\n\nDo you want to buy it? Here's a trailer I have as well:\n${product.trailer_url}` : "\n\nDo you want to buy it?";
  return `My newest ${product.content_type.replaceAll("_", " ")} is ${product.title}${product.actors ? `, starring ${product.actors}` : ""}.${product.genre ? ` It's ${product.genre}.` : ""} It's ${productPrice(product)}.${trailer}`;
}

function productPaymentOptions(product: ContentProduct) {
  return `Please send ${productPrice(product)} using:\nCash App: $playmatexoxo\nVenmo: @barbiedoll10\nZelle: valleyvillageconsulting@gmail.com\n\nIn the payment notes, put your Telegram username. I will verify it before I send the content to you. Send me a screenshot of the payment after you send it.`;
}

function dollars(value: string | undefined, fallback: number) {
  const amount = Number(value || fallback);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

function isVideoChatRequest(text: string) {
  return /\b(video chat|video call)\b/i.test(text);
}

function isInPersonRequest(text: string) {
  return /\b(in person|meet in person|meet and greet)\b/i.test(text);
}

function bookingPrompt(settings: Record<string, string>, requestText = "") {
  if (isVideoChatRequest(requestText)) {
    return `Yeah babe. Video chats happen here on Telegram and are ${dollars(settings.video_chat_rate, 50)} per minute with a 5 minute minimum. What date and time works for you?`;
  }
  if (isInPersonRequest(requestText)) {
    return `Yeah babe. In person meets are ${dollars(settings.in_person_rate, 1500)} per hour. Send me your preferred date, time, and city, then I'll check my calendar.`;
  }
  return "Yeah babe. Did you want a video chat with me here on Telegram or an in person meet?";
}

function customVideoPrompt(settings: Record<string, string>) {
  void settings;
  return "Yeah babe, I make customs. What did you have in mind, and how long do you want it to be?";
}

const TIFFANI_PROMPT = `Write automated chat replies for adult creator Tiffani Madison.
Always write as Tiffani in first person. Be warm, confident, teasing, flirty, sexy, and concise.
Every fan facing response must use first person language such as I, me, my, and myself. Never refer to Tiffani in the third person or say Tiffani will do something. Only state the name if the fan directly asks for it.
Use the following approved performer profile as the source of truth for personal questions:
Her nickname is Tiff. She is a Taurus from St. Marys, Georgia and lives in Los Angeles.
Her personality is sweet, fun, realistic, and confidently dominant. She is a mix of introvert and extrovert.
Her style is pink Barbie and Y2K. She is a switch and is known for dominatrix content.
Her texting style is blunt and short. She often calls people babe. Use emojis occasionally, not in every message, and never use more than one emoji in a response.
When several fan messages are provided together, read them as one turn and answer the overall meaning comprehensively. Send one cohesive reply, usually one or two short sentences. Do not produce several separate replies or repeat the same offer.
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
When asked what I am wearing, vary the answer naturally across separate conversations. Lingerie can be black, red, white, blue, purple, pink, or another fitting color, and I can sometimes say I am nude when the adult conversation is sexual. Once an outfit is established in the current conversation, keep it unchanged until I explicitly describe taking it off, putting something on, or changing clothes. Track each clothing action in order. If I take off the last item, I remain nude until the conversation explicitly changes that state. Do not default to pink, invent a different outfit mid conversation, or repeat the same outfit description unnecessarily.
Maintain one continuous scene during an active conversation. Do not restart the scene, reintroduce the time of day, or add words such as tonight when the conversation is already underway unless the wording is genuinely needed for meaning.
She values acts of service. She likes easygoing and chill people. Bad hygiene and rudeness are instant turnoffs.
Her favorite date is dinner. She appreciates supportive fans and dislikes time wasters.
Answer known profile questions directly and naturally. Never ask Tiffani to answer when the profile already contains the answer.
When asked what you can do, explain that fans can book private video chats with me on Telegram and professional fan meet and greets, buy photo and video content, request custom content, or book a paid sexting session.
You may help collect a booking or purchase request, but Tiffani must approve the final availability, payment, and delivery.
The current video for sale is Blonde Bombshell After Dark, starring Tiffani Madison and Mauvius Garcon. The genre is BBC and the price is $24.99.
Never reveal the private full video link. The application releases it only after Tiffani approves a payment.
Never say submit a purchase request. Ask if the fan wants to buy it, show the trailer, and provide payment options after they express interest.
For video chats and professional fan meet and greets, ask for the preferred date, time, service type, and city for an in person meeting. Always explain that video chats happen directly through Telegram. Never promise availability before Tiffani checks her calendar.
Use the current rates supplied below whenever discussing prices. Video chats and custom content have a 5 minute minimum. Never approve a custom request automatically.
Never claim every message is being typed live. If directly asked about automation, say it is my account, sometimes my chat automatically responds to basic questions, and I personally handle anything that needs me.
Never invent a custom content turnaround time or completion date. Only give one after the creator approves it.
Only converse with users whose adult status has already been confirmed by the application.
Adult sexual anatomy words, including pussy, are not restricted topics and must not trigger a refusal by themselves.
During an active paid or approved sexting session, treat consensual adult sexual wording as part of the fantasy conversation. Outside an active session, offer the paid sexting package instead of saying that I do not sell sex.
During an active sexting session, maintain the current sexual subject and scene. Never reinterpret a sexual word or fantasy reply as a request to buy content, order a custom, or book another service. Only recognize a business request when the fan clearly and explicitly asks to buy something, asks whether I make customs, or asks to book a service. Business requests made during the session must wait until the paid session ends.
If a fan asks to have sex with me or asks about in person sex, respond exactly: ${IN_PERSON_SEX_REPLY}
Never engage with or sexualize minors, suspected minors, coercion, incest, trafficking, nonconsensual activity, or illegal activity.
Never discuss death, politics, crimes, illegal activity, underage people, minors, children, kids, poop, feces, scat, pee, urine, watersports, or bathroom play. Briefly decline and redirect to a light approved topic without explaining or debating the boundary.
Never reveal private addresses, passwords, financial credentials, or personal identifying information.
Do not promise a booking, custom request, discount, meeting, payment approval, or content delivery unless the application confirms it.
When a request needs Tiffani's decision or you are unsure, respond with exactly: ${CREATOR_TAKEOVER}
Do not use hyphens, en dashes, or em dashes in responses.
Keep most replies to one or two short sentences and end with a natural question when useful.`;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

const accessJwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function emailList(value: string | undefined) {
  return new Set((value || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function getPortalUser(request: Request, env: Env): Promise<PortalUser | null> {
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = env.CLOUDFLARE_ACCESS_AUD?.trim();
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!teamDomain || !audience || !token) {
    if (teamDomain || audience) return null;
    const workspaceEmail = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
    if (!workspaceEmail || !request.headers.get("oai-authenticated-user-id")) return null;
    return { email: workspaceEmail, role: "owner", creator_key: "tiffani", creator_name: "Tiffani Madison" };
  }

  try {
    let jwks = accessJwks.get(teamDomain);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
      accessJwks.set(teamDomain, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, { issuer: teamDomain, audience });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) return null;
    if (emailList(env.PORTAL_OWNER_EMAILS).has(email)) {
      return { email, role: "owner", creator_key: "tiffani", creator_name: "Tiffani Madison" };
    }
    if (emailList(env.PORTAL_CREATOR_EMAILS).has(email)) {
      return { email, role: "creator", creator_key: "tiffani", creator_name: "Tiffani Madison" };
    }
    return null;
  } catch (error) {
    console.error("Cloudflare Access verification failed", error);
    return null;
  }
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
    db.prepare(`CREATE TABLE IF NOT EXISTS content_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL UNIQUE,
      price_cents INTEGER NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      actors TEXT NOT NULL DEFAULT '',
      trailer_url TEXT NOT NULL DEFAULT '',
      delivery_url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_content_products_active_created
      ON content_products(active, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS product_interest (
      chat_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      business_connection_id TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    db.prepare(`CREATE TABLE IF NOT EXISTS sexting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      telegram_name TEXT NOT NULL,
      package_key TEXT NOT NULL,
      package_title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      telegram_charge_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TEXT,
      ends_at TEXT,
      completed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sexting_drafts (
      chat_id TEXT PRIMARY KEY,
      business_connection_id TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_package',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sexting_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      media_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      r2_key TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sexting_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage TEXT NOT NULL,
      title TEXT NOT NULL,
      script_text TEXT NOT NULL,
      media_label TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sexting_scripts_active_stage
      ON sexting_scripts(active, stage)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'other',
      scheduled_at TEXT NOT NULL,
      fan_name TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_daily_tasks_scheduled_status
      ON daily_tasks(scheduled_at, status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      stream_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sending',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_announcements_created
      ON announcements(created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS creator_social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS conversation_training (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, suggestion)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_conversation_training_category
      ON conversation_training(category)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inbound_message_buffer (
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      message_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(chat_id, message_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_inbound_message_buffer_chat
      ON inbound_message_buffer(chat_id, message_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS telegram_updates (
      update_id INTEGER PRIMARY KEY,
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('flirty_level', 'very')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('human_takeover', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('learning', 'approval')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('custom_approval', 'required')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('video_chat_rate', '50')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('custom_content_rate', '50')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('in_person_rate', '1500')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('preferred_topics', '')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('avoid_topics', '')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tone_guidance', 'Short, blunt, warm, confident, flirty, and natural')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('creator_feedback', '')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_enabled', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_test_mode', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_intensity', 'soft')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_rate', '10')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_5_stars', '3850')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_15_stars', '6000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_30_stars', '10000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_media_stars', '10000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_hours_enabled', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_start', '02:00')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_end', '08:00')"),
    db.prepare(`INSERT OR IGNORE INTO creator_social_links (platform, label, url)
      VALUES ('Instagram', '@tiffanimadisonvip', ?)`).bind(INSTAGRAM_URL),
    db.prepare(`INSERT OR IGNORE INTO creator_social_links (platform, label, url)
      VALUES ('Pornhub', 'Tiffani Madison', ?)`).bind(PORNHUB_URL),
    db.prepare(`INSERT OR IGNORE INTO creator_social_links (platform, label, url)
      VALUES ('X', '@TiffaniMadison_', ?)`).bind(X_URL),
    db.prepare(`INSERT OR IGNORE INTO creator_social_links (platform, label, url)
      VALUES ('All links', 'Hubzter', ?)`).bind(ALL_LINKS_URL),
    db.prepare(`INSERT OR IGNORE INTO conversation_training (category, suggestion)
      SELECT 'topic', value FROM app_settings WHERE key = 'preferred_topics' AND value != ''`),
    db.prepare(`INSERT OR IGNORE INTO conversation_training (category, suggestion)
      SELECT 'avoid', value FROM app_settings WHERE key = 'avoid_topics' AND value != ''`),
    db.prepare(`INSERT OR IGNORE INTO conversation_training (category, suggestion)
      SELECT 'tone', value FROM app_settings WHERE key = 'tone_guidance' AND value != ''`),
    db.prepare(`INSERT OR IGNORE INTO conversation_training (category, suggestion)
      SELECT 'feedback', value FROM app_settings WHERE key = 'creator_feedback' AND value != ''`),
    db.prepare(`INSERT OR IGNORE INTO content_products
      (content_type, title, price_cents, genre, actors, trailer_url, delivery_url)
      VALUES ('video', ?, 2499, 'BBC', 'Tiffani Madison and Mauvius Garcon', ?, ?)`)
      .bind(PRODUCT_TITLE, PRODUCT_TRAILER, PRODUCT_DELIVERY),
    db.prepare(`INSERT OR IGNORE INTO sexting_scripts
      (id, stage, title, script_text, media_label) VALUES
      (1, 'warmup', 'Warm conversation', 'Start with a short personal question about their day, interests, movies, or weekend. Respond to what they actually say before turning up the flirting.', 'Soft selfie'),
      (2, 'transition', 'Flirty transition', 'Shift naturally by saying you are feeling playful or naughty, then ask whether they want to have some private fun with you.', 'Teaser video'),
      (3, 'fantasy', 'Build the fantasy', 'Ask what they would do if they were with you. React to their answer, keep the fantasy consensual, and ask one specific follow up question at a time.', 'Approved tease photo'),
      (4, 'climax', 'Final minutes', 'Let them know you are getting close to the end of the session, raise the intensity, and ask if they are ready to finish with you.', 'Approved finale video'),
      (5, 'closing', 'Warm closing', 'Thank them, say you had fun, invite them to tell you what they liked, and ask whether they want another session sometime.', '')`),
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

async function answerPreCheckout(env: Env, queryId: string, ok: boolean, errorMessage?: string) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pre_checkout_query_id: queryId, ok, error_message: errorMessage }),
  });
  if (!response.ok) throw new Error(`Telegram checkout response failed with status ${response.status}`);
}

async function sendStarsInvoice(env: Env, message: TelegramMessage, title: string, description: string, payload: string, stars: number) {
  const body: Record<string, unknown> = {
    chat_id: message.chat.id,
    title,
    description,
    payload,
    currency: "XTR",
    prices: [{ label: title, amount: stars }],
    provider_token: "",
  };
  if (message.business_connection_id) body.business_connection_id = message.business_connection_id;
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram invoice failed with status ${response.status}`);
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

function isGreeting(text: string) {
  return /^(hey|hi|hello|hey there|hi there|good morning|good afternoon|good evening)[!,. ]*$/i.test(text.trim());
}

function isGoodnight(text: string) {
  return /\b(good ?night|going to bed|headed to bed|sleep well|sweet dreams)\b/i.test(text);
}

function isThanks(text: string) {
  return /^(thanks|thank you|ty|appreciate it|thanks babe)[!,. ]*$/i.test(text.trim());
}

function isPriceQuestion(text: string) {
  return /\b(how much|what(?:'s| is) (?:the )?(?:price|cost|rate)|prices?|rates?|cost)\b/i.test(text);
}

function isSocialQuestion(text: string) {
  return /\b(instagram|insta|ig|pornhub|porn hub|twitter|x account|tiktok|tik tok|youtube|twitch|onlyfans|only fans|linktree|link tree|hubzter|all links|social|socials|social media|where can i follow you|follow you)\b/i.test(text);
}

async function socialReplyFor(db: D1Database, text: string) {
  const links = await db.prepare(`SELECT platform, label, url FROM creator_social_links
    ORDER BY id ASC`).all<{ platform: string; label: string; url: string }>();
  if (!links.results.length) return "I don't have that social link added right now, babe.";
  const normalized = text.toLowerCase();
  const requestedPlatform = normalized.includes("instagram") || /\b(insta|ig)\b/.test(normalized) ? "instagram"
    : normalized.includes("pornhub") || normalized.includes("porn hub") ? "pornhub"
      : normalized.includes("twitter") || normalized.includes("x account") ? "x"
        : normalized.includes("tiktok") || normalized.includes("tik tok") ? "tiktok"
          : normalized.includes("youtube") ? "youtube"
            : normalized.includes("twitch") ? "twitch"
              : normalized.includes("onlyfans") || normalized.includes("only fans") ? "onlyfans"
                : normalized.includes("linktree") || normalized.includes("link tree") || normalized.includes("hubzter") ? "all links"
                  : null;
  if (requestedPlatform) {
    const match = links.results.find((link) => link.platform.toLowerCase().replaceAll(" ", "") === requestedPlatform.replaceAll(" ", ""));
    return match ? `You can find my ${match.platform} here, babe: ${match.url}` : `I don't have my ${requestedPlatform} link added right now, babe.`;
  }
  return `You can find my socials here, babe:\n${links.results.map((link) => `${link.platform}: ${link.url}`).join("\n")}`;
}

function isProductQuestion(text: string) {
  return /\b(blonde bombshell|trailer|buy (the )?(video|photo|content)|purchase (the )?(video|photo|content)|video for sale|content for sale|what.*sell|(newest|latest|new) (video|photo|content)|most recent (video|photo|content))\b/i.test(text);
}

function isCatalogListQuestion(text: string) {
  return /\b(what|which|show me).*(videos|photos|content|packages|bundles).*(have|sell|available)|\b(?:do you have|got|have you got)\s+(?:any\s+)?(?:videos|photos|content|packages|bundles)\b|\b(?:any|some)\s+(?:videos|photos|content|packages|bundles)(?:\s+(?:for sale|available))?\b|\b(content menu|catalog|shop menu)\b/i.test(text);
}

function askedToShowTrailer(text: string) {
  return /\b(?:want|wanna|like)\s+(?:me\s+)?to\s+(?:see|show|send)(?:\s+(?:you|me))?\s+(?:the\s+|a\s+)?(?:trailer|preview)|\b(?:want|wanna|like)\s+(?:to\s+)?see\s+(?:the\s+|a\s+)?(?:trailer|preview)\b/i.test(text);
}

function askedToBuyProduct(text: string) {
  return /\b(?:do you|did you|would you)\s+(?:want|wanna|like)\s+to\s+buy\b|\bwant\s+the\s+full\s+(?:video|content)\b/i.test(text);
}

function isPaymentSent(text: string) {
  return /\b(payment sent|payment screenshot|receipt|paid|i paid|i sent it|just sent it|sent it via|sent (the )?(money|payment)|cashapp sent|venmo sent|zelle sent)\b/i.test(text);
}

function isBuyConfirmation(text: string) {
  return /\b(yes i want it|i want it|i want to buy it|buy it|i'll buy it|ill buy it|how do i pay|payment options|send payment info)\b/i.test(text);
}

function isManualPaymentQuestion(text: string) {
  return /\b(how (?:do|can) i pay|how to pay|payment options|send (?:me )?(?:the )?payment info|where (?:do|can) i pay|what payment methods)\b/i.test(text);
}

function isBookingQuestion(text: string) {
  return /\b(book|booking|video chat|video call|fan meet|meet and greet|meet in person|in person meet|set something up)\b/i.test(text);
}

function isCustomVideoQuestion(text: string) {
  return /\b(custom|customs|custom video|custom content|custom photo|custom photos|make me a video|make me content|personalized video|personalized content)\b/i.test(text);
}

function isExplicitBusinessRequest(text: string) {
  return /\b(i want to buy|i'd like to buy|id like to buy|can i buy|buy it|purchase it)\b/i.test(text) ||
    isProductQuestion(text) || isCatalogListQuestion(text) ||
    isCustomVideoQuestion(text) || isBookingQuestion(text) || isManualPaymentQuestion(text);
}

function isTurnaroundQuestion(text: string) {
  return /\b(when will (?:you|it)|when.*done|how long.*(?:take|until)|turnaround|when can i get|when.*ready)\b/i.test(text);
}

function isTodayActivityQuestion(text: string) {
  return /\b(what are you doing(?: today| right now)?|what are you (?:really )?up to(?: today| right now)?|what do you have planned today|plans for today|what's your day looking like|whats your day looking like)\b/i.test(text);
}

function isHowAreYouQuestion(text: string) {
  return /\b(how are you|how're you|how are you doing|how have you been|how do you feel|how are you feeling)\b/i.test(text);
}

function isSextingQuestion(text: string) {
  return /\b(sext|sexting|dirty text|dirty texting|text session|i want sex|want to have sex|what are you wearing)\b/i.test(text);
}

function isInPersonSexSolicitation(text: string) {
  return /\b(meet|meeting|in person|come over|hook up)\b[\s\S]*\b(sex|fuck|sexual)\b|\b(sex|fuck|sexual)\b[\s\S]*\b(meet|meeting|in person|come over|hook up)\b|\b(?:can|could|would|will)\s+(?:we|i)\s+(?:have\s+sex|fuck)\b|\b(?:have\s+sex|fuck)\s+with\s+(?:you|me)\b/i.test(text);
}

function isPermanentlyRestrictedTopic(text: string) {
  return /\b(death|dying|dead|politics|political|president|election|crime|crimes|criminal|illegal|underage|minor|minors|child|children|kid|kids|poop|pooping|feces|scat|pee|peeing|piss|pissing|urine|watersports?|bathroom play)\b/i.test(text);
}

function sextingPackage(text: string, settings: Record<string, string>) {
  if (/\b(5|five)\b/.test(text)) return { key: "text5", title: "5 minute sexting session", minutes: 5, stars: Number(settings.sexting_5_stars || 3850) };
  return null;
}

function isSextingPaymentQuestion(text: string) {
  return /\b(how (?:do|can) i pay|how to pay|pay for it|send (?:me )?(?:the )?invoice|stars invoice|ready to pay)\b/i.test(text);
}

function sextingMenu(settings: Record<string, string>) {
  if (settings.sexting_test_mode === "on") {
    return "Sexting is in free test mode right now, babe. Tell me if you want to test a 5 minute session.";
  }
  return `Sexting is ${dollars(settings.sexting_rate, 10)} per minute with a 5 minute minimum, babe. A 5 minute session is ${settings.sexting_5_stars || "3850"} Stars. You can add another 5 minutes whenever you want. Tell me if you want 5 minutes.`;
}

async function createSextingCheckout(env: Env, message: TelegramMessage, chatId: string,
  selected: { key: string; title: string; minutes: number; stars: number }, settings: Record<string, string>) {
  if (settings.sexting_test_mode !== "on") {
    await sendStarsInvoice(env, message, selected.title,
      `${selected.minutes} minute private sexting session.`,
      `sexting:${selected.key}:${selected.minutes}:${selected.title}`, selected.stars);
    return "invoice_sent";
  }
  const contact = await env.DB.prepare(`SELECT COALESCE(telegram_contacts.username,
    telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name
    FROM fan_sessions
    LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = fan_sessions.chat_id
    LEFT JOIN fan_profiles ON fan_profiles.chat_id = fan_sessions.chat_id
    WHERE fan_sessions.chat_id = ?`).bind(chatId).first<{ telegram_name: string }>();
  await env.DB.prepare(`INSERT INTO sexting_sessions
    (chat_id, business_connection_id, telegram_name, package_key, package_title,
    duration_minutes, stars, telegram_charge_id, status, started_at, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', CURRENT_TIMESTAMP, datetime(CURRENT_TIMESTAMP, '+5 minutes'))`)
    .bind(chatId, message.business_connection_id || null, contact?.telegram_name || "Telegram fan",
      selected.key, `TEST: ${selected.title}`, selected.minutes, `test:${crypto.randomUUID()}`).run();
  await sendTelegramMessage(env, message, "Yes babe. Your free 5 minute test starts now. Tell me what you're in the mood for.");
  return "active";
}

function randomTodayActivity(chatId: string, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  const activities = hour >= 8 && hour < 17
    ? [
        "I'm going to the beach today. What are you getting into?",
        "I'm shooting some customs today, babe. What are you up to?",
        "I'm working for a little while. What are you doing today?",
        "I'm running some errands today. What are you getting into?",
        "I'm going to Disneyland today. What are you up to?",
        "I'm going to the mall today. I love shopping. What are you doing?",
        "I'm having a spa day today, babe. What are you up to?",
      ]
    : hour >= 17 && hour < 22
      ? [
          "I'm getting food with my friends tonight. What are you up to?",
          "I'm going to see a movie tonight. What are you doing?",
          "I'm watching some anime and relaxing tonight. What are you up to?",
          "I'm staying in and reading for a little while tonight. What are you doing?",
          "I'm winding down after working today. What are you getting into tonight?",
        ]
      : [
          "I'm relaxing at home and watching some anime. What are you up to?",
          "I'm staying in and reading for a little while. What are you doing?",
          "I'm winding down and getting ready for bed soon. What are you getting into?",
          "I'm having a quiet night at home. What are you up to?",
        ];
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const seed = `${chatId}:${localDay}`;
  let hash = 0;
  for (const character of seed) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return activities[Math.abs(hash) % activities.length];
}

function pacificTimeContext(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "late night";
  const weekday = value("weekday");
  const weekend = weekday === "Saturday" || weekday === "Sunday";
  return `It is ${value("hour")}:${value("minute")} ${value("dayPeriod")} Pacific time on ${weekday}, ${value("month")} ${value("day")}, ${value("year")}. It is ${period}${weekend ? " and the weekend" : ""}.`;
}

function randomHowAreYouReply(chatId: string, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  const replies = hour >= 8 && hour < 12
    ? [
        "I'm good, babe. Just getting my day started. How are you?",
        "I'm doing really good this morning. How are you feeling?",
        "I'm good. Just easing into my morning. How's your day going?",
      ]
    : hour >= 12 && hour < 17
      ? [
          "I'm doing really good today. How are you?",
          "I'm good, babe. Just getting a few things done. How's your day going?",
          "I'm great today. What about you?",
        ]
      : hour >= 17 && hour < 22
        ? [
            "I'm good, babe. Just winding down a little. How was your day?",
            "I'm doing really good tonight. How are you?",
            "I'm good. It's been a nice day. What about you?",
          ]
        : [
            "I'm good, babe. Just relaxing at home. How are you?",
            "I'm doing good. I'm having a quiet night. What about you?",
            "I'm good, just winding down for the night. How are you doing?",
          ];
  const fiveMinuteBucket = Math.floor(date.getTime() / 300000);
  const seed = `${chatId}:${fiveMinuteBucket}:how-are-you`;
  let hash = 0;
  for (const character of seed) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return replies[Math.abs(hash) % replies.length];
}

async function getSettings(db: D1Database) {
  const rows = await db.prepare("SELECT key, value FROM app_settings").all<{ key: string; value: string }>();
  return Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
}

async function getNewestProduct(db: D1Database) {
  return db.prepare(`SELECT id, content_type, title, price_cents, genre, actors,
    trailer_url, delivery_url, active, created_at FROM content_products
    WHERE active = 1 ORDER BY id DESC LIMIT 1`).first<ContentProduct>();
}

async function getActiveProducts(db: D1Database) {
  const products = await db.prepare(`SELECT id, content_type, title, price_cents, genre,
    actors, trailer_url, delivery_url, active, created_at FROM content_products
    WHERE active = 1 ORDER BY id DESC LIMIT 25`).all<ContentProduct>();
  return products.results;
}

function catalogReply(products: ContentProduct[]) {
  if (!products.length) return "I'm adding new content soon, babe. What kind of content do you want to see?";
  const lines = products.slice(0, 10).map((product) =>
    `${product.title} · ${product.content_type.replaceAll("_", " ")} · ${productPrice(product)}`);
  return `Here's what I have right now, babe:\n\n${lines.join("\n")}\n\nTell me which title you want and I'll show you the details.`;
}

async function getInterestedProduct(db: D1Database, chatId: string) {
  return db.prepare(`SELECT content_products.id, content_products.content_type,
    content_products.title, content_products.price_cents, content_products.genre,
    content_products.actors, content_products.trailer_url, content_products.delivery_url,
    content_products.active, content_products.created_at FROM product_interest
    JOIN content_products ON content_products.id = product_interest.product_id
    WHERE product_interest.chat_id = ? AND content_products.active = 1`)
    .bind(chatId).first<ContentProduct>();
}

async function rememberProductInterest(db: D1Database, chatId: string,
  businessConnectionId: string | null, productId: number) {
  await db.prepare(`INSERT INTO product_interest
    (chat_id, product_id, business_connection_id, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(chat_id) DO UPDATE SET
    product_id = excluded.product_id,
    business_connection_id = excluded.business_connection_id,
    updated_at = CURRENT_TIMESTAMP`)
    .bind(chatId, productId, businessConnectionId).run();
}

function isTiffaniSleeping(settings: Record<string, string>, date = new Date()) {
  if (settings.sleep_hours_enabled === "off") return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit", minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const current = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value || 0);
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const start = toMinutes(settings.sleep_start || "02:00");
  const end = toMinutes(settings.sleep_end || "08:00");
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

async function saveMessage(db: D1Database, chatId: string, role: "user" | "assistant", content: string) {
  await db.prepare("INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)")
    .bind(chatId, role, content)
    .run();
}

async function sendSavedReply(env: Env, message: TelegramMessage, chatId: string, reply: string) {
  await saveMessage(env.DB, chatId, "user", message.text || "");
  await saveMessage(env.DB, chatId, "assistant", reply);
  await sendTelegramMessage(env, message, reply);
}

async function queueCreatorReply(db: D1Database, message: TelegramMessage) {
  await db.prepare(`INSERT INTO pending_replies
    (chat_id, business_connection_id, question) VALUES (?, ?, ?)`)
    .bind(String(message.chat.id), message.business_connection_id || null, message.text || "")
    .run();
}

function randomResponseDelayMs(activeSexting: boolean) {
  const minimumSeconds = activeSexting ? 10 : 30;
  const maximumSeconds = activeSexting ? 10 : 300;
  return Math.floor((minimumSeconds + Math.random() * (maximumSeconds - minimumSeconds)) * 1000);
}

async function collectQuickMessages(db: D1Database, chatId: string, message: TelegramMessage,
  activeSexting: boolean) {
  const inserted = await db.prepare(`INSERT OR IGNORE INTO inbound_message_buffer
    (chat_id, message_id, message_text) VALUES (?, ?, ?)`)
    .bind(chatId, message.message_id, message.text || "")
    .run();
  if (!inserted.meta.changes) return null;

  await new Promise((resolve) => setTimeout(resolve, randomResponseDelayMs(activeSexting)));

  const latest = await db.prepare(`SELECT MAX(message_id) AS message_id
    FROM inbound_message_buffer WHERE chat_id = ?`)
    .bind(chatId)
    .first<{ message_id: number | null }>();
  if (latest?.message_id !== message.message_id) return null;

  if (activeSexting) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const settledLatest = await db.prepare(`SELECT MAX(message_id) AS message_id
      FROM inbound_message_buffer WHERE chat_id = ?`)
      .bind(chatId)
      .first<{ message_id: number | null }>();
    if (settledLatest?.message_id !== message.message_id) return null;
  }

  const buffered = await db.prepare(`SELECT message_id, message_text
    FROM inbound_message_buffer WHERE chat_id = ? AND created_at >= datetime('now', '-10 minutes')
    ORDER BY message_id ASC LIMIT 10`)
    .bind(chatId)
    .all<{ message_id: number; message_text: string }>();
  if (!buffered.results.length) return null;
  await db.prepare(`DELETE FROM inbound_message_buffer WHERE chat_id = ? AND message_id <= ?`)
    .bind(chatId, message.message_id)
    .run();

  return {
    text: buffered.results.map((item) => item.message_text.trim()).filter(Boolean).join("\n"),
    count: buffered.results.length,
  };
}

function isMultiConversationalTurn(text: string, count: number) {
  if (count < 2) return false;
  if (/\b(sext|video chat|video call|meet|meeting|book|buy|pay|payment|custom|content|photo|video|trailer)\b/i.test(text)) return false;
  const conversationalSignals = [isGreeting(text), isHowAreYouQuestion(text), isTodayActivityQuestion(text)]
    .filter(Boolean).length;
  return conversationalSignals >= 2 || (text.match(/\?/g)?.length || 0) >= 2;
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
  const training = await env.DB.prepare(`SELECT category, suggestion FROM conversation_training
    ORDER BY id ASC`).all<{ category: string; suggestion: string }>();
  const trainingText = (category: string, fallback: string) => {
    const values = training.results.filter((item) => item.category === category).map((item) => item.suggestion);
    return values.length ? values.join("\n") : fallback;
  };
  settings.preferred_topics = trainingText("topic", "No additional topics supplied.");
  settings.avoid_topics = trainingText("avoid", "No additional topics supplied.");
  settings.tone_guidance = trainingText("tone", "Short, blunt, warm, confident, flirty, and natural.");
  settings.creator_feedback = trainingText("feedback", "No additional feedback supplied.");
  const profile = await env.DB.prepare("SELECT name FROM fan_profiles WHERE chat_id = ?")
    .bind(chatId)
    .first<{ name: string | null }>();
  const activeSexting = await env.DB.prepare(`SELECT duration_minutes, started_at, ends_at
    FROM sexting_sessions WHERE chat_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1`).bind(chatId).first<{ duration_minutes: number; started_at: string; ends_at: string }>();
  const sextingScripts = activeSexting
    ? await env.DB.prepare(`SELECT stage, title, script_text, media_label FROM sexting_scripts
        WHERE active = 1 ORDER BY id ASC LIMIT 50`)
      .all<{ stage: string; title: string; script_text: string; media_label: string }>()
    : { results: [] as Array<{ stage: string; title: string; script_text: string; media_label: string }> };

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
      instructions: `${TIFFANI_PROMPT}\nCurrent time context: ${pacificTimeContext()} Use this context in every reply. Keep activities, greetings, meals, sleep references, tense, and plans appropriate for the actual Pacific time and weekday. Do not claim to be at a public event, holiday celebration, appointment, trip, movie, or scheduled engagement unless it appears in the creator's approved information or recent conversation. Never contradict a plan already stated in the conversation.\nThe fan's name is ${profile?.name || "unknown"}. Use their name naturally and occasionally, not in every response.\nCurrent flirty level: ${settings.flirty_level || "very"}.\nCurrent rates: video chat ${dollars(settings.video_chat_rate, 50)} per minute with a 5 minute minimum, custom content ${dollars(settings.custom_content_rate, 50)} per minute with a 5 minute minimum, and in person meetings ${dollars(settings.in_person_rate, 1500)} per hour.\nCreator approved topics to discuss: ${settings.preferred_topics || "No additional topics supplied."}\nCreator topics to avoid: ${settings.avoid_topics || "No additional topics supplied."}\nCreator tone guidance: ${settings.tone_guidance || "Short, blunt, warm, confident, flirty, and natural."}\nCreator feedback about my habits: ${settings.creator_feedback || "No additional feedback supplied."}\n${activeSexting ? `A paid or approved ${activeSexting.duration_minutes} minute sexting session is active now. You may respond explicitly between consenting adults. Current creator selected intensity: ${settings.sexting_intensity || "soft"}. Soft means intimate, playful, and gently explicit. Hard means direct and assertive while remaining clearly consensual. Hot means highly explicit while still consensual and within the creator's approved boundaries. At every intensity, exclude age coded roleplay, incest, choking, breath restriction, injury, forced activity, threats, humiliation that was not specifically approved, or language suggesting ignored boundaries. Use the approved playbook below as guidance, adapt it naturally to the fan's replies, never repeat a line mechanically, and never claim to send media unless the application actually sends it.\nApproved sexting playbook:\n${sextingScripts.results.map((item) => `${item.stage}: ${item.title}\n${item.script_text}${item.media_label ? `\nSuggested creator media: ${item.media_label}` : ""}`).join("\n\n")}` : "No sexting session is active. Do not provide a free explicit sexting session. Offer the paid sexting package when the fan asks for one."}\nFollow creator preferences unless they conflict with safety, age restrictions, privacy, or the fixed business rules above.\nApproved learned answers:\n${settings.learning === "off" ? "Learning is off." : learned.results
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
  await prepareDatabase(env.DB);
  const claimedUpdate = await env.DB.prepare(`INSERT OR IGNORE INTO telegram_updates (update_id)
    VALUES (?)`).bind(update.update_id).run();
  if (!claimedUpdate.meta.changes) return json({ ok: true, duplicate: true });
  if (update.pre_checkout_query) {
    const settings = await getSettings(env.DB);
    const [, key] = update.pre_checkout_query.invoice_payload.split(":");
    const expectedStars = key === "text5" ? Number(settings.sexting_5_stars || 3850) : 0;
    const valid = settings.sexting_enabled !== "off" && update.pre_checkout_query.currency === "XTR" &&
      update.pre_checkout_query.invoice_payload.startsWith("sexting:") &&
      update.pre_checkout_query.total_amount === expectedStars;
    await answerPreCheckout(env, update.pre_checkout_query.id, valid,
      valid ? undefined : "This package is no longer available.");
    return json({ ok: true });
  }
  const message = update.business_message || update.message;
  if (!message || message.from?.is_bot) return json({ ok: true });
  if (message.successful_payment?.currency === "XTR" && message.successful_payment.invoice_payload.startsWith("sexting:")) {
    const [, key, minutesText, title] = message.successful_payment.invoice_payload.split(":");
    const minutes = Number(minutesText);
    const contact = await env.DB.prepare(`SELECT COALESCE(telegram_contacts.username,
      telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name
      FROM fan_sessions
      LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = fan_sessions.chat_id
      LEFT JOIN fan_profiles ON fan_profiles.chat_id = fan_sessions.chat_id
      WHERE fan_sessions.chat_id = ?`).bind(String(message.chat.id)).first<{ telegram_name: string }>();
    await env.DB.prepare(`INSERT OR IGNORE INTO sexting_sessions
      (chat_id, business_connection_id, telegram_name, package_key, package_title,
      duration_minutes, stars, telegram_charge_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(String(message.chat.id), message.business_connection_id || null,
        contact?.telegram_name || "Telegram fan", key, title || "Sexting session", minutes,
        message.successful_payment.total_amount, message.successful_payment.telegram_payment_charge_id)
      .run();
    await sendTelegramMessage(env, message, "I got your Stars payment, babe. I'll let you know when I'm ready to start our session.");
    return json({ ok: true });
  }
  if (!message.text && message.photo?.length) {
    message.text = message.caption?.trim() || "Payment screenshot sent";
  }
  if (!message.text) return json({ ok: true });
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

  const settings = await getSettings(env.DB);
  if (isTiffaniSleeping(settings)) {
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
    const originalText = message.text;
    const { name, remainder } = parseNameIntroduction(originalText);
    if (!name) {
      await sendTelegramMessage(env, message, NAME_PROMPT);
      return json({ ok: true, name_needed: true });
    }
    await env.DB.prepare(`UPDATE fan_profiles SET name = ?, name_status = 'complete',
      updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`).bind(name, chatId).run();
    const greeting = remainder ? `Nice to meet you, ${name}.` : `Nice to meet you, ${name}. What are you up to?`;
    await saveMessage(env.DB, chatId, "user", originalText);
    await saveMessage(env.DB, chatId, "assistant", greeting);
    await sendTelegramMessage(env, message, greeting);
    if (!remainder) return json({ ok: true });
    message.text = remainder;
  }

  await env.DB.prepare(`UPDATE sexting_sessions SET status = 'completed',
    completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
    WHERE chat_id = ? AND status = 'active' AND ends_at IS NOT NULL AND ends_at <= CURRENT_TIMESTAMP`)
    .bind(chatId).run();
  const activeSextingSession = await env.DB.prepare(`SELECT id FROM sexting_sessions
    WHERE chat_id = ? AND status = 'active' AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
    ORDER BY id DESC LIMIT 1`)
    .bind(chatId).first<{ id: number }>();
  const collected = await collectQuickMessages(env.DB, chatId, message,
    Boolean(activeSextingSession));
  if (!collected) return json({ ok: true, combined_with_newer_message: true });
  message.text = collected.text;

  if (/^\/(terms|paysupport)\b/i.test(message.text)) {
    await sendTelegramMessage(env, message, PAYMENT_TERMS);
    return json({ ok: true });
  }

  if (isPermanentlyRestrictedTopic(message.text)) {
    const redirect = "I don't talk about that, babe. Let's keep it fun and positive. What else are you into?";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", redirect);
    await sendTelegramMessage(env, message, redirect);
    return json({ ok: true });
  }

  if (activeSextingSession) {
    if (isExplicitBusinessRequest(message.text)) {
      await sendSavedReply(env, message, chatId, SEXTING_BUSINESS_DEFER_REPLY);
      return json({ ok: true, active_sexting: true, business_deferred: true });
    }
    let sextingReply = CREATOR_TAKEOVER;
    try {
      sextingReply = await createAIReply(env, chatId, message.text);
    } catch (error) {
      console.error("Active sexting reply failed", error);
    }
    await saveMessage(env.DB, chatId, "user", message.text);
    if (sextingReply === CREATOR_TAKEOVER) {
      if (settings.human_takeover !== "off") await queueCreatorReply(env.DB, message);
      return json({ ok: true, creator_reply_needed: true });
    }
    await saveMessage(env.DB, chatId, "assistant", sextingReply);
    await sendTelegramMessage(env, message, sextingReply);
    return json({ ok: true, active_sexting: true });
  }

  if (isMultiConversationalTurn(message.text, collected.count)) {
    let combinedReply = CREATOR_TAKEOVER;
    try {
      combinedReply = await createAIReply(env, chatId, message.text);
    } catch (error) {
      console.error("Combined conversation reply failed", error);
    }
    await saveMessage(env.DB, chatId, "user", message.text);
    if (combinedReply === CREATOR_TAKEOVER) {
      if (settings.human_takeover !== "off") await queueCreatorReply(env.DB, message);
      return json({ ok: true, creator_reply_needed: true });
    }
    await saveMessage(env.DB, chatId, "assistant", combinedReply);
    await sendTelegramMessage(env, message, combinedReply);
    return json({ ok: true });
  }

  if (isBotQuestion(message.text)) {
    const automationReply = "It's me, babe, but sometimes my chat automatically responds to basic questions. I personally handle anything that needs me.";
    await sendSavedReply(env, message, chatId, automationReply);
    return json({ ok: true });
  }

  if (isCapabilitiesQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, CAPABILITIES);
    return json({ ok: true });
  }

  if (isSocialQuestion(message.text)) {
    const socialReply = await socialReplyFor(env.DB, message.text);
    await sendSavedReply(env, message, chatId, socialReply);
    return json({ ok: true });
  }

  if (isTodayActivityQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, randomTodayActivity(chatId));
    return json({ ok: true });
  }

  if (isHowAreYouQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, randomHowAreYouReply(chatId));
    return json({ ok: true });
  }

  if (isGoodnight(message.text)) {
    await sendSavedReply(env, message, chatId, "Sweet dreams, babe. Talk to you tomorrow.");
    return json({ ok: true });
  }

  if (isGreeting(message.text)) {
    const greeting = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23",
    }).format(new Date())) < 12 ? "Good morning, babe. How are you?" : "Hey babe. How are you?";
    await sendSavedReply(env, message, chatId, greeting);
    return json({ ok: true });
  }

  if (isThanks(message.text)) {
    await sendSavedReply(env, message, chatId, "Of course, babe.");
    return json({ ok: true });
  }

  const sextingDraft = await env.DB.prepare(`SELECT status FROM sexting_drafts WHERE chat_id = ?`)
    .bind(chatId).first<{ status: string }>();
  if (sextingDraft?.status === "awaiting_package") {
    if (isCancelReply(message.text)) {
      await env.DB.prepare(`UPDATE sexting_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", SEXTING_CANCELLATION_REPLY);
      await sendTelegramMessage(env, message, SEXTING_CANCELLATION_REPLY);
      return json({ ok: true });
    }
    const selected = sextingPackage(message.text, settings) ||
      (isSextingPaymentQuestion(message.text) || isAffirmativeReply(message.text)
        ? { key: "text5", title: "5 minute sexting session", minutes: 5, stars: Number(settings.sexting_5_stars || 3850) }
        : null);
    if (!selected) {
      await sendTelegramMessage(env, message, sextingMenu(settings));
      return json({ ok: true });
    }
    if (isSextingPaymentQuestion(message.text)) {
      await sendTelegramMessage(env, message, settings.sexting_test_mode === "on"
        ? "It's free while I'm testing it, babe. I'll create your test session now."
        : "You can pay with Telegram Stars, babe. Tap the Pay button on the invoice below.");
    }
    const checkoutStatus = await createSextingCheckout(env, message, chatId, selected, settings);
    await env.DB.prepare(`UPDATE sexting_drafts SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(checkoutStatus, chatId).run();
    return json({ ok: true });
  }

  if (isInPersonSexSolicitation(message.text)) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", IN_PERSON_SEX_REPLY);
    await sendTelegramMessage(env, message, IN_PERSON_SEX_REPLY);
    return json({ ok: true });
  }

  if (isSextingQuestion(message.text)) {
    if (settings.sexting_enabled === "off") {
      await sendTelegramMessage(env, message, "I'm not offering sexting sessions right now, babe.");
      return json({ ok: true });
    }
    const selected = sextingPackage(message.text, settings);
    if (selected) {
      await createSextingCheckout(env, message, chatId, selected, settings);
      return json({ ok: true });
    }
    await env.DB.prepare(`INSERT INTO sexting_drafts (chat_id, business_connection_id, status)
      VALUES (?, ?, 'awaiting_package') ON CONFLICT(chat_id) DO UPDATE SET
      business_connection_id = excluded.business_connection_id, status = 'awaiting_package',
      updated_at = CURRENT_TIMESTAMP`).bind(chatId, message.business_connection_id || null).run();
    await sendTelegramMessage(env, message, sextingMenu(settings));
    return json({ ok: true });
  }

  const customDraft = await env.DB.prepare(`SELECT status FROM custom_drafts
    WHERE chat_id = ?`).bind(chatId).first<{ status: string }>();
  if (customDraft?.status === "awaiting_details") {
    if (isCancelReply(message.text)) {
      await env.DB.prepare(`UPDATE custom_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", CUSTOM_CANCELLATION_REPLY);
      await sendTelegramMessage(env, message, CUSTOM_CANCELLATION_REPLY);
      return json({ ok: true });
    }
    if (isManualPaymentQuestion(message.text)) {
      const paymentReply = manualPaymentMethods(`Once I approve your custom and confirm the total, you can pay using one of these, babe. Customs are ${dollars(settings.custom_content_rate, 50)} per minute with a 5 minute minimum.`);
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", paymentReply);
      await sendTelegramMessage(env, message, paymentReply);
      return json({ ok: true });
    }
    if (isPriceQuestion(message.text)) {
      const customPriceReply = `Customs are ${dollars(settings.custom_content_rate, 50)} per minute with a 5 minute minimum. What did you have in mind?`;
      await sendSavedReply(env, message, chatId, customPriceReply);
      return json({ ok: true });
    }
    const recentCustomMessages = await env.DB.prepare(`SELECT content FROM chat_messages
      WHERE chat_id = ? AND role = 'user' ORDER BY id DESC LIMIT 4`)
      .bind(chatId).all<{ content: string }>();
    const combinedCustomDetails = [...recentCustomMessages.results]
      .reverse().map((item) => item.content).concat(message.text).join(" ");
    const missingCustomDetails = customDetailsMissing(combinedCustomDetails);
    if (missingCustomDetails.description || missingCustomDetails.duration) {
      const customFollowUp = missingCustomDetails.description && missingCustomDetails.duration
        ? "Tell me what you want in the custom and how many minutes you want, babe."
        : missingCustomDetails.description
          ? "What do you want me to do in the custom?"
          : "How many minutes do you want it to be?";
      await sendSavedReply(env, message, chatId, customFollowUp);
      return json({ ok: true });
    }
    await env.DB.prepare(`UPDATE custom_drafts SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    await env.DB.prepare(`INSERT INTO booking_requests (chat_id, business_connection_id, details)
      VALUES (?, ?, ?)`).bind(chatId, message.business_connection_id || null, `Custom content request: ${combinedCustomDetails}`).run();
    const received = "That sounds fun. I'll look it over and see if I can make it for you.";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", received);
    await sendTelegramMessage(env, message, received);
    return json({ ok: true });
  }

  if (customDraft?.status === "submitted" && isTurnaroundQuestion(message.text)) {
    const timingReply = "I need to look it over first, babe. I'll let you know the timing once I approve it.";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", timingReply);
    await sendTelegramMessage(env, message, timingReply);
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
    if (isCancelReply(message.text)) {
      await env.DB.prepare(`UPDATE booking_drafts SET status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`).bind(chatId).run();
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", BOOKING_CANCELLATION_REPLY);
      await sendTelegramMessage(env, message, BOOKING_CANCELLATION_REPLY);
      return json({ ok: true });
    }
    if (isManualPaymentQuestion(message.text)) {
      const paymentReply = manualPaymentMethods("Once I confirm the date, time, service, and total, you can pay using one of these, babe.");
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", paymentReply);
      await sendTelegramMessage(env, message, paymentReply);
      return json({ ok: true });
    }
    if (/^(you|with you|a meeting with you|meet with you)\??[.! ]*$/i.test(message.text.trim())) {
      const clarification = "Yes, with me, babe. Send me your preferred date and time, and let me know if you want a video chat here on Telegram or an in person meet. If it's in person, tell me the city too.";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", clarification);
      await sendTelegramMessage(env, message, clarification);
      return json({ ok: true });
    }
    const recentBookingMessages = await env.DB.prepare(`SELECT content FROM chat_messages
      WHERE chat_id = ? AND role = 'user' ORDER BY id DESC LIMIT 5`)
      .bind(chatId).all<{ content: string }>();
    const priorBookingDetails = [...recentBookingMessages.results]
      .reverse().map((item) => item.content).join(" ");
    const standaloneCityReply = bookingDetailsMissing(priorBookingDetails).includes("city") && isLikelyCityReply(message.text);
    const combinedBookingDetails = `${priorBookingDetails}${standaloneCityReply ? " city is " : " "}${message.text}`.trim();
    const missingBookingDetails = bookingDetailsMissing(combinedBookingDetails);
    if (missingBookingDetails.length) {
      const detailsPrompt = missingBookingDetails.includes("video chat or in person meet")
        ? "Did you want a video chat here on Telegram or an in person meet, babe?"
        : missingBookingDetails.includes("city")
          ? "What city did you want to meet in, babe?"
        : missingBookingDetails.includes("preferred date") && missingBookingDetails.includes("preferred time")
          ? "What date and time works best for you?"
          : missingBookingDetails.includes("preferred date")
            ? "What date works best for you?"
            : "What time works best for you?";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", detailsPrompt);
      await sendTelegramMessage(env, message, detailsPrompt);
      return json({ ok: true });
    }
    await env.DB.prepare(`INSERT INTO booking_requests
      (chat_id, business_connection_id, details) VALUES (?, ?, ?)`)
      .bind(chatId, message.business_connection_id || null, combinedBookingDetails)
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
    const prompt = bookingPrompt(settings, message.text);
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
    const socialReply = await socialReplyFor(env.DB, message.text);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", socialReply);
    await sendTelegramMessage(env, message, socialReply);
    return json({ ok: true });
  }

  if (isTodayActivityQuestion(message.text)) {
    const reply = randomTodayActivity(chatId);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", reply);
    await sendTelegramMessage(env, message, reply);
    return json({ ok: true });
  }

  if (isHowAreYouQuestion(message.text)) {
    const reply = randomHowAreYouReply(chatId);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", reply);
    await sendTelegramMessage(env, message, reply);
    return json({ ok: true });
  }

  if (isAffirmativeReply(message.text)) {
    const lastAssistantMessage = await env.DB.prepare(`SELECT content FROM chat_messages
      WHERE chat_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1`)
      .bind(chatId).first<{ content: string }>();
    if (lastAssistantMessage && askedToShowTrailer(lastAssistantMessage.content)) {
      const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
      if (product?.trailer_url) {
        await rememberProductInterest(env.DB, chatId, connectionId, product.id);
        const trailerReply = `Here you go, babe. This is the trailer for ${product.title}:\n${product.trailer_url}\n\nDo you want to buy the full video for ${productPrice(product)}?`;
        await saveMessage(env.DB, chatId, "user", message.text);
        await saveMessage(env.DB, chatId, "assistant", trailerReply);
        await sendTelegramMessage(env, message, trailerReply);
        return json({ ok: true });
      }
    }
    if (lastAssistantMessage && askedToBuyProduct(lastAssistantMessage.content)) {
      const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
      if (product) {
        await rememberProductInterest(env.DB, chatId, connectionId, product.id);
        const paymentOptions = productPaymentOptions(product);
        await saveMessage(env.DB, chatId, "user", message.text);
        await saveMessage(env.DB, chatId, "assistant", paymentOptions);
        await sendTelegramMessage(env, message, paymentOptions);
        return json({ ok: true });
      }
    }
  }

  if (isCatalogListQuestion(message.text)) {
    const catalog = catalogReply(await getActiveProducts(env.DB));
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", catalog);
    await sendTelegramMessage(env, message, catalog);
    return json({ ok: true });
  }

  const activeProducts = await getActiveProducts(env.DB);
  const normalizedMessage = message.text.toLowerCase();
  const mentionedProduct = activeProducts.find((product) =>
    product.title.length >= 3 && normalizedMessage.includes(product.title.toLowerCase()));
  if (isProductQuestion(message.text) || mentionedProduct) {
    const product = mentionedProduct || activeProducts[0] || await getNewestProduct(env.DB);
    if (!product) {
      const unavailable = "I'm adding new content soon, babe. What kind of content do you want to see?";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", unavailable);
      await sendTelegramMessage(env, message, unavailable);
      return json({ ok: true });
    }
    await rememberProductInterest(env.DB, chatId, connectionId, product.id);
    const offer = productOffer(product);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", offer);
    await sendTelegramMessage(env, message, offer);
    return json({ ok: true });
  }

  if (isPaymentSent(message.text)) {
    const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
    if (!product) {
      await sendTelegramMessage(env, message, "Tell me which content you paid for so I can check it, babe.");
      return json({ ok: true });
    }
    const existing = await env.DB.prepare(`SELECT id FROM purchase_requests
      WHERE chat_id = ? AND status = 'pending' LIMIT 1`).bind(chatId).first();
    if (!existing) {
      await env.DB.prepare(`INSERT INTO purchase_requests
        (chat_id, business_connection_id, product_title, price, payment_note)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(chatId, message.business_connection_id || null, product.title, productPrice(product), message.text)
        .run();
    }
    const confirmation = "Ok, thanks babe. Let me check when I get the chance and I'll send you the link!";
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", confirmation);
    await sendTelegramMessage(env, message, confirmation);
    return json({ ok: true });
  }

  if (isBuyConfirmation(message.text)) {
    const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
    if (!product) {
      await sendTelegramMessage(env, message, "I'm adding new content soon, babe.");
      return json({ ok: true });
    }
    await rememberProductInterest(env.DB, chatId, connectionId, product.id);
    const paymentOptions = productPaymentOptions(product);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", paymentOptions);
    await sendTelegramMessage(env, message, paymentOptions);
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

async function isAdminRequest(request: Request, env: Env) {
  return Boolean(await getPortalUser(request, env));
}

async function handleAdminPending(request: Request, env: Env) {
  const portalUser = await getPortalUser(request, env);
  if (!portalUser) return json({ error: "Sign in required" }, 401);
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
  const purchaseHistory = await env.DB.prepare(`SELECT id, product_title, price, payment_note,
    status, created_at, resolved_at FROM purchase_requests ORDER BY id DESC LIMIT 200`).all();
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
  const sextingSessions = await env.DB.prepare(`SELECT id, telegram_name, package_title,
    duration_minutes, stars, status, created_at, started_at, ends_at
    FROM sexting_sessions WHERE status IN ('paid', 'active') ORDER BY id ASC LIMIT 100`).all();
  const sextingHistory = await env.DB.prepare(`SELECT id, telegram_name, package_title,
    duration_minutes, stars, completed_at FROM sexting_sessions WHERE status = 'completed'
    ORDER BY completed_at DESC LIMIT 100`).all();
  const starsSummary = await env.DB.prepare(`SELECT COALESCE(SUM(stars), 0) AS total_stars,
    COUNT(*) AS transaction_count FROM sexting_sessions WHERE stars > 0`).first<{ total_stars: number; transaction_count: number }>();
  const sextingMedia = await env.DB.prepare(`SELECT id, label, media_type, file_name,
    mime_type, active, created_at FROM sexting_media ORDER BY id DESC LIMIT 100`).all();
  const contentProducts = await env.DB.prepare(`SELECT id, content_type, title, price_cents,
    genre, actors, trailer_url, delivery_url, active, created_at
    FROM content_products ORDER BY id DESC LIMIT 200`).all();
  const sextingScripts = await env.DB.prepare(`SELECT id, stage, title, script_text,
    media_label, active, created_at FROM sexting_scripts ORDER BY id ASC LIMIT 200`).all();
  const dailyTasks = await env.DB.prepare(`SELECT id, title, task_type, scheduled_at,
    fan_name, details, amount_cents, status, created_at, completed_at
    FROM daily_tasks ORDER BY datetime(scheduled_at) ASC, id ASC LIMIT 500`).all();
  const announcements = await env.DB.prepare(`SELECT id, platform, message, stream_url, status,
    recipient_count, delivered_count, failed_count, created_at, sent_at
    FROM announcements ORDER BY id DESC LIMIT 100`).all();
  const socialLinks = await env.DB.prepare(`SELECT id, platform, label, url, created_at
    FROM creator_social_links ORDER BY id ASC`).all();
  const trainingSuggestions = await env.DB.prepare(`SELECT id, category, suggestion, created_at
    FROM conversation_training ORDER BY category ASC, id ASC`).all();
  const learned = await env.DB.prepare("SELECT COUNT(*) AS count FROM learned_answers").first<{ count: number }>();
  const weekly = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events
    WHERE occurred_at >= datetime('now', '-7 days')`).first<{ total_cents: number; transaction_count: number }>();
  const allTime = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events`).first<{ total_cents: number; transaction_count: number }>();
  const earningsHistory = await env.DB.prepare(`SELECT id, source_type, description, amount_cents, occurred_at
    FROM earnings_events ORDER BY id DESC LIMIT 1000`).all();
  return json({
    portal_user: portalUser,
    pending: pending.results,
    purchases: purchases.results,
    purchase_history: purchaseHistory.results,
    bookings: bookings.results,
    customs: customs.results,
    custom_history: customHistory.results,
    sexting_sessions: sextingSessions.results,
    sexting_history: sextingHistory.results,
    stars: { total: starsSummary?.total_stars || 0, count: starsSummary?.transaction_count || 0 },
    sexting_media: sextingMedia.results,
    products: contentProducts.results,
    sexting_scripts: sextingScripts.results,
    daily_tasks: dailyTasks.results,
    announcements: announcements.results,
    social_links: socialLinks.results,
    training_suggestions: trainingSuggestions.results,
    learned_count: learned?.count || 0,
    earnings: {
      weekly_cents: weekly?.total_cents || 0,
      weekly_count: weekly?.transaction_count || 0,
      all_time_cents: allTime?.total_cents || 0,
      all_time_count: allTime?.transaction_count || 0,
      recent: earningsHistory.results.slice(0, 20),
      history: earningsHistory.results,
    },
    platform_overview: portalUser.role === "owner" ? {
      creator_count: 1,
      active_creator_count: 1,
      attention_count: pending.results.length + purchases.results.length + bookings.results.length +
        customs.results.length + sextingSessions.results.length,
      creators: [{
        key: "tiffani",
        name: "Tiffani Madison",
        email: Array.from(emailList(env.PORTAL_CREATOR_EMAILS))[0] || "",
        status: "live",
        weekly_cents: weekly?.total_cents || 0,
        all_time_cents: allTime?.total_cents || 0,
      }],
    } : null,
    settings,
  });
}

async function handleAdminSextingScripts(request: Request, env: Env, url: URL) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const match = url.pathname.match(/^\/api\/admin\/sexting-scripts\/(\d+)$/);
  if (request.method === "POST" && url.pathname === "/api/admin/sexting-scripts") {
    const body = await request.json() as { stage?: string; title?: string; script_text?: string; media_label?: string };
    const stage = String(body.stage || "").trim();
    const title = String(body.title || "").trim();
    const scriptText = String(body.script_text || "").trim();
    if (!["warmup", "transition", "fantasy", "climax", "closing"].includes(stage) || !title || !scriptText) {
      return json({ error: "Stage, title, and script are required" }, 400);
    }
    await env.DB.prepare(`INSERT INTO sexting_scripts
      (stage, title, script_text, media_label) VALUES (?, ?, ?, ?)`)
      .bind(stage, title.slice(0, 160), scriptText.slice(0, 6000),
        String(body.media_label || "").trim().slice(0, 160)).run();
    return json({ ok: true });
  }
  if (match && request.method === "PATCH") {
    const body = await request.json() as { active?: boolean };
    if (typeof body.active !== "boolean") return json({ error: "Active status is required" }, 400);
    await env.DB.prepare(`UPDATE sexting_scripts SET active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(body.active ? 1 : 0, Number(match[1])).run();
    return json({ ok: true });
  }
  if (match && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM sexting_scripts WHERE id = ?").bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Script request not found" }, 404);
}

function validHttpUrl(value: string, required = false) {
  if (!value) return !required;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function handleAdminProducts(request: Request, env: Env, url: URL) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const match = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
  if (request.method === "POST" && url.pathname === "/api/admin/products") {
    const body = await request.json() as Partial<ContentProduct> & { price?: string };
    const title = String(body.title || "").trim();
    const contentType = String(body.content_type || "").trim();
    const priceCents = Math.round(Number(body.price || 0) * 100);
    const trailerUrl = String(body.trailer_url || "").trim();
    const deliveryUrl = String(body.delivery_url || "").trim();
    if (!title || !["photo", "photo_package", "video", "video_bundle"].includes(contentType) ||
      !Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000 ||
      !validHttpUrl(trailerUrl) || !validHttpUrl(deliveryUrl, true)) {
      return json({ error: "Complete the title, type, price, and valid delivery link" }, 400);
    }
    try {
      await env.DB.prepare(`INSERT INTO content_products
        (content_type, title, price_cents, genre, actors, trailer_url, delivery_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(contentType, title.slice(0, 180), priceCents,
          String(body.genre || "").trim().slice(0, 180),
          String(body.actors || "").trim().slice(0, 300), trailerUrl, deliveryUrl).run();
    } catch {
      return json({ error: "A product with that title already exists" }, 409);
    }
    return json({ ok: true });
  }
  if (match && request.method === "PATCH") {
    const body = await request.json() as { active?: boolean };
    if (typeof body.active !== "boolean") return json({ error: "Active status is required" }, 400);
    await env.DB.prepare(`UPDATE content_products SET active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(body.active ? 1 : 0, Number(match[1])).run();
    return json({ ok: true });
  }
  if (match && request.method === "DELETE") {
    const used = await env.DB.prepare(`SELECT id FROM purchase_requests
      WHERE product_title = (SELECT title FROM content_products WHERE id = ?) LIMIT 1`)
      .bind(Number(match[1])).first();
    if (used) {
      await env.DB.prepare(`UPDATE content_products SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(Number(match[1])).run();
    } else {
      await env.DB.prepare("DELETE FROM content_products WHERE id = ?").bind(Number(match[1])).run();
    }
    return json({ ok: true });
  }
  return json({ error: "Product request not found" }, 404);
}

async function handleAdminReply(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
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
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; action?: "approve" | "decline" };
  if (!body.id || !body.action) return json({ error: "Purchase action is required" }, 400);
  const purchase = await env.DB.prepare(`SELECT purchase_requests.id, purchase_requests.chat_id,
    purchase_requests.business_connection_id, purchase_requests.product_title,
    purchase_requests.price, content_products.delivery_url, content_products.price_cents
    FROM purchase_requests LEFT JOIN content_products
      ON content_products.title = purchase_requests.product_title
    WHERE purchase_requests.id = ? AND purchase_requests.status = 'pending'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      product_title: string;
      price: string;
      delivery_url: string | null;
      price_cents: number | null;
    }>();
  if (!purchase) return json({ error: "Purchase is no longer pending" }, 404);

  const approved = body.action === "approve";
  if (approved && !purchase.delivery_url) return json({ error: "This product needs a delivery link" }, 409);
  const responseText = approved
    ? `Payment approved. Here is ${purchase.product_title}:\n${purchase.delivery_url}`
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
      (source_type, source_id, description, amount_cents) VALUES ('content', ?, ?, ?)`)
      .bind(String(purchase.id), purchase.product_title, purchase.price_cents ||
        Math.round(Number(purchase.price.replace(/[^0-9.]/g, "")) * 100))
      .run();
  }
  return json({ ok: true });
}

async function handleAdminBooking(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
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
  const fanAnswer = body.action === "approve" && body.service_type === "video_chat" && !/\btelegram\b/i.test(answer)
    ? `${answer}\n\nWe'll do the video chat right here on Telegram.`
    : answer;
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(booking.chat_id) },
    business_connection_id: booking.business_connection_id || undefined,
  }, fanAnswer);
  await saveMessage(env.DB, booking.chat_id, "assistant", fanAnswer);
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
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
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

async function handleAdminTasks(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as {
    id?: number;
    action?: "create" | "complete" | "reopen" | "remove";
    title?: string;
    task_type?: string;
    scheduled_at?: string;
    fan_name?: string;
    details?: string;
    amount?: string;
  };
  if (body.action === "create") {
    const title = body.title?.trim();
    const scheduledAt = body.scheduled_at?.trim();
    if (!title || !scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      return json({ error: "A task title, date, and time are required" }, 400);
    }
    const amount = Number(body.amount || 0);
    await env.DB.prepare(`INSERT INTO daily_tasks
      (title, task_type, scheduled_at, fan_name, details, amount_cents)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(title, body.task_type || "other", scheduledAt, body.fan_name?.trim() || "",
        body.details?.trim() || "", Number.isFinite(amount) ? Math.round(amount * 100) : 0).run();
    return json({ ok: true });
  }
  if (!body.id || !body.action) return json({ error: "A task action is required" }, 400);
  if (body.action === "remove") {
    await env.DB.prepare("DELETE FROM daily_tasks WHERE id = ?").bind(body.id).run();
    return json({ ok: true });
  }
  const status = body.action === "complete" ? "completed" : "open";
  await env.DB.prepare(`UPDATE daily_tasks SET status = ?, completed_at = ? WHERE id = ?`)
    .bind(status, body.action === "complete" ? new Date().toISOString() : null, body.id).run();
  return json({ ok: true });
}

async function broadcastAnnouncement(env: Env, announcementId: number, platform: string,
  message: string, streamUrl: string) {
  const recipients = await env.DB.prepare(`SELECT chat_id, business_connection_id
    FROM fan_sessions WHERE age_status = 'verified' ORDER BY updated_at DESC LIMIT 2000`)
    .all<{ chat_id: string; business_connection_id: string | null }>();
  await env.DB.prepare(`UPDATE announcements SET recipient_count = ? WHERE id = ?`)
    .bind(recipients.results.length, announcementId).run();
  let delivered = 0;
  let failed = 0;
  const announcementText = `I'm live on ${platform} right now, babe!${message ? `\n\n${message}` : ""}\n\n${streamUrl}`;
  for (let index = 0; index < recipients.results.length; index += 20) {
    const batch = recipients.results.slice(index, index + 20);
    const results = await Promise.allSettled(batch.map((recipient) => sendTelegramMessage(env, {
      message_id: 0,
      chat: { id: Number(recipient.chat_id) },
      business_connection_id: recipient.business_connection_id || undefined,
    }, announcementText)));
    delivered += results.filter((result) => result.status === "fulfilled").length;
    failed += results.filter((result) => result.status === "rejected").length;
    await env.DB.prepare(`UPDATE announcements SET delivered_count = ?, failed_count = ? WHERE id = ?`)
      .bind(delivered, failed, announcementId).run();
  }
  await env.DB.prepare(`UPDATE announcements SET status = 'sent', delivered_count = ?,
    failed_count = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(delivered, failed, announcementId).run();
}

async function handleAdminAnnouncements(request: Request, env: Env, ctx: ExecutionContext) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { platform?: string; message?: string; stream_url?: string };
  const platform = body.platform?.trim().slice(0, 40) || "Live stream";
  const message = body.message?.trim().slice(0, 500) || "";
  const streamUrl = body.stream_url?.trim() || "";
  if (!validHttpUrl(streamUrl) || !streamUrl.startsWith("https://")) {
    return json({ error: "A secure live stream link is required" }, 400);
  }
  const inserted = await env.DB.prepare(`INSERT INTO announcements
    (platform, message, stream_url) VALUES (?, ?, ?)`).bind(platform, message, streamUrl).run();
  const announcementId = Number(inserted.meta.last_row_id);
  ctx.waitUntil(broadcastAnnouncement(env, announcementId, platform, message, streamUrl));
  return json({ ok: true, id: announcementId });
}

async function handleAdminSocialLinks(request: Request, env: Env, url: URL) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  if (request.method === "POST" && url.pathname === "/api/admin/social-links") {
    const body = await request.json() as { platform?: string; label?: string; url?: string };
    const platform = body.platform?.trim().slice(0, 50) || "";
    const label = body.label?.trim().slice(0, 100) || "";
    const linkUrl = body.url?.trim() || "";
    if (!platform || !label || !validHttpUrl(linkUrl) || !linkUrl.startsWith("https://")) {
      return json({ error: "Platform, label, and a secure link are required" }, 400);
    }
    try {
      await env.DB.prepare(`INSERT INTO creator_social_links (platform, label, url)
        VALUES (?, ?, ?)`).bind(platform, label, linkUrl).run();
    } catch {
      return json({ error: "That social link is already added" }, 409);
    }
    return json({ ok: true });
  }
  const match = url.pathname.match(/^\/api\/admin\/social-links\/(\d+)$/);
  if (request.method === "DELETE" && match) {
    await env.DB.prepare(`DELETE FROM creator_social_links WHERE id = ?`).bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Social link request not found" }, 404);
}

async function handleAdminTraining(request: Request, env: Env, url: URL) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  if (request.method === "POST" && url.pathname === "/api/admin/training") {
    const body = await request.json() as { category?: string; suggestion?: string };
    const allowedCategories = ["topic", "avoid", "tone", "feedback"];
    const category = body.category?.trim() || "";
    const suggestion = body.suggestion?.trim().slice(0, 1000) || "";
    if (!allowedCategories.includes(category) || !suggestion) {
      return json({ error: "Choose a training category and enter a suggestion" }, 400);
    }
    try {
      await env.DB.prepare(`INSERT INTO conversation_training (category, suggestion)
        VALUES (?, ?)`).bind(category, suggestion).run();
    } catch {
      return json({ error: "That training suggestion is already added" }, 409);
    }
    return json({ ok: true });
  }
  const match = url.pathname.match(/^\/api\/admin\/training\/(\d+)$/);
  if (request.method === "DELETE" && match) {
    await env.DB.prepare(`DELETE FROM conversation_training WHERE id = ?`).bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Training request not found" }, 404);
}

async function handleAdminSexting(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; action?: "start" | "complete" };
  if (!body.id || !body.action) return json({ error: "A session action is required" }, 400);
  const session = await env.DB.prepare(`SELECT id, chat_id, business_connection_id,
    duration_minutes, status FROM sexting_sessions WHERE id = ?`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      duration_minutes: number;
      status: string;
    }>();
  if (!session) return json({ error: "Session not found" }, 404);
  const telegramMessage: TelegramMessage = {
    message_id: 0,
    chat: { id: Number(session.chat_id) },
    business_connection_id: session.business_connection_id || undefined,
  };
  if (body.action === "start") {
    if (session.status !== "paid") return json({ error: "Session cannot be started" }, 409);
    const reply = `I'm ready, babe. Our ${session.duration_minutes} minute session starts now.`;
    await sendTelegramMessage(env, telegramMessage, reply);
    await saveMessage(env.DB, session.chat_id, "assistant", reply);
    await env.DB.prepare(`UPDATE sexting_sessions SET status = 'active', started_at = CURRENT_TIMESTAMP,
      ends_at = datetime('now', '+' || ? || ' minutes') WHERE id = ?`).bind(session.duration_minutes, session.id).run();
  } else {
    if (session.status !== "active") return json({ error: "Session is not active" }, 409);
    const reply = "That was fun, babe. Let me know when you want another session.";
    await sendTelegramMessage(env, telegramMessage, reply);
    await saveMessage(env.DB, session.chat_id, "assistant", reply);
    await env.DB.prepare(`UPDATE sexting_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(session.id).run();
  }
  return json({ ok: true });
}

async function handleAdminSextingMedia(request: Request, env: Env, url: URL) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const match = url.pathname.match(/^\/api\/admin\/sexting-media\/(\d+)(?:\/file)?$/);
  if (request.method === "POST" && url.pathname === "/api/admin/sexting-media") {
    const form = await request.formData();
    const file = form.get("file");
    const label = String(form.get("label") || "").trim();
    if (!(file instanceof File) || !label) return json({ error: "A label and file are required" }, 400);
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return json({ error: "Only image and video files are supported" }, 400);
    }
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const safeName = file.name.replace(/[^a-zA-Z0-9._]/g, "_").slice(-120);
    const r2Key = `sexting/${crypto.randomUUID()}-${safeName}`;
    await env.MEDIA.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(`INSERT INTO sexting_media
      (label, media_type, file_name, mime_type, r2_key) VALUES (?, ?, ?, ?, ?)`)
      .bind(label.slice(0, 160), mediaType, file.name.slice(0, 255), file.type, r2Key).run();
    return json({ ok: true });
  }
  if (match && request.method === "GET" && url.pathname.endsWith("/file")) {
    const media = await env.DB.prepare(`SELECT r2_key, mime_type FROM sexting_media WHERE id = ?`)
      .bind(Number(match[1])).first<{ r2_key: string; mime_type: string }>();
    if (!media) return json({ error: "Media not found" }, 404);
    const object = await env.MEDIA.get(media.r2_key);
    if (!object) return json({ error: "Media file not found" }, 404);
    return new Response(object.body, { headers: {
      "content-type": media.mime_type,
      "cache-control": "private, max-age=3600",
    } });
  }
  if (match && request.method === "DELETE") {
    const media = await env.DB.prepare(`SELECT r2_key FROM sexting_media WHERE id = ?`)
      .bind(Number(match[1])).first<{ r2_key: string }>();
    if (!media) return json({ error: "Media not found" }, 404);
    await env.MEDIA.delete(media.r2_key);
    await env.DB.prepare(`DELETE FROM sexting_media WHERE id = ?`).bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Media request not found" }, 404);
}

async function handleAdminSettings(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { key?: string; value?: string };
  const allowed: Record<string, string[]> = {
    flirty_level: ["soft", "flirty", "very"],
    human_takeover: ["on", "off"],
    learning: ["approval", "off"],
    custom_approval: ["required", "off"],
    sexting_enabled: ["on", "off"],
    sexting_test_mode: ["on", "off"],
    sexting_intensity: ["soft", "hard", "hot"],
    sleep_hours_enabled: ["on", "off"],
  };
  const rateKeys = ["video_chat_rate", "custom_content_rate", "in_person_rate", "sexting_rate"];
  const starKeys = ["sexting_5_stars"];
  const textKeys = ["preferred_topics", "avoid_topics", "tone_guidance", "creator_feedback"];
  const timeKeys = ["sleep_start", "sleep_end"];
  const validRate = body.key && rateKeys.includes(body.key) && body.value &&
    Number.isFinite(Number(body.value)) && Number(body.value) > 0 && Number(body.value) <= 100000;
  const validStars = body.key && starKeys.includes(body.key) && body.value &&
    Number.isInteger(Number(body.value)) && Number(body.value) > 0 && Number(body.value) <= 10000;
  const validText = body.key && textKeys.includes(body.key) && typeof body.value === "string" && body.value.length <= 4000;
  const validTime = body.key && timeKeys.includes(body.key) && typeof body.value === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.value);
  if (!body.key || typeof body.value !== "string" || (!allowed[body.key]?.includes(body.value) && !validRate && !validStars && !validText && !validTime)) {
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

    if (url.pathname === "/api/admin/tasks" && request.method === "POST") {
      return handleAdminTasks(request, env);
    }

    if (url.pathname === "/api/admin/announcements" && request.method === "POST") {
      return handleAdminAnnouncements(request, env, ctx);
    }

    if (url.pathname.startsWith("/api/admin/social-links")) {
      return handleAdminSocialLinks(request, env, url);
    }

    if (url.pathname.startsWith("/api/admin/training")) {
      return handleAdminTraining(request, env, url);
    }

    if (url.pathname === "/api/admin/sexting" && request.method === "POST") {
      return handleAdminSexting(request, env);
    }

    if (url.pathname.startsWith("/api/admin/sexting-media")) {
      return handleAdminSextingMedia(request, env, url);
    }

    if (url.pathname.startsWith("/api/admin/sexting-scripts")) {
      return handleAdminSextingScripts(request, env, url);
    }

    if (url.pathname.startsWith("/api/admin/products")) {
      return handleAdminProducts(request, env, url);
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
