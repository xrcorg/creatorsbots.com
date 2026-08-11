import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { bookingDetailsMissing, customDetailsMissing, isAffirmativeReply, isBookingDecline, isBotQuestion, isCancelReply, isCustomDecline, isCustomDetailsFinished, isGenericCancelReply, isLikelyBookingDetailReply, isLikelyCityReply, isLikelyShippingAddress, isLikelyShippingName, isMessageBurst, isPhysicalOrderDecline, isRatingDecline, isSextingDecline, isSextingPackageFollowUp, isTrailerOfferAwaitingConfirmation, parseNameIntroduction } from "./conversation-rules";

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
  sender_business_bot?: { id: number; is_bot?: boolean };
  chat: { id: number };
  from?: { id: number; is_bot?: boolean; username?: string; first_name?: string; last_name?: string };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string }>;
  video?: { file_id: string };
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

const AGE_PROMPTS = [
  "Hey, before we text I need to make sure you're 18+ so we can talk about everything. Are you 18+?",
  "Before we start texting, I just need to make sure you're 18+ so we can talk openly. Are you 18+?",
  "Hey, I need to make sure you're 18+ before we talk about everything. Are you 18+?",
];

function agePrompt() {
  return AGE_PROMPTS[Math.floor(Math.random() * AGE_PROMPTS.length)];
}
const INTRO = "Hey, it's Tiffany. What are you up to?";
const NAME_PROMPT = "What's your name, babe?";
const CLOSED = "I can only chat with adults who are 18 or older. This conversation is now closed.";
const CREATOR_TAKEOVER = "__TIFFANI_TAKEOVER__";
// Temporary launch testing switch. Restore to false when realistic reply timing is ready.
const IMMEDIATE_TEST_RESPONSES = true;
const CAPABILITIES = "I can help you book a private video chat with me here on Telegram or an in person fan meet and greet. You can also buy photo and video content, shop clothing or worn items, request custom content, get a private video rating, or have a private sexting session with me. What sounds fun?";
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
  stars_price: number;
  genre: string;
  actors: string;
  trailer_url: string;
  delivery_url: string;
  active: number;
  created_at: string;
};

type ProductMedia = {
  id: number;
  product_id: number;
  media_type: "image" | "video";
  file_name: string;
  mime_type: string;
  r2_key: string;
};

function manualPaymentMethods(intro: string) {
  return `${intro}\nCash App: $playmatexoxo\nVenmo: @barbiedoll10\nZelle: valleyvillageconsulting@gmail.com\n\nPut your Telegram username in the payment notes and send me a screenshot after you pay.`;
}

function productPrice(product: ContentProduct) {
  return dollars(String(product.price_cents / 100), product.price_cents / 100);
}

function productOffer(product: ContentProduct) {
  if (product.content_type === "physical_item") {
    return `I have ${product.title} available for ${productPrice(product)}, babe. Do you want to buy it?`;
  }
  if (product.content_type === "video_rating") {
    return `I can give you a private video rating for ${videoRatingStars(product).toLocaleString()} Telegram Stars, babe. It's listed at ${productPrice(product)}. After payment, send me your photo and I'll respond with a short video clip. Do you want one?`;
  }
  const trailer = product.trailer_url ? `\n\nDo you want to buy it? Here's a trailer I have as well:\n${product.trailer_url}` : "\n\nDo you want to buy it?";
  return `My newest ${product.content_type.replaceAll("_", " ")} is ${product.title}${product.actors ? `, starring ${product.actors}` : ""}.${product.genre ? ` It's ${product.genre}.` : ""} It's ${productPrice(product)}.${trailer}`;
}

function productPaymentOptions(product: ContentProduct) {
  if (product.content_type === "video_rating") {
    return `Video ratings are ${videoRatingStars(product)} Telegram Stars, babe. I'll send the invoice here, then you can send the photo you want rated after it is paid.`;
  }
  const nextStep = product.content_type === "physical_item"
    ? "I will verify it, then I'll ask for your shipping name and address."
    : "I will verify it before I send the content to you.";
  return `Please send ${productPrice(product)} using:\nCash App: $playmatexoxo\nVenmo: @barbiedoll10\nZelle: valleyvillageconsulting@gmail.com\n\nIn the payment notes, put your Telegram username. ${nextStep} Send me a screenshot of the payment after you send it.`;
}

function videoRatingStars(product: ContentProduct) {
  return Math.max(1, Math.round(product.stars_price || 5000));
}

async function createVideoRatingCheckout(env: Env, message: TelegramMessage, product: ContentProduct) {
  const stars = videoRatingStars(product);
  await sendStarsInvoice(env, message, product.title,
    "Private video rating delivered as a short Telegram video clip.",
    `rating:${product.id}:${stars}:${product.title}`, stars);
}

async function sendVideoRatingCheckout(env: Env, db: D1Database, message: TelegramMessage, product: ContentProduct) {
  await createVideoRatingCheckout(env, message, product);
  const note = "I sent the Telegram Stars invoice, babe. Once it's paid, send me the photo you want rated.";
  await saveMessage(db, String(message.chat.id), "assistant", note);
  await sendTelegramMessage(env, message, note);
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

function customVideoPrompt(_settings: Record<string, string>) {
  return "Yeah babe, I make customs. Send me everything you want and how long you want it to be. You can send as many messages as you need, then say done when you're finished.";
}

function customDetailsCheckIn(details: string) {
  const variations = [
    { text: "Is that everything?", completionMode: "yes_done" },
    { text: "Anything else you want to add?", completionMode: "no_done" },
    { text: "Okay, you sure that's everything?", completionMode: "yes_done" },
    { text: "Anything else?", completionMode: "no_done" },
    { text: "Got it. Is there more?", completionMode: "no_done" },
    { text: "Okay babe, does that cover everything?", completionMode: "yes_done" },
  ];
  const detailCount = Math.max(1, details.split(/\n+/).filter(Boolean).length);
  return variations[(detailCount - 1) % variations.length];
}

function busyBurstReply(messageId: number) {
  const variations = [
    "Hey, sorry I'm busy right now, but I'll reply as soon as I can. Please be patient with me.",
    "Hey babe, I saw your messages. I'm a little busy, but I'll get back to you as soon as I can.",
    "Give me a little time, babe. I'm busy right now, but I'll reply as soon as I can.",
    "I saw everything you sent, babe. I'm busy right now, so please be patient and I'll reply as soon as I can.",
  ];
  return variations[Math.abs(messageId) % variations.length];
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
Her dream trips are Bali, Tokyo, and Costa Rica. Her guilty pleasure is pizza. Her favorite animal is a cat. Only the first favorite animal is known. If asked for a second, third, next, or other favorite animal and no approved learned answer supplies it, request creator takeover instead of inventing one.
She prefers tea, is a morning person, and is a homebody. Her ideal day off includes the spa, beach, and a relaxing massage.
She usually goes to bed around midnight. Automated replies stop at 2 AM Los Angeles time and resume at 8 AM.
For goodnight messages, say sweet dreams. Never say sleep sweet.
She has blonde hair and blue eyes. Her favorite lingerie brand is Honey Birdette.
When asked what I am wearing, vary the answer naturally across separate conversations. Lingerie can be black, red, white, blue, purple, pink, or another fitting color, and I can sometimes say I am nude when the adult conversation is sexual. Once an outfit is established in the current conversation, keep it unchanged until I explicitly describe taking it off, putting something on, or changing clothes. Track each clothing action in order. If I take off the last item, I remain nude until the conversation explicitly changes that state. Do not default to pink, invent a different outfit mid conversation, or repeat the same outfit description unnecessarily.
Maintain one continuous scene during an active conversation. Do not restart the scene, reintroduce the time of day, or add words such as tonight when the conversation is already underway unless the wording is genuinely needed for meaning.
She values acts of service. She likes easygoing and chill people. Bad hygiene and rudeness are instant turnoffs.
Her favorite date is dinner. She appreciates supportive fans and dislikes time wasters.
Answer known profile questions directly and naturally. Never ask Tiffani to answer when the profile already contains the answer.
When asked what you can do, explain that fans can book private video chats with me on Telegram and professional fan meet and greets, buy photo and video content, request custom content, or have a private sexting session with me.
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
During an active approved sexting session, treat consensual adult sexual wording as part of the fantasy conversation. Outside an active session, flirt naturally and offer a private sexting session instead of saying that I do not sell sex. Do not call it paid every time. Mention Stars or payment only when the fan asks about the price, chooses a package, asks how to pay, or says they are ready to start.
During an active sexting session, maintain the current sexual subject and scene. Never reinterpret a sexual word or fantasy reply as a request to buy content, order a custom, or book another service. Only recognize a business request when the fan clearly and explicitly asks to buy something, asks whether I make customs, or asks to book a service. Business requests made during the session must wait until the paid session ends.
If a fan asks to have sex with me or asks about in person sex, respond exactly: ${IN_PERSON_SEX_REPLY}
Never engage with or sexualize minors, suspected minors, coercion, incest, trafficking, rape, nonconsensual activity, or illegal activity.
Never discuss politics, religion, underage people, minors, children, kids, rape, poop, feces, scat, pee, urine, watersports, or bathroom play. Briefly decline and redirect to a light approved topic without explaining or debating the boundary.
Never reveal private addresses, passwords, financial credentials, or personal identifying information.
Do not promise a booking, custom request, discount, meeting, payment approval, or content delivery unless the application confirms it.
When a request needs Tiffani's decision or you are unsure, respond with exactly: ${CREATOR_TAKEOVER}
For personal favorite or preference questions, use only the approved performer profile or an approved learned answer. If the requested favorite, flavor, food, brand, ranking, or preference is not explicitly known, request creator takeover. Never invent a plausible favorite.
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
    db.prepare(`CREATE TABLE IF NOT EXISTS creator_accounts (
      creator_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      login_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      template_key TEXT,
      telegram_connected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS fan_sessions (
      chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT,
      business_connection_id TEXT,
      age_status TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS adult_verifications (
      telegram_user_id TEXT PRIMARY KEY,
      verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      stars_price INTEGER NOT NULL DEFAULT 0,
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
    db.prepare(`CREATE TABLE IF NOT EXISTS content_product_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      r2_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_content_product_media_product
      ON content_product_media(product_id, id)`),
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
      stars INTEGER NOT NULL DEFAULT 0,
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_type, source_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sale_disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_key TEXT NOT NULL,
      earnings_event_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      proof TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sale_disputes_status_created
      ON sale_disputes(status, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_drafts (
      chat_id TEXT PRIMARY KEY,
      business_connection_id TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_details',
      details TEXT NOT NULL DEFAULT '',
      completion_mode TEXT NOT NULL DEFAULT 'yes_done',
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
      completion_comment TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'awaiting_fulfillment',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS physical_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_request_id INTEGER NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      product_title TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      shipping_address TEXT NOT NULL DEFAULT '',
      tracking_number TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_name',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      shipped_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS rating_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_request_id INTEGER NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      business_connection_id TEXT,
      telegram_name TEXT NOT NULL,
      photo_file_id TEXT NOT NULL DEFAULT '',
      response_file_id TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 7500,
      stars INTEGER NOT NULL DEFAULT 750,
      telegram_charge_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'awaiting_photo',
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
      completed_at TEXT,
      control_mode TEXT NOT NULL DEFAULT 'bot',
      taken_over_at TEXT
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
    db.prepare(`INSERT OR IGNORE INTO creator_accounts
      (creator_key, display_name, login_email, status, telegram_connected)
      VALUES ('tiffani', 'Tiffani Madison', '', 'live', 1)`),
    db.prepare(`INSERT OR IGNORE INTO creator_accounts
      (creator_key, display_name, login_email, status, template_key, telegram_connected)
      VALUES ('madison', 'Madison Morgan', '', 'draft', 'tiffani', 0)`),
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
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_test_mode', 'off')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_intensity', 'soft')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_rate', '10')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_min_minutes', '5')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_5_stars', '500')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_10_stars', '1000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_15_stars', '6000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_30_stars', '10000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sexting_media_stars', '10000')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_hours_enabled', 'on')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_start', '02:00')"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sleep_end', '08:00')"),
    db.prepare("UPDATE app_settings SET value = 'off', updated_at = CURRENT_TIMESTAMP WHERE key = 'sexting_test_mode'"),
    db.prepare("UPDATE app_settings SET value = 'on', updated_at = CURRENT_TIMESTAMP WHERE key = 'human_takeover'"),
    db.prepare("UPDATE app_settings SET value = '500', updated_at = CURRENT_TIMESTAMP WHERE key = 'sexting_5_stars' AND value = '3850'"),
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
    db.prepare(`INSERT OR IGNORE INTO content_products
      (content_type, title, price_cents, genre, actors, trailer_url, delivery_url)
      VALUES ('video_rating', 'Video dick rating', 7500, '', '', '', '')`),
    db.prepare(`INSERT OR IGNORE INTO sexting_scripts
      (id, stage, title, script_text, media_label) VALUES
      (1, 'warmup', 'Warm conversation', 'Start with a short personal question about their day, interests, movies, or weekend. Respond to what they actually say before turning up the flirting.', 'Soft selfie'),
      (2, 'transition', 'Flirty transition', 'Shift naturally by saying you are feeling playful or naughty, then ask whether they want to have some private fun with you.', 'Teaser video'),
      (3, 'fantasy', 'Build the fantasy', 'Ask what they would do if they were with you. React to their answer, keep the fantasy consensual, and ask one specific follow up question at a time.', 'Approved tease photo'),
      (4, 'climax', 'Final minutes', 'Let them know you are getting close to the end of the session, raise the intensity, and ask if they are ready to finish with you.', 'Approved finale video'),
      (5, 'closing', 'Warm closing', 'Thank them, say you had fun, invite them to tell you what they liked, and ask whether they want another session sometime.', '')`),
  ]);
  const disputeColumns = await db.prepare("PRAGMA table_info(sale_disputes)").all<{ name: string }>();
  if (!disputeColumns.results.some((column) => column.name === "stars")) {
    await db.prepare("ALTER TABLE sale_disputes ADD COLUMN stars INTEGER NOT NULL DEFAULT 0").run();
  }
  const sextingColumns = await db.prepare("PRAGMA table_info(sexting_sessions)").all<{ name: string }>();
  if (!sextingColumns.results.some((column) => column.name === "control_mode")) {
    await db.prepare("ALTER TABLE sexting_sessions ADD COLUMN control_mode TEXT NOT NULL DEFAULT 'bot'").run();
  }
  if (!sextingColumns.results.some((column) => column.name === "taken_over_at")) {
    await db.prepare("ALTER TABLE sexting_sessions ADD COLUMN taken_over_at TEXT").run();
  }
  const customColumns = await db.prepare("PRAGMA table_info(custom_fulfillments)").all<{ name: string }>();
  if (!customColumns.results.some((column) => column.name === "completion_comment")) {
    await db.prepare("ALTER TABLE custom_fulfillments ADD COLUMN completion_comment TEXT NOT NULL DEFAULT ''").run();
  }
  const customDraftColumns = await db.prepare("PRAGMA table_info(custom_drafts)").all<{ name: string }>();
  if (!customDraftColumns.results.some((column) => column.name === "details")) {
    await db.prepare("ALTER TABLE custom_drafts ADD COLUMN details TEXT NOT NULL DEFAULT ''").run();
  }
  if (!customDraftColumns.results.some((column) => column.name === "completion_mode")) {
    await db.prepare("ALTER TABLE custom_drafts ADD COLUMN completion_mode TEXT NOT NULL DEFAULT 'yes_done'").run();
  }
  const contentColumns = await db.prepare("PRAGMA table_info(content_products)").all<{ name: string }>();
  if (!contentColumns.results.some((column) => column.name === "stars_price")) {
    await db.prepare("ALTER TABLE content_products ADD COLUMN stars_price INTEGER NOT NULL DEFAULT 0").run();
  }
  await db.prepare(`UPDATE content_products SET stars_price = 5000
    WHERE content_type = 'video_rating' AND stars_price = 0`).run();
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

async function sendTelegramProductMedia(env: Env, message: TelegramMessage, media: ProductMedia) {
  const object = await env.MEDIA.get(media.r2_key);
  if (!object) throw new Error(`Stored product file ${media.id} was not found`);
  const form = new FormData();
  form.set("chat_id", String(message.chat.id));
  if (message.business_connection_id) form.set("business_connection_id", message.business_connection_id);
  const method = media.media_type === "video" ? "sendVideo" : "sendPhoto";
  const field = media.media_type === "video" ? "video" : "photo";
  form.set(field, new File([await object.arrayBuffer()], media.file_name, { type: media.mime_type }));
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`Telegram media send failed with status ${response.status}`);
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
  return /\b(what can you do|what do you offer|what are you offering|services|menu|what (?:else )?can we (?:talk about|discuss)|what else (?:is there|do you do))\b/i.test(text);
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
  return /\b(blonde bombshell|trailer|buy (the )?(video|photo|content|panties|clothes|clothing)|purchase (the )?(video|photo|content|panties|clothes|clothing)|video for sale|content for sale|what.*sell|(?:what|see|show me).*(?:have|got).*(?:for sale|available)|(newest|latest|new) (video|photo|content)|most recent (video|photo|content)|panty|panties|worn clothing|clothing item|dick rating|rate my dick|rate my cock|video rating)\b/i.test(text);
}

function isPhysicalItemQuestion(text: string) {
  return /\b(panty|panties|worn item|worn clothing|clothes|clothing|outfit|lingerie for sale|sell.*(?:panties|clothes|clothing))\b/i.test(text);
}

function isVideoRatingQuestion(text: string) {
  return /\b(dick rating|rate my dick|rate my cock|cock rating|video rating)\b/i.test(text);
}

function isCatalogListQuestion(text: string) {
  return /\b(what|which|show me).*(videos|photos|content|packages|bundles).*(have|sell|available)|\b(?:what|see|show me).*(?:have|got).*(?:for sale|available)|\b(?:do you have|got|have you got)\s+(?:any\s+)?(?:videos|photos|content|packages|bundles)\b|\b(?:any|some)\s+(?:videos|photos|content|packages|bundles)(?:\s+(?:for sale|available))?\b|\b(content menu|catalog|shop menu)\b/i.test(text);
}

function askedToShowTrailer(text: string) {
  return /\b(?:want|wanna|like)\s+(?:me\s+)?to\s+(?:see|show|send)(?:\s+(?:you|me))?\s+(?:the\s+|a\s+)?(?:trailer|preview)|\b(?:want|wanna|like)\s+(?:to\s+)?see\s+(?:the\s+|a\s+)?(?:trailer|preview)\b/i.test(text);
}

function isDirectTrailerRequest(text: string) {
  return /\b(?:can|could|may)\s+i\s+(?:see|watch)\s+(?:the\s+|a\s+)?(?:trailer|preview)\b|\bdo\s+you\s+have\s+(?:the\s+|a\s+)?(?:trailer|preview)\b|\b(?:show|send)\s+me\s+(?:the\s+|a\s+)?(?:trailer|preview)\b|\b(?:see|watch)\s+(?:the\s+|a\s+)?(?:trailer|preview)\b/i.test(text);
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
  return /\b(custom|customs|custom video|custom content|custom photo|custom photos|make me a video|make me content|personalized video|personalized content|another custom|submit another idea|send another idea|give you another idea)\b/i.test(text);
}

function isAnotherCustomIdea(text: string) {
  return /\b(?:another custom|submit another idea|send another idea|give you another idea)\b/i.test(text);
}

function isExplicitBusinessRequest(text: string) {
  return /\b(i want to buy|i'd like to buy|id like to buy|can i buy|buy it|purchase it)\b/i.test(text) ||
    isProductQuestion(text) || isCatalogListQuestion(text) ||
    isCustomVideoQuestion(text) || isBookingQuestion(text) || isManualPaymentQuestion(text);
}

type ConversationFlow = "sexting" | "booking" | "custom" | "physical" | "rating" | "content";

function requestedConversationFlow(text: string): ConversationFlow | null {
  if (isVideoRatingQuestion(text) && !isRatingDecline(text)) return "rating";
  if (isPhysicalItemQuestion(text) && !isPhysicalOrderDecline(text)) return "physical";
  if (isBookingQuestion(text) && !isBookingDecline(text)) return "booking";
  if (isCustomVideoQuestion(text) && !isCustomDecline(text)) return "custom";
  if (isProductQuestion(text) || isCatalogListQuestion(text)) return "content";
  if (isSextingQuestion(text)) return "sexting";
  return null;
}

function isTurnaroundQuestion(text: string) {
  return /\b(when will (?:you|it)|when.*done|how long.*(?:take|until)|turnaround|when can i get|when.*ready)\b/i.test(text);
}

function isTodayActivityQuestion(text: string) {
  return /\b(what are you doing(?: today| right now)?|what are you (?:really )?up to(?: today| right now)?|what do you have planned today|plans for today|what's your day looking like|whats your day looking like)\b/i.test(text);
}

function isMoviePlanFollowUp(text: string) {
  return /\b(?:which|what) movie\b|\bmovie (?:are|will) you (?:seeing|watching)\b/i.test(text);
}

function knownProfilePreferenceReply(text: string) {
  if (/\b(second|third|fourth|next|other)\b/i.test(text)) return null;
  const normalized = text.toLowerCase();
  const asksFavorite = /\b(favou?rite|prefer|like best|go to)\b/i.test(text);
  if (!asksFavorite) return null;
  if (/\bperfume|fragrance|scent to wear\b/.test(normalized)) return "Versace Bright Crystal is my favorite perfume. What do you wear?";
  if (/\b(lingerie brand|lingerie)\b/.test(normalized)) return "Honey Birdette is my favorite lingerie brand, babe. Do you like it?";
  if (/\b(ice cream|flavou?r|brand)\b/.test(normalized)) return null;
  if (/\banimals?\b/.test(normalized)) return "Cats are my favorite, babe. What's yours?";
  if (/\b(dessert|cake|sweet treat)\b/.test(normalized)) return "Chocolate cake is my favorite dessert, babe. What's yours?";
  if (/\b(food|meal|comfort food|cuisine)\b/.test(normalized)) return "Sushi is my favorite, babe. I could eat it all the time. What's yours?";
  if (/\bcolors?\b/.test(normalized)) return "Pink is my favorite color, babe. What's yours?";
  if (/\bseasons?\b/.test(normalized)) return "Fall is my favorite season. I love the whole vibe. What's yours?";
  if (/\bholidays?\b/.test(normalized)) return "Halloween is my favorite holiday, babe. What's yours?";
  if (/\bnonalcoholic drink|non alcoholic drink|soft drink|drink without alcohol\b/.test(normalized)) return "Matcha is my favorite nonalcoholic drink. What's yours?";
  if (/\b(alcohol|cocktail|drink)\b/.test(normalized)) return "Champagne is my favorite drink, babe. What's yours?";
  if (/\bflowers?\b/.test(normalized)) return "Orchids are my favorite flowers. What's yours?";
  if (/\bcandles?|candle scent\b/.test(normalized)) return "Lavender is my favorite candle scent. What's yours?";
  if (/\b(musician|artist|singer)\b/.test(normalized)) return "Doja Cat is my favorite artist. Who do you listen to?";
  if (/\bsongs?\b/.test(normalized)) return "Streets by Doja Cat is one of my favorite songs. What's yours?";
  if (/\bmovies?|films?\b/.test(normalized)) return "True Romance is my favorite movie. Have you seen it?";
  if (/\b(show|series|tv show)\b/.test(normalized)) return "Euphoria is my favorite show. What are you watching?";
  if (/\bbooks?\b/.test(normalized)) return "The Art of Seduction is one of my favorite books. What do you like to read?";
  if (/\brestaurants?\b/.test(normalized)) return "Katsuya is my favorite restaurant. What's yours?";
  return null;
}

function isHowAreYouQuestion(text: string) {
  return /\b(how are you|how're you|how are you doing|how have you been|how do you feel|how are you feeling)\b/i.test(text);
}

function isSextingQuestion(text: string) {
  if (isSextingDecline(text) ||
      (isBookingQuestion(text) && !isBookingDecline(text)) ||
      (isCustomVideoQuestion(text) && !isCustomDecline(text)) ||
      (isPhysicalItemQuestion(text) && !isPhysicalOrderDecline(text)) ||
      (isVideoRatingQuestion(text) && !isRatingDecline(text))) return false;
  return /\b(sext|sexting|dirty text|dirty texting|text session|i want sex|want to have sex|what are you wearing)\b/i.test(text);
}

function isInPersonSexSolicitation(text: string) {
  return /\b(meet|meeting|in person|come over|hook up)\b[\s\S]*\b(sex|fuck|sexual)\b|\b(sex|fuck|sexual)\b[\s\S]*\b(meet|meeting|in person|come over|hook up)\b|\b(?:can|could|would|will)\s+(?:we|i)\s+(?:have\s+sex|fuck)\b|\b(?:have\s+sex|fuck)\s+with\s+(?:you|me)\b/i.test(text);
}

function isPermanentlyRestrictedTopic(text: string) {
  return /\b(politics|political|president|election|religion|religious|christianity|catholicism|islam|judaism|underage|minor|minors|child|children|kid|kids|rape|raped|raping|nonconsensual|non-consensual|poop|pooping|feces|scat|pee|peeing|piss|pissing|urine|watersports?|bathroom play|illegal activity)\b/i.test(text);
}

function sextingPackage(text: string, settings: Record<string, string>) {
  const minimumMinutes = Math.max(1, Math.min(9, Number(settings.sexting_min_minutes || 5)));
  const numberWords = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  if (/\b(10|ten)\b/.test(text)) return { key: "text10", title: "10 minute sexting session", minutes: 10, stars: Number(settings.sexting_10_stars || 1000) };
  if (new RegExp(`\\b(?:${minimumMinutes}|${numberWords[minimumMinutes]}|minimum|short)\\b`, "i").test(text)) {
    return { key: "text5", title: `${minimumMinutes} minute sexting session`, minutes: minimumMinutes, stars: Number(settings.sexting_5_stars || 500) };
  }
  return null;
}

function sextingSessionMinutes(packageKey: string, purchasedMinutes: number) {
  const [minimum, maximum] = packageKey === "text5" || packageKey === "text10"
    ? [purchasedMinutes + 1, purchasedMinutes + 3]
    : [purchasedMinutes, purchasedMinutes];
  return Math.floor(minimum + Math.random() * (maximum - minimum + 1));
}

function isSextingPaymentQuestion(text: string) {
  return /\b(how (?:do|can) i pay|how to pay|pay for it|send (?:me )?(?:the )?invoice|stars invoice|ready to pay)\b/i.test(text) ||
    /\b(?:pay|payment)\b[\s\S]*\b(?:cash ?app|venmo|zelle|paypal|crypto|card|cash|instead)\b|\b(?:cash ?app|venmo|zelle|paypal|crypto|card|cash)\b[\s\S]*\b(?:pay|payment|instead)\b/i.test(text);
}

function isSextingTimeQuestion(text: string) {
  return /\b(how much|what|any)\s+time\s+(?:do\s+i\s+have\s+)?left\b|\bhow\s+long\s+(?:do\s+i\s+have|is\s+left|left)\b|\btime\s+remaining\b/i.test(text);
}

function sextingMenu(settings: Record<string, string>) {
  const minimumMinutes = Math.max(1, Math.min(9, Number(settings.sexting_min_minutes || 5)));
  return `Sexting is ${settings.sexting_5_stars || "500"} Stars for ${minimumMinutes} minutes or ${settings.sexting_10_stars || "1000"} Stars for 10 minutes, babe. Which one do you want?`;
}

async function createSextingCheckout(env: Env, message: TelegramMessage,
  selected: { key: string; title: string; minutes: number; stars: number }) {
  await sendStarsInvoice(env, message, selected.title,
    `${selected.minutes} minute private sexting session.`,
    `sexting:${selected.key}:${selected.minutes}:${selected.title}`, selected.stars);
  return "invoice_sent";
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
  return db.prepare(`SELECT id, content_type, title, price_cents, stars_price, genre, actors,
    trailer_url, delivery_url, active, created_at FROM content_products
    WHERE active = 1 AND content_type NOT IN ('physical_item', 'video_rating')
    ORDER BY id DESC LIMIT 1`).first<ContentProduct>();
}

async function getActiveProducts(db: D1Database) {
  const products = await db.prepare(`SELECT id, content_type, title, price_cents, stars_price, genre,
    actors, trailer_url, delivery_url, active, created_at FROM content_products
    WHERE active = 1 ORDER BY id DESC LIMIT 25`).all<ContentProduct>();
  return products.results;
}

function catalogReply(products: ContentProduct[]) {
  if (!products.length) return "I'm adding new content soon, babe. What kind of content do you want to see?";
  const lines = products.slice(0, 10).map((product) =>
    `${product.title} · ${product.content_type.replaceAll("_", " ")} · ${product.content_type === "video_rating" ? `${videoRatingStars(product).toLocaleString()} Stars` : productPrice(product)}`);
  return `Here's what I have right now, babe:\n\n${lines.join("\n")}\n\nTell me which title you want and I'll show you the details.`;
}

async function getInterestedProduct(db: D1Database, chatId: string) {
  return db.prepare(`SELECT content_products.id, content_products.content_type,
    content_products.title, content_products.price_cents, content_products.genre,
    content_products.stars_price, content_products.actors, content_products.trailer_url, content_products.delivery_url,
    content_products.active, content_products.created_at FROM product_interest
    JOIN content_products ON content_products.id = product_interest.product_id
    WHERE product_interest.chat_id = ? AND content_products.active = 1`)
    .bind(chatId).first<ContentProduct>();
}

async function getTrailerFollowUpProduct(db: D1Database, chatId: string) {
  const [lastAssistant, products] = await Promise.all([
    db.prepare(`SELECT content FROM chat_messages WHERE chat_id = ? AND role = 'assistant'
      ORDER BY id DESC LIMIT 1`).bind(chatId).first<{ content: string }>(),
    getActiveProducts(db),
  ]);
  const mentioned = lastAssistant
    ? products.filter((product) => lastAssistant.content.toLowerCase().includes(product.title.toLowerCase()))
    : [];
  if (mentioned.length === 1) return { product: mentioned[0], ambiguous: false };
  if (mentioned.length > 1) return { product: null, ambiguous: true };
  return { product: await getInterestedProduct(db, chatId) || await getNewestProduct(db), ambiguous: false };
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
  if (IMMEDIATE_TEST_RESPONSES) return 0;
  const minimumSeconds = activeSexting ? 20 : 25;
  const maximumSeconds = activeSexting ? 25 : 420;
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

  const buffered = await db.prepare(`SELECT message_id, message_text
    FROM inbound_message_buffer WHERE chat_id = ? AND created_at >= datetime('now', '-10 minutes')
    ORDER BY message_id ASC LIMIT 200`)
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

async function hasNewerBufferedMessage(db: D1Database, chatId: string, messageId: number) {
  const newer = await db.prepare(`SELECT message_id FROM inbound_message_buffer
    WHERE chat_id = ? AND message_id > ? ORDER BY message_id DESC LIMIT 1`)
    .bind(chatId, messageId).first<{ message_id: number }>();
  return Boolean(newer);
}

function isMultiConversationalTurn(text: string, count: number) {
  if (/\b(sext|video chat|video call|meet|meeting|book|buy|pay|payment|custom|content|photo|video|trailer|sell|sale|available)\b/i.test(text)) return false;
  const conversationalSignals = [isGreeting(text), isHowAreYouQuestion(text), isTodayActivityQuestion(text)]
    .filter(Boolean).length;
  return conversationalSignals >= 2 || (count >= 2 && (text.match(/\?/g)?.length || 0) >= 2);
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
      AND ends_at IS NOT NULL AND ends_at > CURRENT_TIMESTAMP
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
      instructions: `${TIFFANI_PROMPT}\nCurrent time context: ${pacificTimeContext()} Use this context in every reply. Keep activities, greetings, meals, sleep references, tense, and plans appropriate for the actual Pacific time and weekday. Do not claim to be at a public event, holiday celebration, appointment, trip, movie, or scheduled engagement unless it appears in the creator's approved information or recent conversation. Never contradict a plan already stated in the conversation.\nThe fan's name is ${profile?.name || "unknown"}. Use their name naturally and occasionally, not in every response.\nCurrent flirty level: ${settings.flirty_level || "very"}.\nCurrent rates: video chat ${dollars(settings.video_chat_rate, 50)} per minute with a 5 minute minimum and in person meetings ${dollars(settings.in_person_rate, 1500)} per hour. Custom content never has a universal rate. Collect the fan's idea and requested length, then say I will review it and provide a quote. Never invent or estimate a custom price.\nCreator approved topics to discuss: ${settings.preferred_topics || "No additional topics supplied."}\nCreator topics to avoid: ${settings.avoid_topics || "No additional topics supplied."}\nCreator tone guidance: ${settings.tone_guidance || "Short, blunt, warm, confident, flirty, and natural."}\nCreator feedback about my habits: ${settings.creator_feedback || "No additional feedback supplied."}\n${activeSexting ? `An approved ${activeSexting.duration_minutes} minute sexting session is active now. You may respond explicitly between consenting adults. Current creator selected intensity: ${settings.sexting_intensity || "soft"}. Soft means intimate, playful, and gently explicit. Hard means direct and assertive while remaining clearly consensual. Hot means highly explicit while still consensual and within the creator's approved boundaries. At every intensity, exclude age coded roleplay, incest, choking, breath restriction, injury, forced activity, threats, humiliation that was not specifically approved, or language suggesting ignored boundaries. Use the approved playbook below as guidance, adapt it naturally to the fan's replies, never repeat a line mechanically, and never claim to send media unless the application actually sends it.\nApproved sexting playbook:\n${sextingScripts.results.map((item) => `${item.stage}: ${item.title}\n${item.script_text}${item.media_label ? `\nSuggested creator media: ${item.media_label}` : ""}`).join("\n\n")}` : "No sexting session is active. Do not provide a free explicit sexting session. Flirt naturally and offer a private sexting session. Do not mention payment or Stars until the fan asks about price, selects five or ten minutes, asks how to pay, or says they are ready."}\nFollow creator preferences unless they conflict with safety, age restrictions, privacy, or the fixed business rules above.\nApproved learned answers:\n${settings.learning === "off" ? "Learning is off." : learned.results
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
    const payload = update.pre_checkout_query.invoice_payload;
    const [, key] = payload.split(":");
    let valid = false;
    if (payload.startsWith("rating:")) {
      const product = await env.DB.prepare(`SELECT id, content_type, title, price_cents, stars_price, genre, actors,
        trailer_url, delivery_url, active, created_at FROM content_products
        WHERE id = ? AND content_type = 'video_rating' AND active = 1`).bind(Number(key)).first<ContentProduct>();
      valid = Boolean(product) && update.pre_checkout_query.currency === "XTR" &&
        update.pre_checkout_query.total_amount === (product ? videoRatingStars(product) : 0);
    } else {
      const expectedStars = key === "text5" ? Number(settings.sexting_5_stars || 500)
        : key === "text10" ? Number(settings.sexting_10_stars || 1000) : 0;
      valid = settings.sexting_enabled !== "off" && update.pre_checkout_query.currency === "XTR" &&
        payload.startsWith("sexting:") && update.pre_checkout_query.total_amount === expectedStars;
    }
    await answerPreCheckout(env, update.pre_checkout_query.id, valid,
      valid ? undefined : "This package is no longer available.");
    return json({ ok: true });
  }
  const message = update.business_message || update.message;
  if (!message || message.from?.is_bot) return json({ ok: true });
  if (message.successful_payment?.currency === "XTR" && message.successful_payment.invoice_payload.startsWith("rating:")) {
    const [, productIdText] = message.successful_payment.invoice_payload.split(":");
    const product = await env.DB.prepare(`SELECT id, content_type, title, price_cents, stars_price, genre, actors,
      trailer_url, delivery_url, active, created_at FROM content_products
      WHERE id = ? AND content_type = 'video_rating'`).bind(Number(productIdText)).first<ContentProduct>();
    if (!product || message.successful_payment.total_amount !== videoRatingStars(product)) {
      return json({ ok: false, error: "The video rating package changed before payment completed." }, 409);
    }
    const chatId = String(message.chat.id);
    const contact = await env.DB.prepare(`SELECT COALESCE(telegram_contacts.username,
      telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name
      FROM fan_sessions LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = fan_sessions.chat_id
      LEFT JOIN fan_profiles ON fan_profiles.chat_id = fan_sessions.chat_id
      WHERE fan_sessions.chat_id = ?`).bind(chatId).first<{ telegram_name: string }>();
    await env.DB.prepare(`INSERT INTO purchase_requests
      (chat_id, business_connection_id, product_title, price, payment_note, status, resolved_at)
      VALUES (?, ?, ?, ?, 'Telegram Stars payment', 'approved', CURRENT_TIMESTAMP)`)
      .bind(chatId, message.business_connection_id || null, product.title, productPrice(product)).run();
    const purchase = await env.DB.prepare(`SELECT id FROM purchase_requests WHERE chat_id = ?
      AND product_title = ? AND status = 'approved' ORDER BY id DESC LIMIT 1`)
      .bind(chatId, product.title).first<{ id: number }>();
    if (purchase) {
      await env.DB.prepare(`INSERT OR IGNORE INTO rating_orders
        (purchase_request_id, chat_id, business_connection_id, telegram_name, amount_cents,
        stars, telegram_charge_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(purchase.id, chatId, message.business_connection_id || null,
          contact?.telegram_name || "Telegram fan", product.price_cents,
          message.successful_payment.total_amount, message.successful_payment.telegram_payment_charge_id).run();
    }
    await sendTelegramMessage(env, message,
      "I got your Stars payment, babe. Send the photo you want me to rate here and I'll respond with a private video clip.");
    return json({ ok: true });
  }
  if (message.successful_payment?.currency === "XTR" && message.successful_payment.invoice_payload.startsWith("sexting:")) {
    const [, key, minutesText, title] = message.successful_payment.invoice_payload.split(":");
    const minutes = sextingSessionMinutes(key, Number(minutesText));
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
  const chatId = String(message.chat.id);
  const isCreatorBusinessReply = Boolean(message.business_connection_id && message.from?.id !== message.chat.id &&
    !message.sender_business_bot);
  if (isCreatorBusinessReply && message.video?.file_id) {
    const completedRating = await env.DB.prepare(`UPDATE rating_orders SET status = 'completed',
      response_file_id = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM rating_orders WHERE chat_id = ? AND status = 'awaiting_response'
        ORDER BY id DESC LIMIT 1)`)
      .bind(message.video.file_id, chatId).run();
    if (completedRating.meta.changes) {
      await saveMessage(env.DB, chatId, "assistant", "Creator sent the private video rating.");
      return json({ ok: true, rating_completed: true });
    }
  }
  if (!message.text && message.photo?.length) {
    message.text = message.caption?.trim() || "Payment screenshot sent";
  }
  if (!message.text && message.caption?.trim()) message.text = message.caption.trim();
  if (!message.text) return json({ ok: true });
  const userId = message.from?.id ? String(message.from.id) : null;
  const connectionId = message.business_connection_id || null;

  // A Telegram Business owner's outgoing message has the fan's chat id but the
  // owner's sender id. Bot-authored business messages carry sender_business_bot.
  // Treat a personal creator reply as an immediate handoff for an active session.
  if (isCreatorBusinessReply) {
    const takeover = await env.DB.prepare(`UPDATE sexting_sessions
      SET control_mode = 'human', taken_over_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM sexting_sessions WHERE chat_id = ? AND status = 'active'
        AND ends_at IS NOT NULL AND ends_at > CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1)`)
      .bind(chatId).run();
    if (takeover.meta.changes) {
      await saveMessage(env.DB, chatId, "assistant", message.text);
      return json({ ok: true, creator_takeover: true });
    }
    return json({ ok: true, creator_message: true });
  }

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

  if (session?.age_status === "verified" && userId) {
    await env.DB.prepare(`INSERT OR IGNORE INTO adult_verifications (telegram_user_id) VALUES (?)`)
      .bind(userId).run();
  }

  if (session?.age_status !== "verified") {
    const priorVerification = userId ? await env.DB.prepare(`SELECT telegram_user_id FROM adult_verifications
      WHERE telegram_user_id = ?`).bind(userId).first() : null;
    const priorProfile = await env.DB.prepare(`SELECT name FROM fan_profiles WHERE chat_id = ? AND name IS NOT NULL`)
      .bind(chatId).first();
    const priorPaidSession = await env.DB.prepare(`SELECT id FROM sexting_sessions WHERE chat_id = ? LIMIT 1`)
      .bind(chatId).first();
    if (priorVerification || priorProfile || priorPaidSession) {
      await env.DB.prepare(`UPDATE fan_sessions SET age_status = 'verified', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      session.age_status = "verified";
    }
  }

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
      if (userId) {
        await env.DB.prepare(`INSERT OR IGNORE INTO adult_verifications (telegram_user_id) VALUES (?)`)
          .bind(userId).run();
      }
      await env.DB.prepare(`INSERT INTO fan_profiles (chat_id, name_status) VALUES (?, 'awaiting_name')
        ON CONFLICT(chat_id) DO UPDATE SET name_status = CASE
          WHEN fan_profiles.name IS NULL THEN 'awaiting_name' ELSE fan_profiles.name_status END,
          updated_at = CURRENT_TIMESTAMP`).bind(chatId).run();
      const knownProfile = await env.DB.prepare(`SELECT name FROM fan_profiles WHERE chat_id = ?`)
        .bind(chatId).first<{ name: string | null }>();
      await sendTelegramMessage(env, message, knownProfile?.name
        ? INTRO
        : "Hey, it's Tiffany. What's your name, babe?");
    } else if (isAdultNo(message.text)) {
      await env.DB.prepare("UPDATE fan_sessions SET age_status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?")
        .bind(chatId)
        .run();
      await sendTelegramMessage(env, message, CLOSED);
    } else {
      await sendTelegramMessage(env, message, agePrompt());
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

  const physicalOrder = await env.DB.prepare(`SELECT id, status FROM physical_orders
    WHERE chat_id = ? AND status IN ('awaiting_name', 'awaiting_address') ORDER BY id DESC LIMIT 1`)
    .bind(chatId).first<{ id: number; status: string }>();
  const cancelPhysicalOrder = isGenericCancelReply(message.text) || isPhysicalOrderDecline(message.text);
  const shouldHandlePhysicalOrder = Boolean(physicalOrder && (cancelPhysicalOrder ||
    (physicalOrder.status === "awaiting_name" && isLikelyShippingName(message.text)) ||
    (physicalOrder.status === "awaiting_address" && isLikelyShippingAddress(message.text))));
  if (physicalOrder && shouldHandlePhysicalOrder) {
    if (cancelPhysicalOrder) {
      await env.DB.prepare(`UPDATE physical_orders SET status = 'cancelled' WHERE id = ?`)
        .bind(physicalOrder.id).run();
      await sendSavedReply(env, message, chatId, "No problem, lmk if you want anything else!");
      return json({ ok: true, physical_order_cancelled: true });
    }
    if (physicalOrder.status === "awaiting_name") {
      const shippingName = message.text.trim().slice(0, 120);
      await env.DB.prepare(`UPDATE physical_orders SET customer_name = ?, status = 'awaiting_address' WHERE id = ?`)
        .bind(shippingName, physicalOrder.id).run();
      await sendTelegramMessage(env, message, "What shipping address should I send it to, babe? Include the street, city, state, ZIP code, and country.");
      return json({ ok: true, shipping_name_saved: true });
    }
    const shippingAddress = message.text.trim().slice(0, 600);
    await env.DB.prepare(`UPDATE physical_orders SET shipping_address = ?, status = 'awaiting_shipment' WHERE id = ?`)
      .bind(shippingAddress, physicalOrder.id).run();
    await sendTelegramMessage(env, message, "Got it, babe. I'll send you the tracking number here when it ships.");
    return json({ ok: true, shipping_address_saved: true });
  }

  const ratingOrder = await env.DB.prepare(`SELECT id FROM rating_orders
    WHERE chat_id = ? AND status = 'awaiting_photo' ORDER BY id DESC LIMIT 1`)
    .bind(chatId).first<{ id: number }>();
  const cancelRatingOrder = isGenericCancelReply(message.text) || isRatingDecline(message.text);
  const shouldHandleRatingOrder = Boolean(ratingOrder && (cancelRatingOrder ||
    message.photo?.length || requestedConversationFlow(message.text) === "rating"));
  if (ratingOrder && shouldHandleRatingOrder) {
    if (cancelRatingOrder) {
      await env.DB.prepare(`UPDATE rating_orders SET status = 'cancelled' WHERE id = ?`).bind(ratingOrder.id).run();
      await sendSavedReply(env, message, chatId, "No problem, lmk if you want a rating later!");
      return json({ ok: true, rating_cancelled: true });
    }
    const photoFileId = message.photo?.at(-1)?.file_id;
    if (!photoFileId) {
      await sendTelegramMessage(env, message, "Send the photo you want me to rate here, babe.");
      return json({ ok: true, rating_photo_needed: true });
    }
    await env.DB.prepare(`UPDATE rating_orders SET photo_file_id = ?, status = 'awaiting_response' WHERE id = ?`)
      .bind(photoFileId, ratingOrder.id).run();
    await sendTelegramMessage(env, message, "Got it, babe. I'll send your private video rating here when it's ready.");
    return json({ ok: true, rating_photo_received: true });
  }

  const latestSextingSession = await env.DB.prepare(`SELECT id, status, ends_at, control_mode FROM sexting_sessions
    WHERE chat_id = ? ORDER BY id DESC LIMIT 1`).bind(chatId)
    .first<{ id: number; status: string; ends_at: string | null; control_mode: string }>();
  const activeHumanTakeover = latestSextingSession?.status === "active" &&
    latestSextingSession.control_mode === "human" && Boolean(latestSextingSession.ends_at) &&
      Date.parse(`${latestSextingSession.ends_at!.replace(" ", "T")}Z`) > Date.now();
  if (activeHumanTakeover) {
    if (isGenericCancelReply(message.text) || isSextingDecline(message.text)) {
      await env.DB.prepare(`UPDATE sexting_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(latestSextingSession.id).run();
      await sendSavedReply(env, message, chatId, SEXTING_CANCELLATION_REPLY);
      return json({ ok: true, sexting_cancelled: true });
    }
    await saveMessage(env.DB, chatId, "user", message.text);
    return json({ ok: true, creator_controlling_session: true });
  }
  if (isSextingTimeQuestion(message.text) && latestSextingSession?.ends_at) {
    await new Promise((resolve) => setTimeout(resolve, randomResponseDelayMs(true)));
    const endTime = Date.parse(`${latestSextingSession.ends_at.replace(" ", "T")}Z`);
    const secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const timeReply = secondsLeft > 0
      ? `You have about ${Math.max(1, Math.ceil(secondsLeft / 60))} minutes left, babe.`
      : "Our session just ended, babe. Want another 5 or 10 minutes?";
    await sendSavedReply(env, message, chatId, timeReply);
    return json({ ok: true, sexting_time: true });
  }

  await env.DB.prepare(`UPDATE sexting_sessions SET status = 'completed',
    completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
    WHERE chat_id = ? AND status = 'active' AND (ends_at IS NULL OR ends_at <= CURRENT_TIMESTAMP)`)
    .bind(chatId).run();
  const activeSextingSession = await env.DB.prepare(`SELECT id, control_mode FROM sexting_sessions
    WHERE chat_id = ? AND status = 'active' AND ends_at IS NOT NULL AND ends_at > CURRENT_TIMESTAMP
    ORDER BY id DESC LIMIT 1`)
    .bind(chatId).first<{ id: number; control_mode: string }>();
  const pendingSextingDraft = await env.DB.prepare(`SELECT status,
    CASE WHEN status = 'awaiting_package' AND updated_at < datetime('now', '-15 minutes') THEN 1 ELSE 0 END AS stale
    FROM sexting_drafts WHERE chat_id = ?`)
    .bind(chatId).first<{ status: string; stale: number }>();
  if (pendingSextingDraft?.stale) {
    await env.DB.prepare(`UPDATE sexting_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ? AND status = 'awaiting_package'`).bind(chatId).run();
    pendingSextingDraft.status = "cancelled";
  }
  const collected = await collectQuickMessages(env.DB, chatId, message,
    Boolean(activeSextingSession || pendingSextingDraft?.status === "awaiting_package" ||
      (pendingSextingDraft && isSextingPaymentQuestion(message.text))));
  if (!collected) return json({ ok: true, combined_with_newer_message: true });
  message.text = collected.text;
  const requestedFlow = requestedConversationFlow(message.text);
  const customDraft = await env.DB.prepare(`SELECT status, details, completion_mode FROM custom_drafts
    WHERE chat_id = ?`).bind(chatId).first<{ status: string; details: string; completion_mode: string }>();
  const collectingCustomDetails = customDraft?.status === "awaiting_details";
  if (isMessageBurst(collected.count)) {
    if (isPermanentlyRestrictedTopic(message.text)) {
      const redirect = "I don't talk about that, babe. Let's keep it fun and positive. What else are you into?";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", redirect);
      await sendTelegramMessage(env, message, redirect);
      return json({ ok: true, restricted_burst: true });
    }
    if (collectingCustomDetails && customDraft) {
      const burstDetails = message.text.split(/\n+/).map((part) => part.trim()).filter(Boolean)
        .filter((part) => !isCustomDetailsFinished(part)).join("\n");
      const savedDetails = [customDraft.details.trim(), burstDetails]
        .filter(Boolean).join("\n").slice(0, 100000);
      await env.DB.prepare(`UPDATE custom_drafts SET details = ?, updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(savedDetails, chatId).run();
    }
    const busyReply = busyBurstReply(message.message_id);
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", busyReply);
    await sendTelegramMessage(env, message, busyReply);
    return json({ ok: true, message_burst_limited: true });
  }

  // A fan can change the subject after seeing the sexting packages. Clear that
  // temporary choice before any normal conversation handler returns, otherwise
  // a later follow up can be mistaken for another package response.
  if (pendingSextingDraft?.status === "awaiting_package" &&
      (isSextingDecline(message.text) ||
        (requestedFlow !== null && requestedFlow !== "sexting") ||
        (!isGenericCancelReply(message.text) &&
          !isSextingPaymentQuestion(message.text) &&
          !isSextingPackageFollowUp(message.text)))) {
    await env.DB.prepare(`UPDATE sexting_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    pendingSextingDraft.status = "cancelled";
  }

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
    if (isGenericCancelReply(message.text) || isSextingDecline(message.text)) {
      await env.DB.prepare(`UPDATE sexting_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(activeSextingSession.id).run();
      await sendSavedReply(env, message, chatId, SEXTING_CANCELLATION_REPLY);
      return json({ ok: true, sexting_cancelled: true });
    }
    const currentControl = await env.DB.prepare(`SELECT control_mode FROM sexting_sessions WHERE id = ?`)
      .bind(activeSextingSession.id).first<{ control_mode: string }>();
    if (currentControl?.control_mode === "human") {
      await saveMessage(env.DB, chatId, "user", message.text);
      return json({ ok: true, creator_controlling_session: true });
    }
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
    if (await hasNewerBufferedMessage(env.DB, chatId, message.message_id)) {
      return json({ ok: true, combined_with_newer_message: true });
    }
    const controlBeforeSend = await env.DB.prepare(`SELECT control_mode FROM sexting_sessions WHERE id = ?`)
      .bind(activeSextingSession.id).first<{ control_mode: string }>();
    await saveMessage(env.DB, chatId, "user", message.text);
    if (controlBeforeSend?.control_mode === "human") {
      return json({ ok: true, creator_controlling_session: true });
    }
    if (sextingReply === CREATOR_TAKEOVER) {
      if (settings.human_takeover !== "off") await queueCreatorReply(env.DB, message);
      return json({ ok: true, creator_reply_needed: true });
    }
    await saveMessage(env.DB, chatId, "assistant", sextingReply);
    await sendTelegramMessage(env, message, sextingReply);
    return json({ ok: true, active_sexting: true });
  }

  if (!collectingCustomDetails && isMultiConversationalTurn(message.text, collected.count)) {
    let combinedReply = CREATOR_TAKEOVER;
    try {
      combinedReply = await createAIReply(env, chatId, message.text);
    } catch (error) {
      console.error("Combined conversation reply failed", error);
    }
    if (await hasNewerBufferedMessage(env.DB, chatId, message.message_id)) {
      return json({ ok: true, combined_with_newer_message: true });
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

  if (!collectingCustomDetails && isBotQuestion(message.text)) {
    const automationReply = "It's me, babe, but sometimes my chat automatically responds to basic questions. I personally handle anything that needs me.";
    await sendSavedReply(env, message, chatId, automationReply);
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isCapabilitiesQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, CAPABILITIES);
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isSocialQuestion(message.text)) {
    const socialReply = await socialReplyFor(env.DB, message.text);
    await sendSavedReply(env, message, chatId, socialReply);
    return json({ ok: true });
  }

  const preferenceReply = collectingCustomDetails ? null : knownProfilePreferenceReply(message.text);
  if (preferenceReply) {
    await sendSavedReply(env, message, chatId, preferenceReply);
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isTodayActivityQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, randomTodayActivity(chatId));
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isMoviePlanFollowUp(message.text) && isCatalogListQuestion(message.text)) {
    const catalog = catalogReply(await getActiveProducts(env.DB));
    const combinedReply = `I haven't picked the movie yet. What do you think I should see?\n\n${catalog}`;
    await sendSavedReply(env, message, chatId, combinedReply);
    return json({ ok: true, movie_and_catalog: true });
  }

  if (!collectingCustomDetails && isMoviePlanFollowUp(message.text) && !isExplicitBusinessRequest(message.text)) {
    const recentPlan = await env.DB.prepare(`SELECT content FROM chat_messages
      WHERE chat_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 3`)
      .bind(chatId).all<{ content: string }>();
    if (recentPlan.results.some((item) => /\bmovie\b/i.test(item.content))) {
      await sendSavedReply(env, message, chatId, "I haven't picked one yet. What do you think I should see?");
      return json({ ok: true, plan_follow_up: true });
    }
  }

  if (!collectingCustomDetails && isHowAreYouQuestion(message.text)) {
    await sendSavedReply(env, message, chatId, randomHowAreYouReply(chatId));
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isGoodnight(message.text)) {
    await sendSavedReply(env, message, chatId, "Sweet dreams, babe. Talk to you tomorrow.");
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isGreeting(message.text)) {
    const greeting = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23",
    }).format(new Date())) < 12 ? "Good morning, babe. How are you?" : "Hey babe. How are you?";
    await sendSavedReply(env, message, chatId, greeting);
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isThanks(message.text)) {
    await sendSavedReply(env, message, chatId, "Of course, babe.");
    return json({ ok: true });
  }

  const sextingDraft = pendingSextingDraft;
  if (!collectingCustomDetails && sextingDraft && sextingDraft.status !== "awaiting_package" &&
      isSextingPaymentQuestion(message.text) && /\bsext(?:ing)?\b/i.test(message.text)) {
    const paymentReply = "For sexting here, I use Telegram Stars, babe. Tell me if you want 5 or 10 minutes and I'll send the invoice.";
    await env.DB.prepare(`UPDATE sexting_drafts SET status = 'awaiting_package', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    await sendSavedReply(env, message, chatId, paymentReply);
    return json({ ok: true, sexting_payment_answered: true });
  }
  if (!collectingCustomDetails && sextingDraft?.status === "awaiting_package") {
    if (isGenericCancelReply(message.text) || isSextingDecline(message.text)) {
      await env.DB.prepare(`UPDATE sexting_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", SEXTING_CANCELLATION_REPLY);
      await sendTelegramMessage(env, message, SEXTING_CANCELLATION_REPLY);
      return json({ ok: true });
    }
    if (isSextingPaymentQuestion(message.text)) {
      const paymentReply = "For sexting here, I use Telegram Stars, babe. Tell me if you want 5 or 10 minutes and I'll send the invoice.";
      await sendSavedReply(env, message, chatId, paymentReply);
      return json({ ok: true, sexting_payment_answered: true });
    }
    const selected = sextingPackage(message.text, settings) ||
      (isAffirmativeReply(message.text)
        ? { key: "text5", title: `${Math.max(1, Math.min(9, Number(settings.sexting_min_minutes || 5)))} minute sexting session`, minutes: Math.max(1, Math.min(9, Number(settings.sexting_min_minutes || 5))), stars: Number(settings.sexting_5_stars || 500) }
        : null);
    if (!selected) {
      if (isSextingPackageFollowUp(message.text)) {
        await sendTelegramMessage(env, message, sextingMenu(settings));
        return json({ ok: true });
      }
      // A package choice is only a temporary conversational state. If the fan
      // changes the subject, close it silently so ordinary questions can flow.
      await env.DB.prepare(`UPDATE sexting_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
    } else {
      const checkoutStatus = await createSextingCheckout(env, message, selected);
      await env.DB.prepare(`UPDATE sexting_drafts SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(checkoutStatus, chatId).run();
      return json({ ok: true });
    }
  }

  if (!collectingCustomDetails && isInPersonSexSolicitation(message.text)) {
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", IN_PERSON_SEX_REPLY);
    await sendTelegramMessage(env, message, IN_PERSON_SEX_REPLY);
    return json({ ok: true });
  }

  if (!collectingCustomDetails && isSextingQuestion(message.text)) {
    if (settings.sexting_enabled === "off") {
      await sendTelegramMessage(env, message, "I'm not offering sexting sessions right now, babe.");
      return json({ ok: true });
    }
    const selected = sextingPackage(message.text, settings);
    if (selected) {
      await createSextingCheckout(env, message, selected);
      return json({ ok: true });
    }
    await env.DB.prepare(`INSERT INTO sexting_drafts (chat_id, business_connection_id, status)
      VALUES (?, ?, 'awaiting_package') ON CONFLICT(chat_id) DO UPDATE SET
      business_connection_id = excluded.business_connection_id, status = 'awaiting_package',
      updated_at = CURRENT_TIMESTAMP`).bind(chatId, message.business_connection_id || null).run();
    await sendTelegramMessage(env, message, sextingMenu(settings));
    return json({ ok: true });
  }

  const explicitCustomFlowSwitch = requestedFlow && requestedFlow !== "custom" &&
    /\b(?:instead|actually|rather|change|switch|never mind|nevermind)\b/i.test(message.text);
  if (customDraft?.status === "awaiting_details" && explicitCustomFlowSwitch) {
    await env.DB.prepare(`UPDATE custom_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    customDraft.status = "cancelled";
  }
  const customParts = message.text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const lastCustomReply = customParts[customParts.length - 1] || "";
  const bareCustomYes = /^(?:yes|yeah|yep|sure)[.! ]*$/i.test(lastCustomReply);
  const bareCustomNo = /^(?:no|nope)[.! ]*$/i.test(lastCustomReply);
  const explicitCustomFinish = isCustomDetailsFinished(lastCustomReply) && !bareCustomYes;
  const finishFromCheckIn = customDraft?.completion_mode === "no_done" ? bareCustomNo : bareCustomYes;
  const finishedWithBatch = explicitCustomFinish || finishFromCheckIn;
  const continueFromCheckIn = customDraft?.completion_mode === "no_done" ? bareCustomYes : bareCustomNo;
  const continueCustomDraft = continueFromCheckIn ||
    /^(?:not yet|i(?:'m| am) not done|i have more|let me add more|one more thing)[.! ]*$/i.test(lastCustomReply);
  const cancelCustomDraft = !finishedWithBatch && !continueCustomDraft &&
    (isGenericCancelReply(message.text) || isCustomDecline(message.text));
  if (customDraft?.status === "awaiting_details") {
    if (cancelCustomDraft) {
      await env.DB.prepare(`UPDATE custom_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", CUSTOM_CANCELLATION_REPLY);
      await sendTelegramMessage(env, message, CUSTOM_CANCELLATION_REPLY);
      return json({ ok: true });
    }
    if (continueCustomDraft) {
      const continueReply = "Okay babe, keep going. Send me everything you want, then tell me when that's everything.";
      await sendSavedReply(env, message, chatId, continueReply);
      return json({ ok: true });
    }
    if (isManualPaymentQuestion(message.text)) {
      const paymentReply = "I need to know what you want and for how long before I can quote it, babe. Send me your idea and I'll check it first.";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", paymentReply);
      await sendTelegramMessage(env, message, paymentReply);
      return json({ ok: true });
    }
    if (isPriceQuestion(message.text)) {
      const customPriceReply = "I can't quote you until I know what you want and for how long. Can you send me your idea?";
      await sendSavedReply(env, message, chatId, customPriceReply);
      return json({ ok: true });
    }
    const newCustomDetails = finishedWithBatch ? customParts.slice(0, -1).join("\n") : message.text.trim();
    const combinedCustomDetails = [customDraft.details.trim(), newCustomDetails]
      .filter(Boolean).join("\n").slice(0, 100000);
    if (finishedWithBatch) {
      const missingCustomDetails = customDetailsMissing(combinedCustomDetails);
      if (missingCustomDetails.description || missingCustomDetails.duration) {
        const customFollowUp = missingCustomDetails.description && missingCustomDetails.duration
          ? "I still need your custom idea and how many minutes you want, babe. Send the details, then say done when you're finished."
          : missingCustomDetails.description
            ? "I still need to know what you want me to do. Send the details, then say done when you're finished."
            : "How many minutes do you want the custom to be? Send the length, then say done when you're finished.";
        await sendSavedReply(env, message, chatId, customFollowUp);
        return json({ ok: true });
      }
      await env.DB.prepare(`UPDATE custom_drafts SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?`).bind(chatId).run();
      await env.DB.prepare(`INSERT INTO booking_requests (chat_id, business_connection_id, details)
        VALUES (?, ?, ?)`).bind(chatId, message.business_connection_id || null, `Custom content request:\n${combinedCustomDetails}`).run();
      const received = "Got it, babe. I'll look over everything and send you a quote.";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", received);
      await sendTelegramMessage(env, message, received);
      return json({ ok: true });
    }
    const acknowledgement = customDetailsCheckIn(combinedCustomDetails);
    await env.DB.prepare(`UPDATE custom_drafts
      SET details = ?, completion_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`)
      .bind(combinedCustomDetails, acknowledgement.completionMode, chatId).run();
    await saveMessage(env.DB, chatId, "user", message.text);
    await saveMessage(env.DB, chatId, "assistant", acknowledgement.text);
    await sendTelegramMessage(env, message, acknowledgement.text);
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
    const initialCustomMissing = customDetailsMissing(message.text);
    const initialCustomDetails = !isAnotherCustomIdea(message.text) &&
      (!initialCustomMissing.description || !initialCustomMissing.duration)
      ? message.text.trim()
      : "";
    await env.DB.prepare(`INSERT INTO custom_drafts (chat_id, business_connection_id, status, details, completion_mode)
      VALUES (?, ?, 'awaiting_details', ?, 'yes_done') ON CONFLICT(chat_id) DO UPDATE SET
      business_connection_id = excluded.business_connection_id, status = 'awaiting_details', details = excluded.details,
      completion_mode = 'yes_done', updated_at = CURRENT_TIMESTAMP`)
      .bind(chatId, message.business_connection_id || null, initialCustomDetails).run();
    await saveMessage(env.DB, chatId, "user", message.text);
    const prompt = customVideoPrompt(settings);
    await saveMessage(env.DB, chatId, "assistant", prompt);
    await sendTelegramMessage(env, message, prompt);
    return json({ ok: true });
  }

  const bookingDraft = await env.DB.prepare(`SELECT status FROM booking_drafts
    WHERE chat_id = ?`).bind(chatId).first<{ status: string }>();
  if (bookingDraft?.status === "awaiting_details" && requestedFlow && requestedFlow !== "booking") {
    await env.DB.prepare(`UPDATE booking_drafts SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?`).bind(chatId).run();
    bookingDraft.status = "cancelled";
  }
  const priorBookingMessagesForRouting = bookingDraft?.status === "awaiting_details"
    ? await env.DB.prepare(`SELECT content FROM chat_messages WHERE chat_id = ? AND role = 'user'
        ORDER BY id DESC LIMIT 5`).bind(chatId).all<{ content: string }>()
    : { results: [] as Array<{ content: string }> };
  const priorBookingTextForRouting = [...priorBookingMessagesForRouting.results]
    .reverse().map((item) => item.content).join(" ");
  const expectingBookingCity = bookingDraft?.status === "awaiting_details" &&
    bookingDetailsMissing(priorBookingTextForRouting).includes("city");
  const cancelBookingDraft = isGenericCancelReply(message.text) || isBookingDecline(message.text);
  const shouldHandleBookingDraft = bookingDraft?.status === "awaiting_details" &&
    (cancelBookingDraft || (!isCancelReply(message.text) && (isManualPaymentQuestion(message.text) ||
      isLikelyBookingDetailReply(message.text, expectingBookingCity))));
  if (bookingDraft?.status === "awaiting_details" && shouldHandleBookingDraft) {
    if (cancelBookingDraft) {
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
    const priorBookingDetails = priorBookingTextForRouting;
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
    if (lastAssistantMessage &&
        (askedToShowTrailer(lastAssistantMessage.content) ||
          isTrailerOfferAwaitingConfirmation(lastAssistantMessage.content))) {
      const trailerContext = await getTrailerFollowUpProduct(env.DB, chatId);
      if (trailerContext.ambiguous) {
        const clarification = "Which video did you want the trailer for, babe?";
        await sendSavedReply(env, message, chatId, clarification);
        return json({ ok: true, trailer_needs_title: true });
      }
      const product = trailerContext.product;
      if (product) {
        await rememberProductInterest(env.DB, chatId, connectionId, product.id);
        const trailerReply = product.trailer_url
          ? `Here you go, babe. This is the trailer for ${product.title}:\n${product.trailer_url}\n\nDo you want to buy the full video for ${productPrice(product)}?`
          : `I don't have a trailer added for ${product.title} right now, babe. Do you still want the full video for ${productPrice(product)}?`;
        await sendSavedReply(env, message, chatId, trailerReply);
        return json({ ok: true, trailer_follow_up: true });
      }
    }
    if (lastAssistantMessage && askedToBuyProduct(lastAssistantMessage.content)) {
      const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
      if (product) {
        await rememberProductInterest(env.DB, chatId, connectionId, product.id);
        if (product.content_type === "video_rating") {
          await saveMessage(env.DB, chatId, "user", message.text);
          await sendVideoRatingCheckout(env, env.DB, message, product);
          return json({ ok: true });
        }
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

  if (isDirectTrailerRequest(message.text)) {
    const trailerContext = await getTrailerFollowUpProduct(env.DB, chatId);
    if (trailerContext.ambiguous) {
      const clarification = "Which video did you want the trailer for, babe?";
      await sendSavedReply(env, message, chatId, clarification);
      return json({ ok: true, trailer_needs_title: true });
    }
    const product = trailerContext.product;
    if (product) {
      await rememberProductInterest(env.DB, chatId, connectionId, product.id);
      const trailerReply = product.trailer_url
        ? `Here you go, babe. This is the trailer for ${product.title}:\n${product.trailer_url}\n\nDo you want the full video for ${productPrice(product)}?`
        : `I don't have a trailer added for ${product.title} right now, babe. Do you still want to buy it for ${productPrice(product)}?`;
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", trailerReply);
      await sendTelegramMessage(env, message, trailerReply);
      return json({ ok: true });
    }
  }

  const activeProducts = await getActiveProducts(env.DB);
  const normalizedMessage = message.text.toLowerCase();
  const mentionedProduct = activeProducts.find((product) =>
    product.title.length >= 3 && normalizedMessage.includes(product.title.toLowerCase()));
  if (isProductQuestion(message.text) || mentionedProduct) {
    const requestedType = isVideoRatingQuestion(message.text) ? "video_rating"
      : isPhysicalItemQuestion(message.text) ? "physical_item" : null;
    const product = mentionedProduct || (requestedType
      ? activeProducts.find((item) => item.content_type === requestedType)
      : activeProducts.find((item) => !["physical_item", "video_rating"].includes(item.content_type)) ||
        activeProducts[0] || await getNewestProduct(env.DB));
    if (!product) {
      const unavailable = requestedType === "physical_item"
        ? "I don't have any clothing or worn items listed right now, babe. Check back soon."
        : "I'm adding new content soon, babe. What kind of content do you want to see?";
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
    const quotedCustom = await env.DB.prepare(`SELECT id FROM custom_fulfillments
      WHERE chat_id = ? AND status = 'awaiting_payment' ORDER BY id DESC LIMIT 1`)
      .bind(chatId).first<{ id: number }>();
    if (quotedCustom) {
      await env.DB.prepare(`UPDATE custom_fulfillments SET status = 'payment_review' WHERE id = ?`)
        .bind(quotedCustom.id).run();
      const confirmation = "Ok, thanks babe. Let me check when I get the chance and I'll let you know when I can start it!";
      await saveMessage(env.DB, chatId, "user", message.text);
      await saveMessage(env.DB, chatId, "assistant", confirmation);
      await sendTelegramMessage(env, message, confirmation);
      return json({ ok: true, custom_payment_review: true });
    }
    const product = await getInterestedProduct(env.DB, chatId) || await getNewestProduct(env.DB);
    if (!product) {
      await sendTelegramMessage(env, message, "Tell me which content you paid for so I can check it, babe.");
      return json({ ok: true });
    }
    if (product.content_type === "video_rating") {
      await saveMessage(env.DB, chatId, "user", message.text);
      await sendVideoRatingCheckout(env, env.DB, message, product);
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
    const confirmation = product.content_type === "physical_item"
      ? "Ok, thanks babe. Let me verify it, then I'll get your shipping information."
      : product.content_type === "video_rating"
        ? "Ok, thanks babe. Let me verify it, then you can send the photo you want me to rate."
        : "Ok, thanks babe. Let me check when I get the chance and I'll send you the link!";
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
    if (product.content_type === "video_rating") {
      await saveMessage(env.DB, chatId, "user", message.text);
      await sendVideoRatingCheckout(env, env.DB, message, product);
      return json({ ok: true });
    }
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
      env.DB.prepare(`INSERT INTO custom_drafts (chat_id, business_connection_id, status, details, completion_mode)
        VALUES (?, ?, 'awaiting_details', '', 'yes_done') ON CONFLICT(chat_id) DO UPDATE SET
        business_connection_id = excluded.business_connection_id, status = 'awaiting_details',
        details = '', completion_mode = 'yes_done', updated_at = CURRENT_TIMESTAMP`).bind(item.chat_id, item.business_connection_id),
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
  const purchases = await env.DB.prepare(`SELECT purchase_requests.id, purchase_requests.product_title,
    purchase_requests.price, purchase_requests.payment_note, purchase_requests.created_at,
    content_products.content_type FROM purchase_requests
    LEFT JOIN content_products ON content_products.title = purchase_requests.product_title
    WHERE purchase_requests.status = 'pending' ORDER BY purchase_requests.id ASC LIMIT 100`).all();
  const purchaseHistory = await env.DB.prepare(`SELECT id, product_title, price, payment_note,
    status, created_at, resolved_at FROM purchase_requests WHERE status != 'disputed_removed'
    ORDER BY id DESC LIMIT 200`).all();
  const bookings = await env.DB.prepare(`SELECT booking_requests.id, booking_requests.details,
    booking_requests.created_at,
    COALESCE(telegram_contacts.username, telegram_contacts.display_name, fan_profiles.name, 'Telegram fan') AS telegram_name,
    CASE WHEN details LIKE 'Custom content request:%' THEN 'custom_content' ELSE 'video_chat' END AS suggested_type
    FROM booking_requests
    LEFT JOIN telegram_contacts ON telegram_contacts.chat_id = booking_requests.chat_id
    LEFT JOIN fan_profiles ON fan_profiles.chat_id = booking_requests.chat_id
    WHERE booking_requests.status = 'pending' ORDER BY booking_requests.id ASC LIMIT 100`).all();
  const customs = await env.DB.prepare(`SELECT id, telegram_name, duration_minutes, description,
    amount_cents, completion_comment, status, created_at FROM custom_fulfillments
    WHERE status IN ('awaiting_payment', 'payment_review', 'awaiting_fulfillment')
    ORDER BY id ASC LIMIT 100`).all();
  const customHistory = await env.DB.prepare(`SELECT id, telegram_name, duration_minutes, description,
    amount_cents, delivery_url, completion_comment, status, created_at, completed_at FROM custom_fulfillments
    WHERE status IN ('completed', 'cancelled', 'closed_unpaid')
    ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 100`).all();
  const sextingSessions = await env.DB.prepare(`SELECT id, telegram_name, package_title,
    duration_minutes, stars, status, control_mode, taken_over_at, created_at, started_at, ends_at
    FROM sexting_sessions WHERE status IN ('paid', 'active') ORDER BY id ASC LIMIT 100`).all();
  const sextingHistory = await env.DB.prepare(`SELECT id, telegram_name, package_title,
    duration_minutes, stars, completed_at FROM sexting_sessions WHERE status = 'completed'
    ORDER BY completed_at DESC LIMIT 100`).all();
  const starsSummary = await env.DB.prepare(`SELECT COALESCE(SUM(stars), 0) AS total_stars,
    COUNT(*) AS transaction_count FROM (
      SELECT stars FROM sexting_sessions WHERE stars > 0 AND status != 'disputed_removed'
      UNION ALL
      SELECT stars FROM rating_orders WHERE stars > 0
    )`).first<{ total_stars: number; transaction_count: number }>();
  const sextingMedia = await env.DB.prepare(`SELECT id, label, media_type, file_name,
    mime_type, active, created_at FROM sexting_media ORDER BY id DESC LIMIT 100`).all();
  const contentProducts = await env.DB.prepare(`SELECT content_products.id, content_type, title, price_cents, stars_price,
    genre, actors, trailer_url, delivery_url, active, content_products.created_at,
    (SELECT COUNT(*) FROM content_product_media WHERE product_id = content_products.id) AS media_count
    FROM content_products ORDER BY content_products.id DESC LIMIT 200`).all();
  const sextingScripts = await env.DB.prepare(`SELECT id, stage, title, script_text,
    media_label, active, created_at FROM sexting_scripts ORDER BY id ASC LIMIT 200`).all();
  const dailyTasks = await env.DB.prepare(`SELECT id, title, task_type, scheduled_at,
    fan_name, details, amount_cents, status, created_at, completed_at
    FROM daily_tasks ORDER BY datetime(scheduled_at) ASC, id ASC LIMIT 500`).all();
  const physicalOrders = await env.DB.prepare(`SELECT id, product_title, customer_name,
    shipping_address, tracking_number, amount_cents, status, created_at
    FROM physical_orders WHERE status IN ('awaiting_name', 'awaiting_address', 'awaiting_shipment')
    ORDER BY id ASC LIMIT 100`).all();
  const physicalOrderHistory = await env.DB.prepare(`SELECT id, product_title, customer_name,
    tracking_number, amount_cents, status, created_at, shipped_at
    FROM physical_orders WHERE status = 'shipped' ORDER BY shipped_at DESC LIMIT 100`).all();
  const ratingOrders = await env.DB.prepare(`SELECT id, telegram_name, amount_cents, stars, status, created_at
    FROM rating_orders WHERE status IN ('awaiting_photo', 'awaiting_response')
    ORDER BY id ASC LIMIT 100`).all();
  const ratingOrderHistory = await env.DB.prepare(`SELECT id, telegram_name, amount_cents, stars, status,
    created_at, completed_at FROM rating_orders WHERE status = 'completed'
    ORDER BY completed_at DESC LIMIT 100`).all();
  const announcements = await env.DB.prepare(`SELECT id, platform, message, stream_url, status,
    recipient_count, delivered_count, failed_count, created_at, sent_at
    FROM announcements ORDER BY id DESC LIMIT 100`).all();
  const socialLinks = await env.DB.prepare(`SELECT id, platform, label, url, created_at
    FROM creator_social_links ORDER BY id ASC`).all();
  const trainingSuggestions = await env.DB.prepare(`SELECT id, category, suggestion, created_at
    FROM conversation_training ORDER BY category ASC, id ASC`).all();
  const saleDisputes = await env.DB.prepare(`SELECT id, creator_key, earnings_event_id, source_type,
    source_id, description, amount_cents, stars, occurred_at, requester_email, reason, proof, status,
    reviewed_by, created_at, reviewed_at FROM sale_disputes
    WHERE ? = 'owner' OR creator_key = ? ORDER BY id DESC LIMIT 500`)
    .bind(portalUser.role, portalUser.creator_key).all();
  const learned = await env.DB.prepare("SELECT COUNT(*) AS count FROM learned_answers").first<{ count: number }>();
  const weekly = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events
    WHERE occurred_at >= datetime('now', '-7 days')`).first<{ total_cents: number; transaction_count: number }>();
  const allTime = await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
    COUNT(*) AS transaction_count FROM earnings_events`).first<{ total_cents: number; transaction_count: number }>();
  const earningsHistory = await env.DB.prepare(`SELECT id, source_type, description, amount_cents, occurred_at
    FROM earnings_events ORDER BY id DESC LIMIT 1000`).all();
  const dailyRows = await env.DB.prepare(`SELECT id, source_type, description, amount_cents, occurred_at FROM earnings_events
    WHERE occurred_at >= datetime('now', '-13 days', 'start of day') ORDER BY occurred_at ASC`)
    .all<{ id: number; source_type: string; description: string; amount_cents: number; occurred_at: string }>();
  const dailyMap = new Map<string, { amount_cents: number; transaction_count: number; items: typeof dailyRows.results }>();
  for (const row of dailyRows.results) {
    const timestamp = row.occurred_at.includes("T") ? row.occurred_at : `${row.occurred_at.replace(" ", "T")}Z`;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(timestamp));
    const current = dailyMap.get(date) || { amount_cents: 0, transaction_count: 0, items: [] };
    current.amount_cents += row.amount_cents;
    current.transaction_count += 1;
    current.items.push(row);
    dailyMap.set(date, current);
  }
  const dailyStarRows = await env.DB.prepare(`SELECT id, package_title, stars, created_at FROM (
      SELECT id, package_title, stars, created_at FROM sexting_sessions
      WHERE stars > 0 AND status != 'disputed_removed'
      UNION ALL
      SELECT -id AS id, 'Video rating' AS package_title, stars, created_at FROM rating_orders WHERE stars > 0
    ) WHERE created_at >= datetime('now', '-13 days', 'start of day') ORDER BY created_at ASC`)
    .all<{ id: number; package_title: string; stars: number; created_at: string }>();
  const dailyStarsMap = new Map<string, { stars: number; star_transaction_count: number; star_items: typeof dailyStarRows.results }>();
  for (const row of dailyStarRows.results) {
    const timestamp = row.created_at.includes("T") ? row.created_at : `${row.created_at.replace(" ", "T")}Z`;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(timestamp));
    const current = dailyStarsMap.get(date) || { stars: 0, star_transaction_count: 0, star_items: [] };
    current.stars += row.stars;
    current.star_transaction_count += 1;
    current.star_items.push(row);
    dailyStarsMap.set(date, current);
  }
  const dailyEarnings = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - offset));
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
    return {
      date: key,
      ...(dailyMap.get(key) || { amount_cents: 0, transaction_count: 0, items: [] }),
      ...(dailyStarsMap.get(key) || { stars: 0, star_transaction_count: 0, star_items: [] }),
    };
  });
  const creatorAccounts = await env.DB.prepare(`SELECT creator_key, display_name, login_email,
    status, template_key, telegram_connected FROM creator_accounts ORDER BY created_at ASC`)
    .all<{ creator_key: string; display_name: string; login_email: string; status: string; template_key: string | null; telegram_connected: number }>();
  const creatorEmail = Array.from(emailList(env.PORTAL_CREATOR_EMAILS))[0] || "";
  if (creatorEmail) {
    await env.DB.prepare(`UPDATE creator_accounts SET login_email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE creator_key = 'tiffani' AND login_email = ''`).bind(creatorEmail).run();
  }
  const emptyDailyEarnings = dailyEarnings.map((day) => ({ ...day, amount_cents: 0, transaction_count: 0,
    items: [], stars: 0, star_transaction_count: 0, star_items: [] }));
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
    physical_orders: physicalOrders.results,
    physical_order_history: physicalOrderHistory.results,
    rating_orders: ratingOrders.results,
    rating_order_history: ratingOrderHistory.results,
    announcements: announcements.results,
    social_links: socialLinks.results,
    training_suggestions: trainingSuggestions.results,
    sale_disputes: saleDisputes.results,
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
      creator_count: creatorAccounts.results.length,
      active_creator_count: creatorAccounts.results.filter((creator) => creator.status === "live").length,
      attention_count: pending.results.length + purchases.results.length + bookings.results.length +
        customs.results.length + sextingSessions.results.length + physicalOrders.results.length + ratingOrders.results.length +
        saleDisputes.results.filter((dispute) => dispute.status === "pending").length,
      creators: creatorAccounts.results.map((creator) => ({
        key: creator.creator_key,
        name: creator.display_name,
        email: creator.creator_key === "tiffani" ? creatorEmail : creator.login_email,
        status: creator.status,
        template_name: creator.template_key === "tiffani" ? "Tiffani template" : "",
        telegram_connected: Boolean(creator.telegram_connected),
        weekly_cents: creator.creator_key === "tiffani" ? weekly?.total_cents || 0 : 0,
        all_time_cents: creator.creator_key === "tiffani" ? allTime?.total_cents || 0 : 0,
        all_time_stars: creator.creator_key === "tiffani" ? starsSummary?.total_stars || 0 : 0,
        daily_earnings: creator.creator_key === "tiffani" ? dailyEarnings : emptyDailyEarnings,
      })),
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
  const mediaMatch = url.pathname.match(/^\/api\/admin\/products\/(\d+)\/media(?:\/(\d+))?(?:\/file)?$/);
  const match = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
  if (mediaMatch) {
    const productId = Number(mediaMatch[1]);
    const mediaId = mediaMatch[2] ? Number(mediaMatch[2]) : null;
    const product = await env.DB.prepare("SELECT id FROM content_products WHERE id = ?").bind(productId).first();
    if (!product) return json({ error: "Content was not found" }, 404);
    if (request.method === "POST" && !mediaId) {
      const form = await request.formData();
      const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      if (!files.length) return json({ error: "Choose at least one photo or video" }, 400);
      if (files.length > 50) return json({ error: "Upload no more than 50 files at once" }, 400);
      if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
        return json({ error: "Only image and video files are supported" }, 400);
      }
      for (const file of files) {
        const mediaType = file.type.startsWith("video/") ? "video" : "image";
        const safeName = file.name.replace(/[^a-zA-Z0-9._]/g, "_").slice(-120);
        const r2Key = `catalog/${productId}/${crypto.randomUUID()}-${safeName}`;
        await env.MEDIA.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });
        await env.DB.prepare(`INSERT INTO content_product_media
          (product_id, media_type, file_name, mime_type, r2_key) VALUES (?, ?, ?, ?, ?)`)
          .bind(productId, mediaType, file.name.slice(0, 255), file.type, r2Key).run();
      }
      return json({ ok: true, uploaded: files.length });
    }
    if (request.method === "GET" && mediaId && url.pathname.endsWith("/file")) {
      const media = await env.DB.prepare(`SELECT r2_key, mime_type FROM content_product_media
        WHERE id = ? AND product_id = ?`).bind(mediaId, productId).first<{ r2_key: string; mime_type: string }>();
      if (!media) return json({ error: "Product file not found" }, 404);
      const object = await env.MEDIA.get(media.r2_key);
      if (!object) return json({ error: "Stored file not found" }, 404);
      return new Response(object.body, { headers: { "content-type": media.mime_type, "cache-control": "private, max-age=3600" } });
    }
    if (request.method === "DELETE" && mediaId) {
      const media = await env.DB.prepare(`SELECT r2_key FROM content_product_media
        WHERE id = ? AND product_id = ?`).bind(mediaId, productId).first<{ r2_key: string }>();
      if (!media) return json({ error: "Product file not found" }, 404);
      await env.MEDIA.delete(media.r2_key);
      await env.DB.prepare("DELETE FROM content_product_media WHERE id = ?").bind(mediaId).run();
      return json({ ok: true });
    }
    return json({ error: "Product media request not found" }, 404);
  }
  if (request.method === "POST" && url.pathname === "/api/admin/products") {
    const body = await request.json() as Partial<ContentProduct> & { price?: string; stars_price?: number | string };
    const title = String(body.title || "").trim();
    const contentType = String(body.content_type || "").trim();
    const priceCents = Math.round(Number(body.price || 0) * 100);
    const starsPrice = contentType === "video_rating" ? Math.round(Number(body.stars_price || 0)) : 0;
    const trailerUrl = String(body.trailer_url || "").trim();
    const deliveryUrl = String(body.delivery_url || "").trim();
    const allowedTypes = ["photo", "photo_package", "video", "video_bundle", "physical_item", "video_rating"];
    if (!title || !allowedTypes.includes(contentType) ||
      !Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000 ||
      (contentType === "video_rating" && (!Number.isFinite(starsPrice) || starsPrice < 1 || starsPrice > 1000000)) ||
      !validHttpUrl(trailerUrl) || !validHttpUrl(deliveryUrl)) {
      return json({ error: "Complete the title, type, price, and use valid links" }, 400);
    }
    try {
      const result = await env.DB.prepare(`INSERT INTO content_products
        (content_type, title, price_cents, stars_price, genre, actors, trailer_url, delivery_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(contentType, title.slice(0, 180), priceCents, starsPrice,
          String(body.genre || "").trim().slice(0, 180),
          String(body.actors || "").trim().slice(0, 300), trailerUrl, deliveryUrl).run();
      return json({ ok: true, id: result.meta.last_row_id });
    } catch {
      return json({ error: "A product with that title already exists" }, 409);
    }
  }
  if (match && request.method === "PATCH") {
    const body = await request.json() as Partial<ContentProduct> & { price?: string; stars_price?: number | string; active?: boolean };
    const productId = Number(match[1]);
    if (typeof body.active === "boolean" && body.title === undefined) {
      await env.DB.prepare(`UPDATE content_products SET active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(body.active ? 1 : 0, productId).run();
      return json({ ok: true });
    }
    const existing = await env.DB.prepare("SELECT title FROM content_products WHERE id = ?")
      .bind(productId).first<{ title: string }>();
    if (!existing) return json({ error: "Content was not found" }, 404);
    const title = String(body.title || "").trim();
    const contentType = String(body.content_type || "").trim();
    const priceCents = Math.round(Number(body.price || 0) * 100);
    const starsPrice = contentType === "video_rating" ? Math.round(Number(body.stars_price || 0)) : 0;
    const trailerUrl = String(body.trailer_url || "").trim();
    const deliveryUrl = String(body.delivery_url || "").trim();
    const allowedTypes = ["photo", "photo_package", "video", "video_bundle", "physical_item", "video_rating"];
    if (!title || !allowedTypes.includes(contentType) ||
      !Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000 ||
      (contentType === "video_rating" && (!Number.isFinite(starsPrice) || starsPrice < 1 || starsPrice > 1000000)) ||
      !validHttpUrl(trailerUrl) || !validHttpUrl(deliveryUrl)) {
      return json({ error: "Complete the title, type, price, and use valid links" }, 400);
    }
    try {
      await env.DB.batch([
        env.DB.prepare(`UPDATE content_products SET content_type = ?, title = ?, price_cents = ?, stars_price = ?, genre = ?,
          actors = ?, trailer_url = ?, delivery_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(contentType, title.slice(0, 180), priceCents, starsPrice,
            String(body.genre || "").trim().slice(0, 180), String(body.actors || "").trim().slice(0, 300),
            trailerUrl, deliveryUrl, productId),
        env.DB.prepare(`UPDATE purchase_requests SET product_title = ?, price = ?
          WHERE product_title = ? AND status = 'pending'`)
          .bind(title.slice(0, 180), `$${(priceCents / 100).toFixed(2)}`, existing.title),
      ]);
    } catch {
      return json({ error: "A product with that title already exists" }, 409);
    }
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
      const media = await env.DB.prepare(`SELECT r2_key FROM content_product_media WHERE product_id = ?`)
        .bind(Number(match[1])).all<{ r2_key: string }>();
      for (const item of media.results) await env.MEDIA.delete(item.r2_key);
      await env.DB.prepare("DELETE FROM content_product_media WHERE product_id = ?").bind(Number(match[1])).run();
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
  const body = await request.json() as { id?: number; action?: "approve" | "decline" | "close_unpaid" };
  if (!body.id || !body.action) return json({ error: "Purchase action is required" }, 400);
  if (!["approve", "decline", "close_unpaid"].includes(body.action)) {
    return json({ error: "That purchase action is not supported" }, 400);
  }
  const purchase = await env.DB.prepare(`SELECT purchase_requests.id, purchase_requests.chat_id,
    purchase_requests.business_connection_id, purchase_requests.product_title,
    purchase_requests.price, content_products.id AS product_id, content_products.delivery_url, content_products.price_cents,
    content_products.content_type
    FROM purchase_requests LEFT JOIN content_products
      ON content_products.title = purchase_requests.product_title
    WHERE purchase_requests.id = ? AND purchase_requests.status = 'pending'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      product_title: string;
      price: string;
      product_id: number | null;
      delivery_url: string | null;
      price_cents: number | null;
      content_type: string | null;
    }>();
  if (!purchase) return json({ error: "Purchase is no longer pending" }, 404);

  const approved = body.action === "approve";
  const fulfillmentType = purchase.content_type || "video";
  if (approved && fulfillmentType === "video_rating") {
    return json({ error: "Video ratings must be purchased through a Telegram Stars invoice in chat" }, 409);
  }
  const needsDeliveryLink = !["physical_item", "video_rating"].includes(fulfillmentType);
  const uploadedMedia = approved && needsDeliveryLink && purchase.product_id
    ? await env.DB.prepare(`SELECT id, product_id, media_type, file_name, mime_type, r2_key
        FROM content_product_media WHERE product_id = ? ORDER BY id ASC`)
      .bind(purchase.product_id).all<ProductMedia>()
    : { results: [] as ProductMedia[] };
  if (approved && needsDeliveryLink && !purchase.delivery_url && !uploadedMedia.results.length) {
    return json({ error: "This product needs a Dropbox link or uploaded files" }, 409);
  }
  const responseText = body.action === "close_unpaid"
    ? `Hey babe, do you still want ${purchase.product_title}? I know you'll love it, but I still need you to send the payment so I can send it over. Lmk if you still want it.`
    : approved
    ? fulfillmentType === "physical_item"
      ? `Payment approved, babe. What's the full name you want me to use for shipping?`
      : purchase.delivery_url
        ? `Payment approved. Here is ${purchase.product_title}:\n${purchase.delivery_url}`
        : `Payment approved. I'm sending ${purchase.product_title} here now.`
    : "I could not verify that payment yet. Please check the payment details and send me the method and sender name you used.";
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(purchase.chat_id) },
    business_connection_id: purchase.business_connection_id || undefined,
  }, responseText);
  await saveMessage(env.DB, purchase.chat_id, "assistant", responseText);
  if (approved && needsDeliveryLink && !purchase.delivery_url) {
    for (const media of uploadedMedia.results) {
      await sendTelegramProductMedia(env, {
        message_id: 0,
        chat: { id: Number(purchase.chat_id) },
        business_connection_id: purchase.business_connection_id || undefined,
      }, media);
    }
  }
  if (approved && needsDeliveryLink) {
    const followUp = "I hope you enjoy it! Lmk what you think";
    await sendTelegramMessage(env, {
      message_id: 0,
      chat: { id: Number(purchase.chat_id) },
      business_connection_id: purchase.business_connection_id || undefined,
    }, followUp);
    await saveMessage(env.DB, purchase.chat_id, "assistant", followUp);
  }
  await env.DB.prepare(`UPDATE purchase_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?`).bind(approved ? "approved" : body.action === "close_unpaid" ? "closed_unpaid" : "declined", purchase.id).run();
  if (approved) {
    const amountCents = purchase.price_cents || Math.round(Number(purchase.price.replace(/[^0-9.]/g, "")) * 100);
    if (fulfillmentType === "physical_item") {
      await env.DB.prepare(`INSERT OR IGNORE INTO physical_orders
        (purchase_request_id, chat_id, business_connection_id, product_title, amount_cents)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(purchase.id, purchase.chat_id, purchase.business_connection_id, purchase.product_title, amountCents).run();
    }
    await env.DB.prepare(`INSERT OR IGNORE INTO earnings_events
      (source_type, source_id, description, amount_cents) VALUES ('content', ?, ?, ?)`)
      .bind(String(purchase.id), purchase.product_title, amountCents)
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
    action?: "approve" | "decline" | "ignore" | "close_unpaid";
    answer?: string;
    service_type?: "video_chat" | "custom_content" | "in_person";
    duration?: string;
    amount?: string;
  };
  if (!body.id || !body.action) return json({ error: "Booking action is required" }, 400);
  if (!["approve", "decline", "ignore", "close_unpaid"].includes(body.action)) {
    return json({ error: "That booking action is not supported" }, 400);
  }
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
  if (body.action === "close_unpaid") {
    const customRequest = /^Custom content request:/i.test(booking.details);
    const reminder = customRequest
      ? "Hey babe, do you still want this custom? I know you'll love it, but I still need you to send the payment so I can get it done. Lmk if you still want it."
      : "Hey babe, do you still want to set this up? I know you'll love it, but I still need you to send the payment so I can confirm it. Lmk if you still want it.";
    await sendTelegramMessage(env, {
      message_id: 0,
      chat: { id: Number(booking.chat_id) },
      business_connection_id: booking.business_connection_id || undefined,
    }, reminder);
    await saveMessage(env.DB, booking.chat_id, "assistant", reminder);
    await env.DB.prepare(`UPDATE booking_requests SET status = 'closed_unpaid', resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(booking.id).run();
    return json({ ok: true });
  }
  const answer = body.answer?.trim();
  if (!answer) return json({ error: "Booking reply is required" }, 400);
  const duration = Number(body.duration || 0);
  const quotedAmount = Number(body.amount || 0);
  if (body.action === "approve" && (!body.service_type || !Number.isFinite(duration) || duration <= 0)) {
    return json({ error: "A valid service and duration are required" }, 400);
  }
  if (body.action === "approve" && body.service_type === "video_chat" && duration < 5) {
    return json({ error: "Video chat requires at least 5 minutes" }, 400);
  }
  if (body.action === "approve" && body.service_type === "custom_content" &&
      (!Number.isFinite(quotedAmount) || quotedAmount <= 0 || quotedAmount > 100000)) {
    return json({ error: "Enter the total custom quote" }, 400);
  }
  const rate = body.service_type === "in_person"
    ? Number(settings.in_person_rate || 1500)
    : Number(settings.video_chat_rate || 50);
  const amountCents = body.service_type === "custom_content"
    ? Math.round(quotedAmount * 100)
    : Math.round(duration * rate * 100);
  const fanAnswer = body.action === "approve" && body.service_type === "video_chat" && !/\btelegram\b/i.test(answer)
    ? `${answer}\n\nWe'll do the video chat right here on Telegram.`
    : body.action === "approve" && body.service_type === "custom_content"
      ? manualPaymentMethods(`${answer}\n\nThe total for your custom will be ${dollars(String(amountCents / 100), 0)}.`)
    : answer;
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(booking.chat_id) },
    business_connection_id: booking.business_connection_id || undefined,
  }, fanAnswer);
  await saveMessage(env.DB, booking.chat_id, "assistant", fanAnswer);
  await env.DB.prepare(`UPDATE booking_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?`).bind(body.action === "approve" ? "approved" : "declined", booking.id).run();
  if (body.action === "approve" && body.service_type === "video_chat") {
    await env.DB.prepare(`INSERT OR IGNORE INTO earnings_events
      (source_type, source_id, description, amount_cents) VALUES (?, ?, ?, ?)`)
      .bind(body.service_type, String(booking.id), "Video chat session", amountCents)
      .run();
  }
  if (body.action === "approve" && body.service_type === "custom_content") {
    await env.DB.prepare(`INSERT OR IGNORE INTO custom_fulfillments
      (booking_request_id, chat_id, business_connection_id, telegram_name, duration_minutes,
      description, amount_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'awaiting_payment')`)
      .bind(booking.id, booking.chat_id, booking.business_connection_id, booking.telegram_name,
        Math.round(duration), booking.details.replace(/^Custom content request:\s*/i, ""), amountCents)
      .run();
  }
  return json({ ok: true });
}

async function handleAdminCustom(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as {
    id?: number;
    delivery_url?: string;
    comment?: string;
    action?: "complete" | "cancel" | "close_unpaid" | "approve_payment" | "payment_not_verified";
  };
  const deliveryUrl = body.delivery_url?.trim();
  const action = body.action || "complete";
  const comment = String(body.comment || "").trim().slice(0, 1000);
  if (!body.id || (action === "complete" && (!deliveryUrl || !/^https?:\/\//i.test(deliveryUrl)))) {
    return json({ error: "A valid delivery link is required" }, 400);
  }
  const custom = await env.DB.prepare(`SELECT id, booking_request_id, chat_id, business_connection_id,
    telegram_name, amount_cents, status FROM custom_fulfillments
    WHERE id = ? AND status IN ('awaiting_payment', 'payment_review', 'awaiting_fulfillment')`)
    .bind(body.id)
    .first<{ id: number; booking_request_id: number; chat_id: string; business_connection_id: string | null;
      telegram_name: string; amount_cents: number; status: string }>();
  if (!custom) return json({ error: "Custom request is no longer awaiting fulfillment" }, 404);
  if (action === "complete" && custom.status !== "awaiting_fulfillment") {
    return json({ error: "Confirm payment before completing this custom" }, 409);
  }

  const telegramMessage: TelegramMessage = {
    message_id: 0,
    chat: { id: Number(custom.chat_id) },
    business_connection_id: custom.business_connection_id || undefined,
  };
  if (action === "approve_payment") {
    if (custom.status !== "payment_review") return json({ error: "No custom payment is awaiting review" }, 409);
    const confirmation = "Your payment is confirmed, babe. I'll get started on your custom and send it here when it's ready!";
    await sendTelegramMessage(env, telegramMessage, confirmation);
    await saveMessage(env.DB, custom.chat_id, "assistant", confirmation);
    await env.DB.batch([
      env.DB.prepare(`UPDATE custom_fulfillments SET status = 'awaiting_fulfillment' WHERE id = ?`).bind(custom.id),
      env.DB.prepare(`INSERT OR IGNORE INTO earnings_events
        (source_type, source_id, description, amount_cents) VALUES ('custom_content', ?, ?, ?)`)
        .bind(String(custom.booking_request_id), `Custom content for ${custom.telegram_name}`, custom.amount_cents),
    ]);
    return json({ ok: true });
  }
  if (action === "payment_not_verified") {
    if (custom.status !== "payment_review") return json({ error: "No custom payment is awaiting review" }, 409);
    const retry = "I couldn't verify that payment yet, babe. Check the payment details and send me the method and sender name you used.";
    await sendTelegramMessage(env, telegramMessage, retry);
    await saveMessage(env.DB, custom.chat_id, "assistant", retry);
    await env.DB.prepare(`UPDATE custom_fulfillments SET status = 'awaiting_payment' WHERE id = ?`).bind(custom.id).run();
    return json({ ok: true });
  }
  if (action === "cancel") {
    const cancellation = "I'm sorry babe, I can't complete this custom. I'll message you about the next step.";
    await sendTelegramMessage(env, telegramMessage, cancellation);
    await saveMessage(env.DB, custom.chat_id, "assistant", cancellation);
    await env.DB.batch([
      env.DB.prepare(`UPDATE custom_fulfillments SET status = 'cancelled', completion_comment = ?,
        completed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(comment, custom.id),
      env.DB.prepare(`UPDATE booking_requests SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(custom.booking_request_id),
      env.DB.prepare(`DELETE FROM earnings_events WHERE source_type = 'custom_content' AND source_id = ?`).bind(String(custom.booking_request_id)),
    ]);
    return json({ ok: true });
  }
  if (action === "close_unpaid") {
    const reminder = "Hey babe, do you still want this custom? I know you'll love it, but I still need you to send the payment so I can get it done. Lmk if you still want it.";
    await sendTelegramMessage(env, telegramMessage, reminder);
    await saveMessage(env.DB, custom.chat_id, "assistant", reminder);
    await env.DB.batch([
      env.DB.prepare(`UPDATE custom_fulfillments SET status = 'closed_unpaid', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(custom.id),
      env.DB.prepare(`UPDATE booking_requests SET status = 'closed_unpaid', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(custom.booking_request_id),
      env.DB.prepare(`DELETE FROM earnings_events WHERE source_type = 'custom_content' AND source_id = ?`).bind(String(custom.booking_request_id)),
    ]);
    return json({ ok: true });
  }
  const deliveryMessage = `I made this for you! ${deliveryUrl}${comment ? `\n\n${comment}` : ""}`;
  const followUp = "I hope you enjoy it! Lmk what you think";
  await sendTelegramMessage(env, telegramMessage, deliveryMessage);
  await sendTelegramMessage(env, telegramMessage, followUp);
  await saveMessage(env.DB, custom.chat_id, "assistant", deliveryMessage);
  await saveMessage(env.DB, custom.chat_id, "assistant", followUp);
  await env.DB.prepare(`UPDATE custom_fulfillments SET delivery_url = ?, completion_comment = ?, status = 'completed',
    completed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(deliveryUrl!, comment, custom.id).run();
  return json({ ok: true });
}

async function handleAdminPhysicalOrder(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; tracking_number?: string };
  const trackingNumber = String(body.tracking_number || "").trim().slice(0, 180);
  if (!body.id || trackingNumber.length < 3) return json({ error: "A tracking number is required" }, 400);
  const order = await env.DB.prepare(`SELECT id, chat_id, business_connection_id, product_title
    FROM physical_orders WHERE id = ? AND status = 'awaiting_shipment'`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      product_title: string;
    }>();
  if (!order) return json({ error: "That order is not ready to ship" }, 404);
  const shippedMessage = `Your ${order.product_title} has been sent, babe. Your tracking number is ${trackingNumber}.`;
  await sendTelegramMessage(env, {
    message_id: 0,
    chat: { id: Number(order.chat_id) },
    business_connection_id: order.business_connection_id || undefined,
  }, shippedMessage);
  await saveMessage(env.DB, order.chat_id, "assistant", shippedMessage);
  await env.DB.prepare(`UPDATE physical_orders SET tracking_number = ?, status = 'shipped',
    shipped_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(trackingNumber, order.id).run();
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
  if (request.method === "PATCH" && match) {
    const body = await request.json() as { platform?: string; label?: string; url?: string };
    const platform = body.platform?.trim().slice(0, 50) || "";
    const label = body.label?.trim().slice(0, 100) || "";
    const linkUrl = body.url?.trim() || "";
    if (!platform || !label || !validHttpUrl(linkUrl) || !linkUrl.startsWith("https://")) {
      return json({ error: "Platform, label, and a secure link are required" }, 400);
    }
    try {
      const result = await env.DB.prepare(`UPDATE creator_social_links SET platform = ?, label = ?, url = ?
        WHERE id = ?`).bind(platform, label, linkUrl, Number(match[1])).run();
      if (!result.meta.changes) return json({ error: "Social link was not found" }, 404);
    } catch {
      return json({ error: "That social link is already added" }, 409);
    }
    return json({ ok: true });
  }
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
  if (request.method === "PATCH" && match) {
    const body = await request.json() as { category?: string; suggestion?: string };
    const allowedCategories = ["topic", "avoid", "tone", "feedback"];
    const category = body.category?.trim() || "";
    const suggestion = body.suggestion?.trim().slice(0, 1000) || "";
    if (!allowedCategories.includes(category) || !suggestion) {
      return json({ error: "Choose a training category and enter a suggestion" }, 400);
    }
    try {
      const result = await env.DB.prepare(`UPDATE conversation_training SET category = ?, suggestion = ?
        WHERE id = ?`).bind(category, suggestion, Number(match[1])).run();
      if (!result.meta.changes) return json({ error: "Training suggestion was not found" }, 404);
    } catch {
      return json({ error: "That training suggestion is already added" }, 409);
    }
    return json({ ok: true });
  }
  if (request.method === "DELETE" && match) {
    await env.DB.prepare(`DELETE FROM conversation_training WHERE id = ?`).bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Training request not found" }, 404);
}

async function handleAdminSexting(request: Request, env: Env) {
  if (!await isAdminRequest(request, env)) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as { id?: number; action?: "start" | "complete" | "takeover" | "resume" };
  if (!body.id || !body.action) return json({ error: "A session action is required" }, 400);
  if (!["start", "complete", "takeover", "resume"].includes(body.action)) {
    return json({ error: "That session action is not supported" }, 400);
  }
  const session = await env.DB.prepare(`SELECT id, chat_id, business_connection_id,
    duration_minutes, status, control_mode, started_at, ends_at FROM sexting_sessions WHERE id = ?`).bind(body.id).first<{
      id: number;
      chat_id: string;
      business_connection_id: string | null;
      duration_minutes: number;
      status: string;
      control_mode: string;
      started_at: string | null;
      ends_at: string | null;
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
    await env.DB.prepare(`UPDATE sexting_sessions SET status = 'active', control_mode = 'bot',
      taken_over_at = NULL, started_at = CURRENT_TIMESTAMP,
      ends_at = datetime('now', '+' || ? || ' minutes') WHERE id = ?`).bind(session.duration_minutes, session.id).run();
  } else if (body.action === "takeover" || body.action === "resume") {
    if (session.status !== "active") return json({ error: "Session is not active" }, 409);
    await env.DB.prepare(`UPDATE sexting_sessions SET control_mode = ?, taken_over_at = ? WHERE id = ?`)
      .bind(body.action === "takeover" ? "human" : "bot",
        body.action === "takeover" ? new Date().toISOString() : null, session.id).run();
  } else {
    if (session.status !== "active") return json({ error: "Session is not active" }, 409);
    const latestUserMessage = await env.DB.prepare(`SELECT content FROM chat_messages
      WHERE chat_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1`)
      .bind(session.chat_id).first<{ content: string }>();
    const endsAt = session.ends_at ? Date.parse(`${session.ends_at.replace(" ", "T")}Z`) : 0;
    const sessionIsStale = Boolean(endsAt && Date.now() > endsAt + 15 * 60 * 1000);
    const conversationMovedOn = Boolean(latestUserMessage &&
      /\b(?:buy|purchase|content|video|photo|trailer|custom|book|booking|payment|pay)\b/i.test(latestUserMessage.content));
    if (!sessionIsStale && !conversationMovedOn) {
      const reply = "That was fun, babe. Let me know when you want another session.";
      await sendTelegramMessage(env, telegramMessage, reply);
      await saveMessage(env.DB, session.chat_id, "assistant", reply);
    }
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
    if (!file.size) return json({ error: "The selected file is empty" }, 400);
    if (file.size > 50 * 1024 * 1024) {
      return json({ error: "Each photo or video must be smaller than 50 MB" }, 413);
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
    const videoExtensions = new Set(["mp4", "mov", "webm"]);
    const mediaType = file.type.startsWith("video/") || videoExtensions.has(extension) ? "video"
      : file.type.startsWith("image/") || imageExtensions.has(extension) ? "image" : null;
    if (!mediaType) return json({ error: "Use a JPG, PNG, WebP, GIF, HEIC, MP4, MOV, or WebM file" }, 400);
    const fallbackMimeTypes: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
      heic: "image/heic", heif: "image/heif", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    };
    const mimeType = file.type.startsWith(`${mediaType}/`) ? file.type : fallbackMimeTypes[extension];
    if (!mimeType) return json({ error: "The file type could not be identified" }, 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._]/g, "_").slice(-120);
    const r2Key = `sexting/${crypto.randomUUID()}-${safeName}`;
    try {
      await env.MEDIA.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: mimeType } });
      await env.DB.prepare(`INSERT INTO sexting_media
        (label, media_type, file_name, mime_type, r2_key) VALUES (?, ?, ?, ?, ?)`)
        .bind(label.slice(0, 160), mediaType, file.name.slice(0, 255), mimeType, r2Key).run();
      return json({ ok: true });
    } catch (error) {
      console.error("Sexting media upload failed", error);
      await env.MEDIA.delete(r2Key).catch(() => undefined);
      return json({ error: "Storage could not save this file. Please try again." }, 500);
    }
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
    learning: ["approval", "off"],
    custom_approval: ["required", "off"],
    sexting_enabled: ["on", "off"],
    sexting_test_mode: ["on", "off"],
    sexting_intensity: ["soft", "hard", "hot"],
    sleep_hours_enabled: ["on", "off"],
  };
  const rateKeys = ["video_chat_rate", "custom_content_rate", "in_person_rate", "sexting_rate"];
  const starKeys = ["sexting_5_stars", "sexting_10_stars"];
  const minuteKeys = ["sexting_min_minutes"];
  const textKeys = ["preferred_topics", "avoid_topics", "tone_guidance", "creator_feedback"];
  const timeKeys = ["sleep_start", "sleep_end"];
  const validRate = body.key && rateKeys.includes(body.key) && body.value &&
    Number.isFinite(Number(body.value)) && Number(body.value) > 0 && Number(body.value) <= 100000;
  const validStars = body.key && starKeys.includes(body.key) && body.value &&
    Number.isInteger(Number(body.value)) && Number(body.value) > 0 && Number(body.value) <= 10000;
  const validMinutes = body.key && minuteKeys.includes(body.key) && body.value &&
    Number.isInteger(Number(body.value)) && Number(body.value) >= 1 && Number(body.value) <= 9;
  const validText = body.key && textKeys.includes(body.key) && typeof body.value === "string" && body.value.length <= 4000;
  const validTime = body.key && timeKeys.includes(body.key) && typeof body.value === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.value);
  if (!body.key || typeof body.value !== "string" || (!allowed[body.key]?.includes(body.value) && !validRate && !validStars && !validMinutes && !validText && !validTime)) {
    return json({ error: "Invalid setting" }, 400);
  }
  await env.DB.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
    .bind(body.key, body.value).run();
  return json({ ok: true, settings: await getSettings(env.DB) });
}

async function handleSaleDisputes(request: Request, env: Env) {
  const portalUser = await getPortalUser(request, env);
  if (!portalUser) return json({ error: "Sign in required" }, 401);
  await prepareDatabase(env.DB);
  const body = await request.json() as {
    earnings_event_id?: number;
    sexting_session_id?: number;
    reason?: string;
    proof?: string;
    id?: number;
    action?: "approve" | "deny";
  };
  if (request.method === "POST") {
    const reason = body.reason?.trim().slice(0, 1000) || "";
    const proof = body.proof?.trim().slice(0, 2000) || "";
    if ((!body.earnings_event_id && !body.sexting_session_id) || !reason || !proof) {
      return json({ error: "Choose a sale and provide a reason and proof" }, 400);
    }
    if (body.sexting_session_id) {
      const session = await env.DB.prepare(`SELECT id, package_title, telegram_name, stars, created_at
        FROM sexting_sessions WHERE id = ? AND status = 'completed'`).bind(body.sexting_session_id).first<{
          id: number;
          package_title: string;
          telegram_name: string;
          stars: number;
          created_at: string;
        }>();
      if (!session) return json({ error: "Completed Stars session was not found" }, 404);
      const disputeKey = -session.id;
      const pending = await env.DB.prepare(`SELECT id FROM sale_disputes
        WHERE earnings_event_id = ? AND status = 'pending' LIMIT 1`).bind(disputeKey).first();
      if (pending) return json({ error: "That Stars session already has a pending report" }, 409);
      await env.DB.prepare(`INSERT INTO sale_disputes
        (creator_key, earnings_event_id, source_type, source_id, description, amount_cents,
         stars, occurred_at, requester_email, reason, proof)
        VALUES (?, ?, 'sexting_stars', ?, ?, 0, ?, ?, ?, ?, ?)`)
        .bind(portalUser.creator_key, disputeKey, String(session.id),
          `${session.package_title} with ${session.telegram_name}`, session.stars, session.created_at,
          portalUser.email, reason, proof).run();
      return json({ ok: true });
    }
    const sale = await env.DB.prepare(`SELECT id, source_type, source_id, description, amount_cents, occurred_at
      FROM earnings_events WHERE id = ?`).bind(body.earnings_event_id).first<{
        id: number;
        source_type: string;
        source_id: string;
        description: string;
        amount_cents: number;
        occurred_at: string;
      }>();
    if (!sale) return json({ error: "Sale was not found" }, 404);
    const pending = await env.DB.prepare(`SELECT id FROM sale_disputes
      WHERE earnings_event_id = ? AND status = 'pending' LIMIT 1`).bind(sale.id).first();
    if (pending) return json({ error: "That sale already has a pending report" }, 409);
    await env.DB.prepare(`INSERT INTO sale_disputes
      (creator_key, earnings_event_id, source_type, source_id, description, amount_cents,
       stars, occurred_at, requester_email, reason, proof)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`)
      .bind(portalUser.creator_key, sale.id, sale.source_type, sale.source_id, sale.description,
        sale.amount_cents, sale.occurred_at, portalUser.email, reason, proof).run();
    return json({ ok: true });
  }
  if (request.method === "PATCH") {
    if (portalUser.role !== "owner") return json({ error: "Owner approval is required" }, 403);
    if (!body.id || !body.action) return json({ error: "A dispute decision is required" }, 400);
    const dispute = await env.DB.prepare(`SELECT id, earnings_event_id, source_type, source_id
      FROM sale_disputes WHERE id = ? AND status = 'pending'`).bind(body.id).first<{
        id: number;
        earnings_event_id: number;
        source_type: string;
        source_id: string;
      }>();
    if (!dispute) return json({ error: "Dispute is no longer pending" }, 404);
    if (body.action === "deny") {
      await env.DB.prepare(`UPDATE sale_disputes SET status = 'denied', reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(portalUser.email, dispute.id).run();
      return json({ ok: true });
    }
    const updates = [
      env.DB.prepare("DELETE FROM earnings_events WHERE id = ?").bind(dispute.earnings_event_id),
      env.DB.prepare(`UPDATE sale_disputes SET status = 'approved', reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(portalUser.email, dispute.id),
    ];
    if (dispute.source_type === "content") {
      updates.push(env.DB.prepare(`UPDATE purchase_requests SET status = 'disputed_removed'
        WHERE id = ?`).bind(Number(dispute.source_id)));
    } else if (dispute.source_type === "custom_content" || dispute.source_type === "video_chat") {
      updates.push(env.DB.prepare(`UPDATE booking_requests SET status = 'disputed_removed'
        WHERE id = ?`).bind(Number(dispute.source_id)));
      if (dispute.source_type === "custom_content") {
        updates.push(env.DB.prepare(`UPDATE custom_fulfillments SET status = 'disputed_removed'
          WHERE booking_request_id = ?`).bind(Number(dispute.source_id)));
      }
    } else if (dispute.source_type === "sexting_stars") {
      updates.push(env.DB.prepare(`UPDATE sexting_sessions SET status = 'disputed_removed'
        WHERE id = ?`).bind(Number(dispute.source_id)));
    }
    await env.DB.batch(updates);
    return json({ ok: true });
  }
  return json({ error: "Sale dispute request not found" }, 404);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
      ctx.waitUntil(handleTelegramWebhook(request.clone(), env).catch((error) => {
        console.error("Telegram webhook background task failed", error);
      }));
      return json({ ok: true, queued: true });
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

    if (url.pathname === "/api/admin/physical-order" && request.method === "POST") {
      return handleAdminPhysicalOrder(request, env);
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

    if (url.pathname === "/api/admin/sale-disputes" && (request.method === "POST" || request.method === "PATCH")) {
      return handleSaleDisputes(request, env);
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
