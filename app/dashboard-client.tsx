"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "bot" | "fan" | "system";
  text: string;
  time: string;
};

type TestChatMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type TestChatFeedback = {
  id: number;
  user_message: string;
  assistant_message: string;
  correction: string;
  action: "flag" | "learn";
  created_by: string;
  created_at: string;
};

type LivePendingReply = {
  id: number;
  chat_id: string;
  question: string;
  created_at: string;
};

type LivePurchase = {
  id: number;
  chat_id?: string;
  product_title: string;
  price: string;
  payment_note: string;
  payment_proof_file_id?: string;
  payment_proof_received_at?: string;
  created_at: string;
  status?: "pending" | "approved" | "declined" | "closed_unpaid";
  resolved_at?: string;
  content_type?: ContentProduct["content_type"];
};

type LiveBooking = {
  id: number;
  details: string;
  created_at: string;
  telegram_name: string;
  suggested_type: "video_chat" | "custom_content";
};

type PaymentMethods = {
  cashapp: string;
  venmo: string;
  zelle: string;
};

type LiveCustom = {
  id: number;
  chat_id?: string;
  telegram_name: string;
  duration_minutes: number;
  description: string;
  amount_cents: number;
  created_at?: string;
  delivery_url?: string;
  completion_comment?: string;
  completed_at?: string;
  status?: "awaiting_payment" | "payment_review" | "awaiting_fulfillment" | "completed" | "cancelled" | "closed_unpaid";
};

type VideoChatOrder = {
  id: number;
  chat_id: string;
  telegram_name: string;
  scheduled_at: string;
  duration_minutes: number;
  rate_cents: number;
  amount_cents: number;
  status: "awaiting_payment" | "payment_review" | "scheduled" | "completed" | "cancelled" | "closed_unpaid";
  created_at: string;
  completed_at?: string;
};

type LiveSextingSession = {
  id: number;
  telegram_name: string;
  package_title: string;
  duration_minutes: number;
  stars: number;
  status: "paid" | "active" | "completed";
  control_mode?: "bot" | "human";
  taken_over_at?: string;
  created_at?: string;
  started_at?: string;
  ends_at?: string;
  completed_at?: string;
};

type SextingMedia = {
  id: number;
  label: string;
  media_type: "image" | "video";
  file_name: string;
  mime_type: string;
  active: number;
  created_at: string;
};

type ContentProduct = {
  id: number;
  content_type: "photo" | "photo_package" | "video" | "video_bundle" | "physical_item" | "video_rating";
  title: string;
  price_cents: number;
  stars_price: number;
  genre: string;
  actors: string;
  trailer_url: string;
  delivery_url: string;
  active: number;
  media_count: number;
  created_at: string;
};

type CatalogPhotoMedia = {
  id: number;
  product_id: number;
  file_name: string;
  mime_type: string;
  product_title: string;
};

function productTags(value: string) {
  const seen = new Set<string>();
  return value.split(/[,;|]+/).map((tag) => tag.trim()).filter((tag) => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type PhysicalOrder = {
  id: number;
  product_title: string;
  customer_name: string;
  shipping_address: string;
  tracking_number: string;
  amount_cents: number;
  status: "awaiting_name" | "awaiting_address" | "awaiting_shipment" | "shipped";
  created_at: string;
  shipped_at?: string;
};

type RatingOrder = {
  id: number;
  chat_id?: string;
  telegram_name: string;
  amount_cents: number;
  stars: number;
  status: "awaiting_photo" | "awaiting_response" | "completed";
  created_at: string;
  completed_at?: string;
};

type SextingScript = {
  id: number;
  stage: "warmup" | "transition" | "fantasy" | "climax" | "closing";
  title: string;
  script_text: string;
  media_label: string;
  active: number;
  created_at: string;
};

type DailyTask = {
  id: number;
  title: string;
  task_type: "video_chat" | "custom" | "delivery" | "follow_up" | "in_person" | "other";
  scheduled_at: string;
  fan_name: string;
  details: string;
  amount_cents: number;
  status: "open" | "completed";
  created_at: string;
  completed_at?: string;
};

type Announcement = {
  id: number;
  platform: string;
  message: string;
  stream_url: string;
  status: "sending" | "sent";
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string;
};

type SocialLink = {
  id: number;
  platform: string;
  label: string;
  url: string;
  created_at: string;
};

type TrainingSuggestion = {
  id: number;
  category: "topic" | "fact" | "like" | "dislike" | "voice" | "avoid" | "tone" | "feedback";
  suggestion: string;
  created_at: string;
};

type EarningsSummary = {
  weekly_cents: number;
  weekly_count: number;
  all_time_cents: number;
  all_time_count: number;
  recent: Array<{ id: number; source_type: string; description: string; amount_cents: number; occurred_at: string }>;
  history: Array<{ id: number; source_type: string; description: string; amount_cents: number; occurred_at: string }>;
  by_type: Array<{ source_type: string; total_cents: number; transaction_count: number }>;
};

type StarsSummary = {
  total: number;
  count: number;
  sexting: number;
  sexting_count: number;
  ratings: number;
  rating_count: number;
  content: number;
  content_count: number;
};

type SaleDispute = {
  id: number;
  creator_key: string;
  earnings_event_id: number;
  source_type: string;
  source_id: string;
  description: string;
  amount_cents: number;
  stars: number;
  occurred_at: string;
  requester_email: string;
  reason: string;
  proof: string;
  status: "pending" | "approved" | "denied";
  reviewed_by?: string;
  created_at: string;
  reviewed_at?: string;
};

type PortalUser = {
  email: string;
  role: "owner" | "creator";
  creator_key: string;
  creator_name: string;
};

type LiveConversation = {
  chat_id: string;
  telegram_name: string;
  age_status: "unknown" | "verified" | "blocked";
  is_blocked: number;
  last_message: string;
  last_role: "user" | "assistant" | "";
  last_message_at: string;
  message_count: number;
  pending_count: number;
  active_workflow: "chat" | "sexting" | "custom" | "booking" | "sexting checkout";
  control_mode: "bot" | "human";
};

type NewChatter = {
  chat_id: string;
  proposed_name: string;
  telegram_name: string;
  last_message: string;
  submitted_at: string;
};

type ConversationMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  voice_note_id?: number;
  voice_duration?: number;
  voice_status?: "creator_review";
};

type QuickReplyCategory = "general" | "content" | "custom" | "bookings" | "video_chat" | "ratings" | "payment" | "boundaries";

type PlatformOverview = {
  creator_count: number;
  active_creator_count: number;
  attention_count: number;
  creators: Array<{
    key: string;
    name: string;
    email: string;
    status: string;
    template_name: string;
    telegram_connected: boolean;
    weekly_cents: number;
    all_time_cents: number;
    all_time_stars: number;
    daily_earnings: Array<{
      date: string;
      amount_cents: number;
      transaction_count: number;
      items: Array<{ id: number; source_type: string; description: string; amount_cents: number; occurred_at: string }>;
      stars: number;
      star_transaction_count: number;
      star_items: Array<{ id: number; package_title: string; stars: number; created_at: string }>;
    }>;
  }>;
};

type CreatorSettings = {
  flirty_level: "soft" | "flirty" | "very";
  human_takeover: "on" | "off";
  learning: "approval" | "off";
  custom_approval: "required" | "off";
  video_chat_rate: string;
  custom_content_rate: string;
  in_person_rate: string;
  video_rating_rate: string;
  preferred_topics: string;
  avoid_topics: string;
  tone_guidance: string;
  creator_feedback: string;
  sexting_enabled: "on" | "off";
  sexting_intensity: "soft" | "hard" | "hot";
  sexting_rate: string;
  sexting_min_minutes: string;
  sexting_5_stars: string;
  sexting_10_stars: string;
  sleep_hours_enabled: "on" | "off";
  response_test_mode: "on" | "off";
  sleep_start: string;
  sleep_end: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function revenueLabel(sourceType: string) {
  return ({
    content: "Content sales",
    custom_content: "Customs",
    video_chat: "Video chats",
    physical_item: "Panties and merchandise",
    video_rating: "Dick ratings",
  } as Record<string, string>)[sourceType] || sourceType.replaceAll("_", " ");
}

function portalDate(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

function videoChatSchedule(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(portalDate(value));
}

const initialMessages: Message[] = [
  {
    id: 1,
    role: "bot",
    text: "Hey, before we text I need to make sure you're 18+ so we can talk about everything. Are you 18+?",
    time: "Now",
  },
];

const safeBlocks = ["under 18", "minor", "i am 17", "i'm 17", "im 17"];
const handoffWords = ["custom", "meet me", "address", "discount", "special request"];

function nextReply(input: string) {
  const text = input.toLowerCase();

  if (safeBlocks.some((word) => text.includes(word))) {
    return {
      kind: "blocked" as const,
      text: "I can only chat with adults who are 18 or older. This conversation is now closed.",
    };
  }

  if (handoffWords.some((word) => text.includes(word))) {
    return {
      kind: "handoff" as const,
      text: "Give me a moment, babe. I want to make sure I answer that properly 💋",
    };
  }

  if (text.includes("buy") || text.includes("content") || text.includes("video")) {
    return {
      kind: "reply" as const,
      text: "Mmm you came to the right place, babe 💖 Tap Shop and I will show you something tempting 😈",
    };
  }

  if (text.includes("book") || text.includes("call") || text.includes("available")) {
    return {
      kind: "reply" as const,
      text: "I would love a little private time with you, babe 💕 Tap Book and choose a time that works for you.",
    };
  }

  if (text.includes("anime") || text.includes("read") || text.includes("movie")) {
    return {
      kind: "reply" as const,
      text: "You found my softer side, babe 💖 I love anime, reading, and a perfect movie night. What are you into?",
    };
  }

  return {
    kind: "reply" as const,
    text: "Hey babe 💖 I am feeling sweet and a little dangerous today 😈 What are you in the mood for?",
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "shop" | "book">("chat");
  const [creatorMode, setCreatorMode] = useState(false);
  const [creatorReply, setCreatorReply] = useState("");
  const [savedAnswers, setSavedAnswers] = useState(12);
  const [livePending, setLivePending] = useState<LivePendingReply[]>([]);
  const [conversations, setConversations] = useState<LiveConversation[]>([]);
  const [newChatters, setNewChatters] = useState<NewChatter[]>([]);
  const [newChatterNames, setNewChatterNames] = useState<Record<string, string>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationStatus, setConversationStatus] = useState("");
  const [conversationReply, setConversationReply] = useState("");
  const [quickReplyWorkflow, setQuickReplyWorkflow] = useState<"start_custom" | "start_video_chat" | "start_booking" | null>(null);
  const [quickReplyCategory, setQuickReplyCategory] = useState<QuickReplyCategory>("content");
  const [quickReplyProductId, setQuickReplyProductId] = useState(0);
  const [paidPhotoSource, setPaidPhotoSource] = useState<"sexting" | "catalog">("sexting");
  const [paidPhotoMediaId, setPaidPhotoMediaId] = useState(0);
  const [paidPhotoStars, setPaidPhotoStars] = useState("");
  const [paidPhotoTitle, setPaidPhotoTitle] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>({ cashapp: "", venmo: "", zelle: "" });
  const [livePurchases, setLivePurchases] = useState<LivePurchase[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<LivePurchase[]>([]);
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveCustoms, setLiveCustoms] = useState<LiveCustom[]>([]);
  const [customHistory, setCustomHistory] = useState<LiveCustom[]>([]);
  const [videoChats, setVideoChats] = useState<VideoChatOrder[]>([]);
  const [videoChatHistory, setVideoChatHistory] = useState<VideoChatOrder[]>([]);
  const [sextingSessions, setSextingSessions] = useState<LiveSextingSession[]>([]);
  const [sextingHistory, setSextingHistory] = useState<LiveSextingSession[]>([]);
  const [starsSummary, setStarsSummary] = useState<StarsSummary>({ total: 0, count: 0, sexting: 0, sexting_count: 0, ratings: 0, rating_count: 0, content: 0, content_count: 0 });
  const [sextingMedia, setSextingMedia] = useState<SextingMedia[]>([]);
  const [contentProducts, setContentProducts] = useState<ContentProduct[]>([]);
  const [catalogPhotoMedia, setCatalogPhotoMedia] = useState<CatalogPhotoMedia[]>([]);
  const [sextingScripts, setSextingScripts] = useState<SextingScript[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [physicalOrders, setPhysicalOrders] = useState<PhysicalOrder[]>([]);
  const [physicalOrderHistory, setPhysicalOrderHistory] = useState<PhysicalOrder[]>([]);
  const [ratingOrders, setRatingOrders] = useState<RatingOrder[]>([]);
  const [ratingOrderHistory, setRatingOrderHistory] = useState<RatingOrder[]>([]);
  const [ratingResponseFiles, setRatingResponseFiles] = useState<Record<number, File | null>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<number, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] = useState({ kind: "live" as "live" | "new_content" | "custom", platform: "Instagram", message: "", stream_url: "", product_id: 0 });
  const [announcementPreview, setAnnouncementPreview] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialForm, setSocialForm] = useState({ platform: "Instagram", label: "", url: "" });
  const [editingSocialId, setEditingSocialId] = useState<number | null>(null);
  const [trainingSuggestions, setTrainingSuggestions] = useState<TrainingSuggestion[]>([]);
  const [trainingForm, setTrainingForm] = useState({ category: "fact" as TrainingSuggestion["category"], suggestion: "" });
  const [editingTrainingId, setEditingTrainingId] = useState<number | null>(null);
  const [agendaDate, setAgendaDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()));
  const [taskForm, setTaskForm] = useState({ title: "", task_type: "video_chat" as DailyTask["task_type"], scheduled_at: "", fan_name: "", details: "", amount: "" });
  const [scriptForm, setScriptForm] = useState({ stage: "warmup" as SextingScript["stage"], title: "", script_text: "", media_label: "" });
  const [productForm, setProductForm] = useState({ content_type: "video" as ContentProduct["content_type"], title: "", price: "", stars_price: "", genre: "", actors: "", trailer_url: "", delivery_url: "" });
  const [productTagDraft, setProductTagDraft] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productUploadKey, setProductUploadKey] = useState(0);
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaUploadKey, setMediaUploadKey] = useState(0);
  const [mediaUploadStatus, setMediaUploadStatus] = useState("");
  const [customLinks, setCustomLinks] = useState<Record<number, string>>({});
  const [customComments, setCustomComments] = useState<Record<number, string>>({});
  const [earnings, setEarnings] = useState<EarningsSummary>({ weekly_cents: 0, weekly_count: 0, all_time_cents: 0, all_time_count: 0, recent: [], history: [], by_type: [] });
  const [saleDisputes, setSaleDisputes] = useState<SaleDispute[]>([]);
  const [disputedSale, setDisputedSale] = useState<EarningsSummary["history"][number] | null>(null);
  const [disputedStarsSession, setDisputedStarsSession] = useState<LiveSextingSession | null>(null);
  const [disputeForm, setDisputeForm] = useState({ reason: "", proof: "" });
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview | null>(null);
  const [ownerDayView, setOwnerDayView] = useState<string | null>(null);
  const [earningsView, setEarningsView] = useState<"weekly" | "all" | null>(null);
  const [earningsReferenceTime] = useState(() => Date.now());
  const [bookingType, setBookingType] = useState<"video_chat" | "custom_content" | "in_person">("video_chat");
  const [bookingDuration, setBookingDuration] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [bookingScheduledAt, setBookingScheduledAt] = useState("");
  const [settings, setSettings] = useState<CreatorSettings>({ flirty_level: "very", human_takeover: "on", learning: "approval", custom_approval: "required", video_chat_rate: "50", custom_content_rate: "50", in_person_rate: "1500", video_rating_rate: "75", preferred_topics: "", avoid_topics: "", tone_guidance: "Short, blunt, warm, confident, flirty, and natural", creator_feedback: "", sexting_enabled: "on", sexting_intensity: "soft", sexting_rate: "10", sexting_min_minutes: "5", sexting_5_stars: "500", sexting_10_stars: "1000", sleep_hours_enabled: "on", response_test_mode: "off", sleep_start: "02:00", sleep_end: "08:00" });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dashboardView, setDashboardView] = useState<"today" | "inbox" | "test" | "content" | "settings" | "history">("today");
  const [testChatMessages, setTestChatMessages] = useState<TestChatMessage[]>([]);
  const [testChatFeedback, setTestChatFeedback] = useState<TestChatFeedback[]>([]);
  const [testChatInput, setTestChatInput] = useState("");
  const [testChatCorrection, setTestChatCorrection] = useState("");
  const [testChatBusy, setTestChatBusy] = useState(false);
  const [testChatStatus, setTestChatStatus] = useState("");
  const previousAttentionCount = useRef<number | null>(null);
  const previousPaymentProofCount = useRef<number | null>(null);
  const settingsDirtyRef = useRef(false);

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { portal_user: PortalUser; payment_methods: PaymentMethods; platform_overview: PlatformOverview | null; pending: LivePendingReply[]; conversations: LiveConversation[]; new_chatters: NewChatter[]; purchases: LivePurchase[]; purchase_history: LivePurchase[]; bookings: LiveBooking[]; customs: LiveCustom[]; custom_history: LiveCustom[]; video_chats: VideoChatOrder[]; video_chat_history: VideoChatOrder[]; sexting_sessions: LiveSextingSession[]; sexting_history: LiveSextingSession[]; sexting_media: SextingMedia[]; catalog_photo_media: CatalogPhotoMedia[]; sexting_scripts: SextingScript[]; daily_tasks: DailyTask[]; physical_orders: PhysicalOrder[]; physical_order_history: PhysicalOrder[]; rating_orders: RatingOrder[]; rating_order_history: RatingOrder[]; announcements: Announcement[]; social_links: SocialLink[]; training_suggestions: TrainingSuggestion[]; sale_disputes: SaleDispute[]; products: ContentProduct[]; stars: StarsSummary; learned_count: number; earnings: EarningsSummary; settings: CreatorSettings };
      setPortalUser(data.portal_user);
      setPaymentMethods(data.payment_methods || { cashapp: "", venmo: "", zelle: "" });
      setPlatformOverview(data.platform_overview);
      setLivePending(data.pending);
      setConversations(data.conversations || []);
      setNewChatters(data.new_chatters || []);
      setNewChatterNames((current) => {
        const next: Record<string, string> = {};
        for (const chatter of data.new_chatters || []) {
          next[chatter.chat_id] = current[chatter.chat_id] ?? chatter.proposed_name;
        }
        return next;
      });
      setLivePurchases(data.purchases);
      setPurchaseHistory(data.purchase_history || []);
      setLiveBookings(data.bookings);
      setLiveCustoms(data.customs || []);
      setCustomHistory(data.custom_history || []);
      setVideoChats(data.video_chats || []);
      setVideoChatHistory(data.video_chat_history || []);
      setSextingSessions(data.sexting_sessions || []);
      setSextingHistory(data.sexting_history || []);
      setStarsSummary(data.stars || { total: 0, count: 0, sexting: 0, sexting_count: 0, ratings: 0, rating_count: 0, content: 0, content_count: 0 });
      setSextingMedia(data.sexting_media || []);
      setContentProducts(data.products || []);
      setCatalogPhotoMedia(data.catalog_photo_media || []);
      setSextingScripts(data.sexting_scripts || []);
      setDailyTasks(data.daily_tasks || []);
      setPhysicalOrders(data.physical_orders || []);
      setPhysicalOrderHistory(data.physical_order_history || []);
      setRatingOrders(data.rating_orders || []);
      setRatingOrderHistory(data.rating_order_history || []);
      setAnnouncements(data.announcements || []);
      setSocialLinks(data.social_links || []);
      setTrainingSuggestions(data.training_suggestions || []);
      setSaleDisputes(data.sale_disputes || []);
      if (data.bookings[0]?.suggested_type) setBookingType(data.bookings[0].suggested_type);
      setEarnings({ ...data.earnings, by_type: data.earnings.by_type || [] });
      if (!settingsDirtyRef.current) setSettings(data.settings);
      setSavedAnswers(data.learned_count);
      setLiveError("");
    } catch {
      setLiveError("The live creator inbox could not be loaded.");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLivePending(), 0);
    const timer = window.setInterval(() => void loadLivePending(), 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadLivePending]);

  const loadTestChat = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/test-chat", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to open the test chat");
      const data = await response.json() as { messages: TestChatMessage[]; feedback: TestChatFeedback[] };
      setTestChatMessages(data.messages || []);
      setTestChatFeedback(data.feedback || []);
    } catch {
      setTestChatStatus("The test chat could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (dashboardView !== "test") return;
    const initialLoad = window.setTimeout(() => void loadTestChat(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [dashboardView, loadTestChat]);

  async function sendTestChatMessage(event: FormEvent) {
    event.preventDefault();
    const message = testChatInput.trim();
    if (!message || testChatBusy) return;
    setTestChatBusy(true);
    setTestChatStatus("Running the real conversation flow...");
    try {
      const response = await fetch("/api/admin/test-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json() as { error?: string; messages?: TestChatMessage[]; feedback?: TestChatFeedback[]; outcome?: { creator_reply_needed?: boolean } };
      if (!response.ok) throw new Error(data.error || "The test message failed");
      setTestChatMessages(data.messages || []);
      setTestChatFeedback(data.feedback || []);
      setTestChatInput("");
      setTestChatCorrection("");
      setTestChatStatus(data.outcome?.creator_reply_needed
        ? "The flow correctly paused for creator review."
        : "Instant sandbox reply complete. Nothing was sent to Telegram.");
    } catch (error) {
      setTestChatStatus(error instanceof Error ? error.message : "The test message failed.");
    } finally {
      setTestChatBusy(false);
    }
  }

  async function resetTestChat(onboarding = false) {
    setTestChatBusy(true);
    setTestChatStatus(onboarding ? "Resetting to the age gate..." : "Starting a clean verified chat...");
    try {
      const response = await fetch("/api/admin/test-chat", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarding }),
      });
      const data = await response.json() as { error?: string; messages?: TestChatMessage[]; feedback?: TestChatFeedback[] };
      if (!response.ok) throw new Error(data.error || "Reset failed");
      setTestChatMessages(data.messages || []);
      setTestChatFeedback(data.feedback || []);
      setTestChatCorrection("");
      setTestChatStatus(onboarding ? "Age gate test is ready." : "Clean verified test chat is ready.");
    } catch (error) {
      setTestChatStatus(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setTestChatBusy(false);
    }
  }

  async function reviewTestReply(action: "flag" | "learn") {
    let assistantIndex = -1;
    for (let index = testChatMessages.length - 1; index >= 0; index -= 1) {
      if (testChatMessages[index].role === "assistant") { assistantIndex = index; break; }
    }
    let userMessage = "";
    if (assistantIndex >= 0) {
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        if (testChatMessages[index].role === "user") { userMessage = testChatMessages[index].content; break; }
      }
    }
    const assistantMessage = assistantIndex >= 0 ? testChatMessages[assistantIndex].content : "";
    if (!userMessage) {
      setTestChatStatus("Send a test message before reviewing a reply.");
      return;
    }
    if (action === "learn" && !testChatCorrection.trim()) {
      setTestChatStatus("Write the better reply first.");
      return;
    }
    setTestChatBusy(true);
    try {
      const response = await fetch("/api/admin/test-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, user_message: userMessage, assistant_message: assistantMessage, correction: testChatCorrection }),
      });
      const data = await response.json() as { error?: string; feedback?: TestChatFeedback[] };
      if (!response.ok) throw new Error(data.error || "Review could not be saved");
      setTestChatFeedback(data.feedback || []);
      setTestChatCorrection("");
      setTestChatStatus(action === "learn"
        ? "Better reply learned for this creator. Retest it now."
        : "Reply flagged for conversation flow review.");
    } catch (error) {
      setTestChatStatus(error instanceof Error ? error.message : "Review could not be saved.");
    } finally {
      setTestChatBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedConversationId) return;
    const refreshTranscript = async () => {
      try {
        const response = await fetch(`/api/admin/conversations/${encodeURIComponent(selectedConversationId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { messages: ConversationMessage[] };
        setConversationMessages(data.messages || []);
      } catch {
        // Keep the current transcript visible if a background refresh fails.
      }
    };
    const timer = window.setInterval(() => void refreshTranscript(), 3000);
    return () => window.clearInterval(timer);
  }, [selectedConversationId]);

  const attentionCount = newChatters.length + livePending.length + livePurchases.length + liveBookings.length + liveCustoms.length + videoChats.length + sextingSessions.length;
  const paymentProofCount = livePurchases.filter((purchase) => Boolean(purchase.payment_proof_received_at)).length;
  const statusText = attentionCount ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} attention` : "Bot active";
  const onboardingPhotoCount = sextingMedia.filter((item) => item.media_type === "image").length;
  const onboardingClipCount = sextingMedia.filter((item) => item.media_type === "video").length;
  const onboardingSteps = [onboardingPhotoCount >= 20, onboardingClipCount >= 5, contentProducts.length > 0];
  const onboardingProgress = Math.round((onboardingSteps.filter(Boolean).length / onboardingSteps.length) * 100);

  useEffect(() => {
    const previous = previousAttentionCount.current;
    previousAttentionCount.current = attentionCount;
    if (!notificationsEnabled || previous === null || attentionCount <= previous || typeof Notification === "undefined") return;
    new Notification(`${portalUser?.creator_name || "Creator"} inbox`, {
      body: statusText,
      icon: "/favicon.svg",
    });
  }, [attentionCount, notificationsEnabled, statusText]);

  useEffect(() => {
    const previous = previousPaymentProofCount.current;
    previousPaymentProofCount.current = paymentProofCount;
    if (!notificationsEnabled || previous === null || paymentProofCount <= previous || typeof Notification === "undefined") return;
    new Notification(`${portalUser?.creator_name || "Creator"} payment`, {
      body: "A payment screenshot is ready for approval.",
      icon: "/favicon.svg",
    });
  }, [notificationsEnabled, paymentProofCount, portalUser?.creator_name]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setLiveError("Notifications are not supported in this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    if (permission !== "granted") setLiveError("Notifications were not enabled. You can allow them in your browser settings.");
  }

  function addMessage(role: Message["role"], text: string) {
    setMessages((current) => [
      ...current,
      { id: Date.now() + Math.random(), role, text, time: "Now" },
    ]);
  }

  function confirmAge(isAdult: boolean) {
    if (!isAdult) {
      addMessage("fan", "No");
      addMessage(
        "bot",
        "I can only chat with adults who are 18 or older. This conversation is now closed.",
      );
      setBlocked(true);
      return;
    }

    addMessage("fan", "Yes, I am 18 or older");
    setVerified(true);
    window.setTimeout(
      () =>
        addMessage(
          "bot",
          `Hey, it's ${portalUser?.creator_name.split(/\s+/)[0] || "me"}. What are you up to?`,
        ),
      250,
    );
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !verified || blocked) return;

    addMessage("fan", message);
    setInput("");
    const reply = nextReply(message);

    window.setTimeout(() => {
      addMessage("bot", reply.text);
      if (reply.kind === "blocked") setBlocked(true);
      if (reply.kind === "handoff") setPending((current) => [...current, message]);
    }, 300);
  }

  function sendCreatorReply(save: boolean) {
    if (!creatorReply.trim()) return;
    addMessage("bot", creatorReply.trim());
    setPending((current) => current.slice(1));
    setCreatorReply("");
    if (save) setSavedAnswers((current) => current + 1);
  }

  async function sendLiveCreatorReply(save: boolean) {
    const current = livePending[0];
    const answer = creatorReply.trim();
    if (!current || !answer) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, answer, learn: save }),
      });
      if (!response.ok) throw new Error("Reply failed");
      setCreatorReply("");
      await loadLivePending();
    } catch {
      setLiveError("The reply was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function ignoreLiveQuestion() {
    const current = livePending[0];
    if (!current) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action: "ignore" }),
      });
      if (!response.ok) throw new Error("Ignore failed");
      setCreatorReply("");
      await loadLivePending();
    } catch {
      setLiveError("The question could not be ignored. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function openConversation(chatId: string) {
    try {
      setSelectedConversationId(chatId);
      setConversationStatus("Loading conversation...");
      const response = await fetch(`/api/admin/conversations/${encodeURIComponent(chatId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Conversation failed to load");
      const data = await response.json() as { conversation: Pick<LiveConversation, "chat_id" | "telegram_name" | "age_status" | "is_blocked" | "control_mode">; messages: ConversationMessage[] };
      setConversationMessages(data.messages || []);
      if (data.conversation) {
        setConversations((items) => items.map((item) => item.chat_id === chatId
          ? { ...item, ...data.conversation }
          : item));
      }
      setConversationReply("");
      setConversationStatus("");
    } catch {
      setConversationMessages([]);
      setConversationStatus("This conversation could not be loaded.");
    }
  }

  async function deleteConversationMessage(message: ConversationMessage) {
    if (!selectedConversation) return;
    const sender = message.role === "user" ? selectedConversation.telegram_name : "the creator or bot";
    if (!window.confirm(`Delete this message from ${sender}? The portal will also ask Telegram to remove it when allowed.`)) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Deleting message...");
      const response = await fetch(`/api/admin/conversations/${encodeURIComponent(selectedConversation.chat_id)}/messages/${message.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice_note_id: message.voice_note_id }),
      });
      const data = await response.json() as { error?: string; warning?: string; telegram_deleted?: boolean };
      if (!response.ok) throw new Error(data.error || "The message could not be deleted");
      setConversationMessages((items) => items.filter((item) => item.id !== message.id));
      setConversationStatus(data.warning || (data.telegram_deleted
        ? "Message deleted from the Inbox and Telegram."
        : "Message deleted from the Inbox."));
      await loadLivePending();
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "The message could not be deleted.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function confirmNewChatterName(chatId: string) {
    const name = (newChatterNames[chatId] || "").trim();
    if (!name) {
      setConversationStatus("Enter the fan's name before confirming it.");
      return;
    }
    try {
      setLiveLoading(true);
      setConversationStatus("Confirming name...");
      const response = await fetch("/api/admin/conversations/confirm-name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, name }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The name could not be confirmed");
      await loadLivePending();
      setSelectedConversationId(chatId);
      await openConversation(chatId);
      setConversationStatus(`Name confirmed as ${name}. The bot is active for this chat.`);
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "The name could not be confirmed.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function submitConversationReply(saveForFuture: boolean) {
    if (!selectedConversation || !conversationReply.trim()) return;
    try {
      setLiveLoading(true);
      setConversationStatus(saveForFuture ? "Sending and saving reply..." : "Sending reply...");
      const response = await fetch("/api/admin/conversations/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: selectedConversation.chat_id, text: conversationReply.trim(), action: "send",
          learn: saveForFuture, workflow_action: quickReplyWorkflow }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Reply failed");
      const resolvedChatId = selectedConversation.chat_id;
      const sentReply = conversationReply.trim();
      setConversationReply("");
      const startedWorkflow = quickReplyWorkflow;
      setQuickReplyWorkflow(null);
      setLivePending((items) => items.filter((item) => item.chat_id !== resolvedChatId));
      setConversations((items) => items.map((item) => item.chat_id === resolvedChatId
        ? { ...item, pending_count: 0, control_mode: startedWorkflow ? "bot" : "human", last_message: sentReply,
          last_role: "assistant", last_message_at: new Date().toISOString().replace("T", " ").replace("Z", "") }
        : item));
      await loadLivePending();
      await openConversation(resolvedChatId);
      setConversationStatus(startedWorkflow
        ? `Reply sent. The bot will collect the ${startedWorkflow === "start_custom" ? "custom details" : startedWorkflow === "start_video_chat" ? "video chat schedule" : "booking details"}.`
        : saveForFuture
          ? "Reply sent and saved for future answers. The bot is paused for this chat."
          : "Reply sent. The bot is paused for this chat.");
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "The reply could not be sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  function sendConversationReply(event: FormEvent) {
    event.preventDefault();
    void submitConversationReply(false);
  }

  async function dismissConversationRequest() {
    if (!selectedConversation) return;
    const chatId = selectedConversation.chat_id;
    try {
      setLiveLoading(true);
      setConversationStatus("Clearing request...");
      const response = await fetch("/api/admin/conversations/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "dismiss" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Request could not be cleared");
      setLivePending((items) => items.filter((item) => item.chat_id !== chatId));
      setConversations((items) => items.map((item) => item.chat_id === chatId
        ? { ...item, pending_count: 0 }
        : item));
      setConversationStatus("Request cleared.");
      await loadLivePending();
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "Request could not be cleared.");
    } finally {
      setLiveLoading(false);
    }
  }

  function fillQuickReply(template: string) {
    const products = contentProducts.filter((product) => product.active && !["physical_item", "video_rating"].includes(product.content_type));
    const product = products.find((item) => item.id === quickReplyProductId) || products[0];
    const productPrice = product ? money(product.price_cents) : "";
    const ratingPrice = `$${Number(settings.video_rating_rate || 75).toFixed(2)}`;
    const catalog = products.slice(0, 8).map((item) => `${item.title} · ${money(item.price_cents)}`).join("\n");
    const paymentList = [
      paymentMethods.cashapp && `Cash App: ${paymentMethods.cashapp}`,
      paymentMethods.venmo && `Venmo: ${paymentMethods.venmo}`,
      paymentMethods.zelle && `Zelle: ${paymentMethods.zelle}`,
    ].filter(Boolean).join("\n");
    const videoChatPayment = paymentList
      ? `You can pay for the video chat with:\n${paymentList}\n\nPut your Telegram username in the notes and send me a screenshot after you pay.`
      : "I'll send you my payment information as soon as we confirm the video chat length and total.";
    const ratingPayment = paymentList
      ? `The private video rating is ${ratingPrice}. You can pay with Cash App, Venmo, or Zelle:\n${paymentList}\n\nPut your Telegram username in the notes and send me a screenshot after you pay.`
      : `The private video rating is ${ratingPrice}. I'll send you my Cash App, Venmo, or Zelle information as soon as it is ready.`;
    const replies: Record<string, string> = {
      saw_message: "Hey babe, I saw your message. What did you want to know?",
      busy: "Hey babe, I'm busy right now, but I'll reply as soon as I can. Please be patient with me.",
      anything_else: "Got it! Lmk if there's anything else you want!",
      catalog: catalog ? `Here's what I have available right now:\n\n${catalog}\n\nTell me which one you want and I'll send you the details.` : "I'm adding new content soon, babe. What kind of content do you want to see?",
      trailer: product?.trailer_url ? `Here's the trailer for ${product.title}, babe:\n${product.trailer_url}\n\nThe full video is ${productPrice}. Do you want to buy it?` : product ? `I have ${product.title}, babe. I don't have a trailer link ready here, but the full video is ${productPrice}. Do you want the details?` : "Which video did you want the trailer for, babe?",
      product_details: product ? `I have ${product.title}${product.actors ? ` starring ${product.actors}` : ""}.${product.genre ? ` Tags: ${product.genre}.` : ""} It's ${productPrice}. Do you want to buy it?` : "Which video did you want more details about, babe?",
      product_payment: product ? `Please send ${productPrice} and put your Telegram username in the notes. After you send it, can you send me a screenshot of the payment?` : "Tell me which video you want and I'll send you the payment details.",
      product_delivery: product?.delivery_url ? `Here you go, babe. Here's ${product.title}:\n${product.delivery_url}\n\nI hope you enjoy it! Lmk what you think` : product ? `I'm sending you ${product.title} here now. I hope you enjoy it! Lmk what you think` : "Which video or photo set did you buy, babe?",
      custom_start: "Yeah babe, I make customs. Tell me what you want and how long you want it to be.",
      custom_more: "Anything else you want me to add?",
      custom_review: "Got it! I'll review everything and let you know what it will cost.",
      custom_quote: "I can't quote you until I know what you want and for how long. Can you send me your idea?",
      booking_options: "Do you wanna set something up? I offer video chats here on Telegram and fan meet and greets. Which one are you interested in?",
      booking_schedule: "Send me your preferred date and time and tell me if you want a video chat or fan meet and greet. If it's a meet and greet, tell me what city you're in too.",
      booking_contact: "What city are you in, babe? Send me your phone number or email and I'll reach out when I'm in your city.",
      video_chat: `Video chats happen right here on Telegram and are $${settings.video_chat_rate} per minute with a 5 minute minimum. What date and time works for you, and how many minutes do you want?`,
      video_chat_now: `I might be able to video chat right now, babe. It's $${settings.video_chat_rate} per minute with a 5 minute minimum, and we'll call right here on Telegram. How many minutes do you want? I'll confirm I'm available before you send payment.`,
      video_chat_not_now: "I can't video chat right this second, babe, but send me a date, time, and how many minutes you want and I'll check my schedule.",
      video_chat_schedule: "Send me your preferred date, time, and how many minutes you want. I'll check my schedule and get back to you.",
      video_chat_confirm: "Yes babe, the video chat will happen right here on Telegram. Once we confirm the date, time, and payment, I'll call you here.",
      video_chat_payment: videoChatPayment,
      rating_offer: `Yes babe, I do private video ratings. It's ${ratingPrice}. You send me a photo and I'll respond with a short private video rating.`,
      rating_photo: "Send me the photo you want me to rate here. I'll review it after I verify your payment.",
      rating_payment: ratingPayment,
      payment_options: "I accept Cash App, Venmo, and Zelle. Tell me what you're buying and I'll send you the payment information.",
      payment_screenshot: "Please put your Telegram username in the payment notes and send me a screenshot after you send it.",
      payment_received: "Ok, thanks babe. Let me check when I get the chance and I'll send you the link!",
      telegram_tos: "I don't discuss in person sex on here due to Telegram TOS. I don't want to get banned.",
      unavailable: "I can't help with that, babe. We can talk about something else if you want.",
    };
    setConversationReply(replies[template] || "");
    if (["custom_start", "custom_more", "custom_quote"].includes(template)) setQuickReplyWorkflow("start_custom");
    else if (["video_chat", "video_chat_now", "video_chat_not_now", "video_chat_schedule", "video_chat_payment"].includes(template)) setQuickReplyWorkflow("start_video_chat");
    else if (["booking_options", "booking_schedule", "booking_contact"].includes(template)) setQuickReplyWorkflow("start_booking");
    else setQuickReplyWorkflow(null);
  }

  async function sendQuickProduct(action: "send_trailer" | "send_product") {
    if (!selectedConversation) return;
    const products = contentProducts.filter((product) => product.active && !["physical_item", "video_rating"].includes(product.content_type));
    const product = products.find((item) => item.id === quickReplyProductId) || products[0];
    if (!product) {
      setConversationStatus("Add an active video or photo item first.");
      return;
    }
    const description = action === "send_trailer" ? `the trailer for ${product.title}` : product.title;
    if (!window.confirm(`Send ${description} to ${selectedConversation.telegram_name} now?`)) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Sending content...");
      const response = await fetch("/api/admin/conversations/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: selectedConversation.chat_id, action, product_id: product.id }),
      });
      const data = await response.json() as { error?: string; sale_recorded?: boolean };
      if (!response.ok) throw new Error(data.error || "Content could not be sent");
      setConversationStatus(action === "send_trailer"
        ? "Trailer sent. Bot replies are paused for this chat."
        : data.sale_recorded
          ? "Payment approved, content sent, and the sale was added to earnings."
          : "Content sent. No pending payment was matched, so earnings were not changed.");
      await openConversation(selectedConversation.chat_id);
      await loadLivePending();
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "Content could not be sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function sendPaidPhotoUnlock() {
    if (!selectedConversation) return;
    const photos = paidPhotoSource === "sexting"
      ? sextingMedia.filter((media) => media.active && media.media_type === "image")
      : catalogPhotoMedia;
    const selected = photos.find((media) => media.id === paidPhotoMediaId) || photos[0];
    const stars = Number(paidPhotoStars);
    if (!selected) {
      setConversationStatus(`Add a photo to the ${paidPhotoSource === "sexting" ? "sexting library" : "content catalog"} first.`);
      return;
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 25000) {
      setConversationStatus("Enter a Stars price between 1 and 25,000.");
      return;
    }
    const defaultTitle = paidPhotoSource === "sexting"
      ? (selected as SextingMedia).label || "Private photo"
      : `${(selected as CatalogPhotoMedia).product_title} photo`;
    const title = paidPhotoTitle.trim() || defaultTitle;
    if (!window.confirm(`Send ${title} to ${selectedConversation.telegram_name} for ${stars.toLocaleString()} Stars?`)) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Sending locked photo...");
      const response = await fetch("/api/admin/conversations/paid-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: selectedConversation.chat_id, source_type: paidPhotoSource,
          media_id: selected.id, stars, title }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The locked photo could not be sent");
      setConversationStatus(`Locked photo sent for ${stars.toLocaleString()} Stars. Earnings update after the fan unlocks it.`);
      setPaidPhotoStars("");
      setPaidPhotoTitle("");
      await openConversation(selectedConversation.chat_id);
      await loadLivePending();
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "The locked photo could not be sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function setConversationBotMode(chatId: string, botEnabled: boolean) {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/conversations/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: botEnabled ? "resume" : "pause" }),
      });
      if (!response.ok) throw new Error("Bot control failed");
      setConversationStatus(botEnabled
        ? "Bot replies are on for this chat."
        : "Bot replies are paused. You can respond personally.");
      await loadLivePending();
    } catch {
      setConversationStatus("The bot setting could not be changed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function setConversationBlocked(chatId: string, blocked: boolean) {
    const fan = conversations.find((conversation) => conversation.chat_id === chatId);
    const prompt = blocked
      ? `Block ${fan?.telegram_name || "this fan"}? The bot and Inbox will stop replying, but the conversation and sales history will stay visible.`
      : `Unblock ${fan?.telegram_name || "this fan"}? Bot replies will remain paused until you turn them back on.`;
    if (!window.confirm(prompt)) return;
    try {
      setLiveLoading(true);
      setConversationStatus(blocked ? "Blocking fan..." : "Unblocking fan...");
      const response = await fetch("/api/admin/conversations/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, blocked }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Block setting could not be changed");
      setConversations((items) => items.map((item) => item.chat_id === chatId
        ? { ...item, is_blocked: blocked ? 1 : 0, control_mode: "human" }
        : item));
      await loadLivePending();
      setConversationStatus(blocked
        ? "Fan blocked. Automatic and Inbox replies are off, while history remains visible."
        : "Fan unblocked. Turn Bot replies on when you want automation to resume.");
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "The block setting could not be changed.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function resetLiveConversation(chatId: string) {
    if (!window.confirm("Reset this chat? This clears its current bot context and unfinished conversation flows. Age verification, fan details, sales, and completed orders stay saved.")) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Resetting conversation...");
      const response = await fetch("/api/admin/conversations/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      if (!response.ok) throw new Error("Conversation reset failed");
      setConversationMessages([]);
      setConversationStatus("Conversation reset. The next fan message will start a fresh chat.");
      await loadLivePending();
    } catch {
      setConversationStatus("The conversation could not be reset. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function confirmConversationAge(chatId: string) {
    if (!window.confirm("Confirm that this fan has stated they are 18 or older? This applies only to this fan and is recorded.")) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Confirming age...");
      const response = await fetch("/api/admin/conversations/confirm-age", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, confirmed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Age confirmation failed");
      setConversations((items) => items.map((item) => item.chat_id === chatId
        ? { ...item, age_status: "verified" }
        : item));
      setConversationStatus("18+ confirmation saved. The bot can continue when this fan sends their next message.");
      await loadLivePending();
    } catch (error) {
      setConversationStatus(error instanceof Error ? error.message : "Age confirmation could not be saved.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function exitLiveConversationFlow(chatId: string) {
    if (!window.confirm("Exit the current flow? This stops unfinished booking, custom, sexting, rating, shipping, and catalog steps. Message history, fan details, sales, and completed orders stay saved.")) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Exiting current flow...");
      const response = await fetch("/api/admin/conversations/exit-flow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      if (!response.ok) throw new Error("Conversation flow exit failed");
      setConversationStatus("Current flow exited. The next fan message will return to normal chat.");
      await loadLivePending();
    } catch {
      setConversationStatus("The current flow could not be exited. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function clearAllTestChats() {
    if (!window.confirm("Clear every Tiffani fan chat and start testing from the age check again? This removes chat history, fan names, voice memos, and unfinished chat flows. Catalog content, uploads, completed orders, earnings, and creator settings stay saved.")) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Clearing test chats...");
      const response = await fetch("/api/admin/conversations/clear-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "CLEAR ALL TEST CHATS" }),
      });
      if (!response.ok) throw new Error("Test chat cleanup failed");
      setConversations([]);
      setSelectedConversationId("");
      setConversationMessages([]);
      setConversationStatus("All test chats were cleared. The next message starts at the age check.");
      await loadLivePending();
    } catch {
      setConversationStatus("The test chats could not be cleared. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function resolvePurchaseById(id: number, action: "approve" | "decline" | "close_unpaid") {
    const current = livePurchases.find((purchase) => purchase.id === id);
    if (!current) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action }),
      });
      if (!response.ok) throw new Error("Purchase update failed");
      await loadLivePending();
    } catch {
      setLiveError("The purchase update was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function resolvePurchase(action: "approve" | "decline" | "close_unpaid") {
    const current = livePurchases[0];
    if (!current) return;
    await resolvePurchaseById(current.id, action);
  }

  async function resolveBooking(action: "approve" | "decline" | "ignore" | "close_unpaid") {
    const current = liveBookings[0];
    if (!current) return;
    const answer = creatorReply.trim();
    if (action === "decline" && !answer) return;
    if (action === "approve" && !bookingDuration.trim()) return;
    if (action === "approve" && bookingType === "custom_content" && !bookingAmount.trim()) return;
    const immediateVideoChat = bookingType === "video_chat" && /\b(?:right now|video (?:chat|call) now|immediately|asap|rn)\b/i.test(current.details);
    if (action === "approve" && bookingType === "video_chat" && !bookingScheduledAt && !immediateVideoChat) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action, answer, service_type: bookingType,
          duration: bookingDuration, amount: bookingAmount,
          scheduled_at: bookingScheduledAt ? new Date(bookingScheduledAt).toISOString() : undefined }),
      });
      if (!response.ok) throw new Error("Booking update failed");
      setCreatorReply("");
      setBookingDuration("");
      setBookingAmount("");
      setBookingScheduledAt("");
      await loadLivePending();
    } catch {
      setLiveError("The booking update was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function resolveVideoChat(id: number, action: "approve_payment" | "payment_not_verified" | "complete" | "cancel" | "close_unpaid") {
    if (action === "complete" && !window.confirm("Confirm this video chat is finished? It will move to history and normal bot replies will resume.")) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/video-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Video chat update failed");
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The video chat update was not sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function completeCustom(id: number) {
    const deliveryUrl = customLinks[id]?.trim();
    if (!deliveryUrl) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "complete", delivery_url: deliveryUrl, comment: customComments[id]?.trim() || "" }),
      });
      if (!response.ok) throw new Error("Custom delivery failed");
      setCustomLinks((current) => ({ ...current, [id]: "" }));
      setCustomComments((current) => ({ ...current, [id]: "" }));
      await loadLivePending();
    } catch {
      setLiveError("The custom link was not sent. Check the link and try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function cancelCustom(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "cancel", comment: customComments[id]?.trim() || "" }),
      });
      if (!response.ok) throw new Error("Custom cancellation failed");
      await loadLivePending();
    } catch {
      setLiveError("The custom could not be cancelled. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function closeCustomUnpaid(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "close_unpaid" }),
      });
      if (!response.ok) throw new Error("Custom follow up failed");
      await loadLivePending();
    } catch {
      setLiveError("The unpaid custom could not be closed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function reviewCustomPayment(id: number, approved: boolean) {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: approved ? "approve_payment" : "payment_not_verified" }),
      });
      if (!response.ok) throw new Error("Custom payment review failed");
      await loadLivePending();
    } catch {
      setLiveError("The custom payment update was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function completeRatingOrder(id: number) {
    const file = ratingResponseFiles[id];
    if (!file) return;
    try {
      setLiveLoading(true);
      setConversationStatus("Sending the private rating video...");
      const form = new FormData();
      form.set("id", String(id));
      form.set("file", file);
      const response = await fetch("/api/admin/rating", { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Rating video could not be sent");
      setRatingResponseFiles((current) => ({ ...current, [id]: null }));
      setConversationStatus("Private rating video sent and the order is complete.");
      await loadLivePending();
      if (selectedConversation) await openConversation(selectedConversation.chat_id);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The rating video could not be sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function updateSextingSession(id: number, action: "start" | "complete" | "takeover" | "resume") {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/sexting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!response.ok) throw new Error("Session update failed");
      await loadLivePending();
    } catch {
      setLiveError("The sexting session could not be updated. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function uploadSextingMedia(event: FormEvent) {
    event.preventDefault();
    if (!mediaFiles.length) return;
    try {
      setLiveLoading(true);
      setLiveError("");
      setMediaUploadStatus(`Uploading 0 of ${mediaFiles.length}...`);
      for (let index = 0; index < mediaFiles.length; index += 1) {
        const file = mediaFiles[index];
        const form = new FormData();
        const baseLabel = mediaLabel.trim() || file.name.replace(/\.[^.]+$/, "").replaceAll(/[_-]+/g, " ");
        form.set("label", mediaFiles.length > 1 && mediaLabel.trim()
          ? `${baseLabel} ${index + 1}`
          : baseLabel);
        form.set("file", file);
        const response = await fetch("/api/admin/sexting-media", { method: "POST", body: form });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(`${file.name}: ${result.error || "upload failed"}`);
        setMediaUploadStatus(`Uploaded ${index + 1} of ${mediaFiles.length}`);
      }
      setMediaLabel("");
      setMediaFiles([]);
      setMediaUploadKey((current) => current + 1);
      setMediaUploadStatus(`${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"} uploaded successfully.`);
      await loadLivePending();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "upload failed";
      setMediaUploadStatus("");
      setLiveError(`The photo or video could not be uploaded. ${detail}`);
    } finally {
      setLiveLoading(false);
    }
  }

  async function deleteSextingMedia(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/sexting-media/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await loadLivePending();
    } catch {
      setLiveError("The media could not be removed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function addSextingScript(event: FormEvent) {
    event.preventDefault();
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/sexting-scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scriptForm),
      });
      if (!response.ok) throw new Error("Script could not be added");
      setScriptForm({ stage: "warmup", title: "", script_text: "", media_label: "" });
      await loadLivePending();
    } catch {
      setLiveError("The sexting script could not be added. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function updateSextingScript(id: number, action: "toggle" | "remove", active = true) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/sexting-scripts/${id}`, action === "remove" ? {
        method: "DELETE",
      } : {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!response.ok) throw new Error("Script update failed");
      await loadLivePending();
    } catch {
      setLiveError("The sexting script could not be changed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function addContentProduct(event: FormEvent) {
    event.preventDefault();
    try {
      setLiveLoading(true);
      setLiveError("");
      const digitalProduct = !["physical_item", "video_rating"].includes(productForm.content_type);
      const existingMediaCount = editingProductId
        ? contentProducts.find((product) => product.id === editingProductId)?.media_count || 0
        : 0;
      if (digitalProduct && !productForm.delivery_url.trim() && !productFiles.length && !existingMediaCount) {
        throw new Error("Add a Dropbox delivery link or choose at least one file to upload");
      }
      const submittedTags = productTags(`${productForm.genre},${productTagDraft}`).join(", ");
      const response = await fetch(editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...productForm, genre: submittedTags }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Product could not be added");
      }
      const saved = await response.json() as { id?: number };
      const productId = editingProductId || saved.id;
      if (productFiles.length && productId) {
        const files = new FormData();
        productFiles.forEach((file) => files.append("files", file));
        const upload = await fetch(`/api/admin/products/${productId}/media`, { method: "POST", body: files });
        if (!upload.ok) {
          const data = await upload.json() as { error?: string };
          throw new Error(data.error || "The product was saved, but its files could not be uploaded");
        }
      }
      setProductForm({ content_type: "video", title: "", price: "", stars_price: "", genre: "", actors: "", trailer_url: "", delivery_url: "" });
      setProductTagDraft("");
      setEditingProductId(null);
      setProductFiles([]);
      setProductUploadKey((current) => current + 1);
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The content could not be added. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  function editContentProduct(product: ContentProduct) {
    setEditingProductId(product.id);
    setProductFiles([]);
    setProductUploadKey((current) => current + 1);
    setProductTagDraft("");
    setProductForm({
      content_type: product.content_type,
      title: product.title,
      price: (product.price_cents / 100).toFixed(2),
      stars_price: product.stars_price ? String(product.stars_price) : "",
      genre: product.genre || "",
      actors: product.actors || "",
      trailer_url: product.trailer_url || "",
      delivery_url: product.delivery_url || "",
    });
  }

  function cancelContentEdit() {
    setEditingProductId(null);
    setProductForm({ content_type: "video", title: "", price: "", stars_price: "", genre: "", actors: "", trailer_url: "", delivery_url: "" });
    setProductTagDraft("");
    setProductFiles([]);
    setProductUploadKey((current) => current + 1);
  }

  function addProductTag() {
    const tags = productTags(`${productForm.genre},${productTagDraft}`);
    setProductForm((current) => ({ ...current, genre: tags.join(", ") }));
    setProductTagDraft("");
  }

  function removeProductTag(index: number) {
    setProductForm((current) => ({
      ...current,
      genre: productTags(current.genre).filter((_, tagIndex) => tagIndex !== index).join(", "),
    }));
  }

  async function updateContentProduct(id: number, action: "toggle" | "remove", active = true) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/products/${id}`, action === "remove" ? {
        method: "DELETE",
      } : {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!response.ok) throw new Error("Product update failed");
      await loadLivePending();
    } catch {
      setLiveError("The content could not be changed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  function changeSetting<K extends keyof CreatorSettings>(key: K, value: CreatorSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    settingsDirtyRef.current = true;
    setSettingsDirty(true);
    setSettingsSaveStatus("Unsaved changes");
  }

  async function saveCreatorSettings() {
    try {
      setLiveLoading(true);
      setSettingsSaveStatus("Saving changes...");
      const entries = Object.entries(settings).filter(([key]) => !["human_takeover", "custom_content_rate"].includes(key));
      const responses = await Promise.all(entries.map(([key, value]) => fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      })));
      if (responses.some((response) => !response.ok)) throw new Error("Setting update failed");
      settingsDirtyRef.current = false;
      setSettingsDirty(false);
      setSettingsSaveStatus("Changes saved");
      setLiveError("");
    } catch {
      setSettingsSaveStatus("Changes were not saved");
      setLiveError("The creator settings could not be saved. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function addDailyTask(event: FormEvent) {
    event.preventDefault();
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", ...taskForm }),
      });
      if (!response.ok) throw new Error("Task could not be added");
      setTaskForm({ title: "", task_type: "video_chat", scheduled_at: "", fan_name: "", details: "", amount: "" });
      await loadLivePending();
    } catch {
      setLiveError("The task could not be added. Check the date and time and try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function updateDailyTask(id: number, action: "complete" | "reopen" | "remove") {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!response.ok) throw new Error("Task could not be updated");
      await loadLivePending();
    } catch {
      setLiveError("The task could not be updated. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function shipPhysicalOrder(id: number) {
    const trackingNumber = trackingNumbers[id]?.trim();
    if (!trackingNumber) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/physical-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, tracking_number: trackingNumber }),
      });
      if (!response.ok) throw new Error("Order could not be shipped");
      setTrackingNumbers((current) => ({ ...current, [id]: "" }));
      await loadLivePending();
    } catch {
      setLiveError("The tracking number was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function sendAnnouncement() {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(announcementForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Announcement could not be sent");
      }
      setAnnouncementForm({ kind: "live", platform: "Instagram", message: "", stream_url: "", product_id: 0 });
      setAnnouncementPreview(false);
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The announcement could not be sent.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function addSocialLink(event: FormEvent) {
    event.preventDefault();
    try {
      setLiveLoading(true);
      const response = await fetch(editingSocialId ? `/api/admin/social-links/${editingSocialId}` : "/api/admin/social-links", {
        method: editingSocialId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(socialForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Social link could not be added");
      }
      setSocialForm({ platform: "Instagram", label: "", url: "" });
      setEditingSocialId(null);
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The social link could not be added.");
    } finally {
      setLiveLoading(false);
    }
  }

  function editSocialLink(link: SocialLink) {
    setEditingSocialId(link.id);
    setSocialForm({ platform: link.platform, label: link.label, url: link.url });
  }

  function cancelSocialEdit() {
    setEditingSocialId(null);
    setSocialForm({ platform: "Instagram", label: "", url: "" });
  }

  async function deleteSocialLink(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/social-links/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Social link could not be removed");
      if (editingSocialId === id) cancelSocialEdit();
      await loadLivePending();
    } catch {
      setLiveError("The social link could not be removed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function addTrainingSuggestion(event: FormEvent) {
    event.preventDefault();
    try {
      setLiveLoading(true);
      const response = await fetch(editingTrainingId ? `/api/admin/training/${editingTrainingId}` : "/api/admin/training", {
        method: editingTrainingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trainingForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Training suggestion could not be added");
      }
      setTrainingForm((current) => ({ ...current, suggestion: "" }));
      setEditingTrainingId(null);
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The training suggestion could not be added.");
    } finally {
      setLiveLoading(false);
    }
  }

  function editTrainingSuggestion(item: TrainingSuggestion) {
    setEditingTrainingId(item.id);
    setTrainingForm({ category: item.category, suggestion: item.suggestion });
  }

  function cancelTrainingEdit() {
    setEditingTrainingId(null);
    setTrainingForm({ category: "fact", suggestion: "" });
  }

  async function deleteTrainingSuggestion(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/training/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Training suggestion could not be removed");
      if (editingTrainingId === id) cancelTrainingEdit();
      await loadLivePending();
    } catch {
      setLiveError("The training suggestion could not be removed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function submitSaleDispute(event: FormEvent) {
    event.preventDefault();
    if (!disputedSale) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/sale-disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ earnings_event_id: disputedSale.id, ...disputeForm }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Sale report could not be submitted");
      }
      setDisputedSale(null);
      setDisputeForm({ reason: "", proof: "" });
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The sale report could not be submitted.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function submitStarsDispute(event: FormEvent) {
    event.preventDefault();
    if (!disputedStarsSession) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/sale-disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sexting_session_id: disputedStarsSession.id, ...disputeForm }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Stars report could not be submitted");
      }
      setDisputedStarsSession(null);
      setDisputeForm({ reason: "", proof: "" });
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The Stars report could not be submitted.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function reviewSaleDispute(id: number, action: "approve" | "deny") {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/sale-disputes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!response.ok) throw new Error("Dispute decision failed");
      await loadLivePending();
    } catch {
      setLiveError("The dispute decision could not be saved. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  const selectedAgendaTasks = dailyTasks.filter((task) => task.scheduled_at.slice(0, 10) === agendaDate);
  const visibleConversations = conversations.filter((conversation) => {
    const search = conversationSearch.trim().toLowerCase();
    return !search || conversation.telegram_name.toLowerCase().includes(search) ||
      conversation.last_message.toLowerCase().includes(search);
  });
  const selectedConversation = conversations.find((conversation) => conversation.chat_id === selectedConversationId) || null;
  const selectedPurchase = selectedConversation
    ? livePurchases.find((purchase) => purchase.chat_id === selectedConversation.chat_id)
    : undefined;
  const selectedCustom = selectedConversation
    ? liveCustoms.find((custom) => custom.chat_id === selectedConversation.chat_id && custom.status === "awaiting_fulfillment")
    : undefined;
  const selectedRating = selectedConversation
    ? ratingOrders.find((order) => order.chat_id === selectedConversation.chat_id && order.status === "awaiting_response")
    : undefined;
  const selectedVideoChat = selectedConversation
    ? videoChats.find((order) => order.chat_id === selectedConversation.chat_id)
    : undefined;
  const quickReplyProducts = contentProducts.filter((product) => product.active && !["physical_item", "video_rating"].includes(product.content_type));
  const paidPhotoOptions = paidPhotoSource === "sexting"
    ? sextingMedia.filter((media) => media.active && media.media_type === "image")
    : catalogPhotoMedia;
  const selectedPaidPhoto = paidPhotoOptions.find((media) => media.id === paidPhotoMediaId) || paidPhotoOptions[0];
  const selectedPaidPhotoPreview = selectedPaidPhoto
    ? paidPhotoSource === "sexting"
      ? `/api/admin/sexting-media/${selectedPaidPhoto.id}/file`
      : `/api/admin/products/${(selectedPaidPhoto as CatalogPhotoMedia).product_id}/media/${selectedPaidPhoto.id}/file`
    : "";
  const openAgendaCount = selectedAgendaTasks.filter((task) => task.status === "open").length + physicalOrders.length + ratingOrders.length;
  const unscheduledCount = liveBookings.length + liveCustoms.length + videoChats.filter((order) => order.status !== "scheduled").length + livePurchases.length + sextingSessions.length + physicalOrders.length + ratingOrders.length;
  const pendingSaleDisputes = saleDisputes.filter((dispute) => dispute.status === "pending");
  const reviewedSaleDisputes = saleDisputes.filter((dispute) => dispute.status !== "pending").slice(0, 20);

  function resetDemo() {
    setMessages(initialMessages);
    setInput("");
    setVerified(false);
    setBlocked(false);
    setPending([]);
    setActiveTab("chat");
    setCreatorReply("");
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">{(portalUser?.creator_name || "Creator").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{portalUser?.creator_name || "Creator portal"}</strong>
            <span>Creator portal</span>
          </div>
        </div>
        <div className="topActions">
          {portalUser && <span className="accountBadge">{portalUser.role === "owner" ? "Owner" : "Creator"} · {portalUser.email}</span>}
          {portalUser?.role === "owner" && (
            <button
              className="adminInboxButton"
              onClick={() => {
                setDashboardView("inbox");
                window.setTimeout(() => document.getElementById("creator-control-room")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              type="button"
            >
              Inbox
              {livePending.length > 0 && <span>{livePending.length}</span>}
            </button>
          )}
          <span className={`statusPill ${attentionCount ? "needsReply" : ""}`}>
            <i /> {statusText}
          </span>
          <button className="ghostButton" onClick={() => void enableNotifications()}>{notificationsEnabled ? "Alerts on" : "Enable alerts"}</button>
        </div>
      </header>

      {portalUser?.role === "owner" && platformOverview && (
        <section className="ownerOverview">
          <div className="ownerHeading">
            <div>
              <p className="eyebrow">Platform owner</p>
              <h1>Creator overview</h1>
              <p>Review platform activity and securely view each creator’s control room.</p>
            </div>
            <span className="supportMode">Viewing as {portalUser?.creator_name.split(/\s+/)[0] || "creator"}</span>
          </div>
          <div className="ownerMetrics">
            <div><span>Creators</span><strong>{platformOverview.creator_count}</strong><small>{platformOverview.active_creator_count} live</small></div>
            <div><span>Past 7 days</span><strong>{money(earnings.weekly_cents)}</strong><small>All creators</small></div>
            <div><span>All time</span><strong>{money(earnings.all_time_cents)}</strong><small>All creators</small></div>
            <div><span>Needs attention</span><strong>{platformOverview.attention_count}</strong><small>Across the platform</small></div>
          </div>
          <section className="disputeQueue">
            <div className="sectionHeading"><strong>Sale disputes</strong><span>{pendingSaleDisputes.length}</span></div>
            {pendingSaleDisputes.length ? pendingSaleDisputes.map((dispute) => (
              <article key={dispute.id}>
                <div>
                  <span>{dispute.creator_key}</span>
                  <strong>{dispute.description} · {dispute.stars ? `⭐ ${dispute.stars.toLocaleString()}` : money(dispute.amount_cents)}</strong>
                  <p>{dispute.reason}</p>
                  {/^(?:https?:\/\/)/i.test(dispute.proof)
                    ? <a href={dispute.proof} rel="noreferrer" target="_blank">View proof</a>
                    : <small>Proof: {dispute.proof}</small>}
                  <small>Requested by {dispute.requester_email} · {new Date(`${dispute.created_at}Z`).toLocaleString()}</small>
                </div>
                <button className="primaryAction" disabled={liveLoading} onClick={() => void reviewSaleDispute(dispute.id, "approve")}>Approve removal</button>
                <button className="secondaryAction" disabled={liveLoading} onClick={() => void reviewSaleDispute(dispute.id, "deny")}>Deny</button>
              </article>
            )) : <p>No sale disputes waiting for review.</p>}
            {reviewedSaleDisputes.length > 0 && (
              <details>
                <summary>Reviewed disputes ({reviewedSaleDisputes.length})</summary>
                {reviewedSaleDisputes.map((dispute) => (
                  <div className="reviewedDispute" key={dispute.id}>
                    <span>{dispute.status}</span>
                    <b>{dispute.description} · {dispute.stars ? `⭐ ${dispute.stars.toLocaleString()}` : money(dispute.amount_cents)}</b>
                    <small>{dispute.reason} · Reviewed by {dispute.reviewed_by}</small>
                  </div>
                ))}
              </details>
            )}
          </section>
          <div className="creatorSwitcher">
            {platformOverview.creators.map((creator) => (
              <div className="creatorReport" key={creator.key}>
                <div className="creatorReportSummary">
                  <span><b>{creator.name}</b><small>{creator.email || creator.template_name || "Login pending"}</small></span>
                  <span><b>{money(creator.weekly_cents)}</b><small>Past 7 days</small></span>
                  <span><b>{money(creator.all_time_cents)}</b><small>All time</small></span>
                  <span><b>⭐ {creator.all_time_stars.toLocaleString()}</b><small>Telegram Stars</small></span>
                  <em className={creator.status === "live" ? "" : "draft"}>{creator.status === "live" ? "Live" : "Setup pending"}</em>
                </div>
                <div className="dailyReport" role="table" aria-label={`${creator.name} daily earnings`}>
                  {creator.daily_earnings.slice().reverse().map((day) => {
                    const dayKey = `${creator.key}:${day.date}`;
                    const open = ownerDayView === dayKey;
                    const saleCount = day.transaction_count + day.star_transaction_count;
                    return (
                      <div className={open ? "open" : ""} role="row" key={day.date}>
                        <button disabled={!day.transaction_count && !day.star_transaction_count} onClick={() => setOwnerDayView(open ? null : dayKey)} type="button">
                          <span role="cell">{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                          <strong role="cell">{saleCount} {saleCount === 1 ? "sale" : "sales"} · {money(day.amount_cents)} cash · ⭐ {day.stars.toLocaleString()} Stars</strong>
                        </button>
                        {open && (
                          <div className="dailyItems">
                            {day.items.map((item) => (
                              <div key={item.id}>
                                <span><b>{item.description}</b><small>{revenueLabel(item.source_type)} · {new Date(`${item.occurred_at.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
                                <strong>{money(item.amount_cents)}</strong>
                              </div>
                            ))}
                            {day.star_items.map((item) => (
                              <div key={`stars:${item.id}`}>
                                <span><b>{item.package_title}</b><small>{item.package_title === "Video rating" ? "Dick rating" : "Sexting session"} · {new Date(`${item.created_at.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
                                <strong>⭐ {item.stars.toLocaleString()}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="workspace creatorDashboard">
        <aside className="creatorPanel visible" data-dashboard-view={dashboardView} id="creator-control-room">
          <nav className="controlRoomNav" aria-label="Control room sections">
            {(["today", "inbox", "test", "content", "settings", "history"] as const).map((view) => (
              <button className={dashboardView === view ? "active" : ""} key={view} onClick={() => setDashboardView(view)} type="button">
                {view === "today" ? "Today" : view === "inbox" ? "Inbox" : view === "test" ? "Test Chat" : view === "content" ? "Content" : view === "settings" ? "Settings" : "History"}
              </button>
            ))}
          </nav>

          <div className="earningsOverview">
            <button onClick={() => setEarningsView((current) => current === "weekly" ? null : "weekly")}><span>Past 7 days</span><strong>{money(earnings.weekly_cents)}</strong><small>{earnings.weekly_count} approved sales · View history</small></button>
            <button onClick={() => setEarningsView((current) => current === "all" ? null : "all")}><span>All time</span><strong>{money(earnings.all_time_cents)}</strong><small>{earnings.all_time_count} approved sales · View history</small></button>
          </div>
          <section className="revenueBreakdown" aria-label="Confirmed cash revenue by type">
            <div className="sectionHeading">
              <div><strong>Confirmed revenue</strong><small>Each payment is added once when it is confirmed.</small></div>
            </div>
            <div className="revenueBreakdownGrid">
              {(["content", "video_chat", "custom_content", "physical_item", "video_rating"] as const).map((sourceType) => {
                const total = earnings.by_type.find((item) => item.source_type === sourceType);
                return (
                  <article key={sourceType}>
                    <span>{revenueLabel(sourceType)}</span>
                    <strong>{money(total?.total_cents || 0)}</strong>
                    <small>{total?.transaction_count || 0} confirmed</small>
                  </article>
                );
              })}
            </div>
          </section>
          {earningsView && (
            <section className="earningsHistory">
              <div className="sectionHeading">
                <strong>{earningsView === "weekly" ? "Past 7 days sales" : "All sales"}</strong>
                <button aria-label="Close earnings history" onClick={() => setEarningsView(null)}>×</button>
              </div>
              {(earningsView === "weekly"
                ? earnings.history.filter((item) => new Date(`${item.occurred_at}Z`).getTime() >= earningsReferenceTime - 7 * 24 * 60 * 60 * 1000)
                : earnings.history
              ).length ? (earningsView === "weekly"
                ? earnings.history.filter((item) => new Date(`${item.occurred_at}Z`).getTime() >= earningsReferenceTime - 7 * 24 * 60 * 60 * 1000)
                : earnings.history
              ).map((item) => (
                <div className="historyRow" key={item.id}>
                  <span><b>{item.description}</b><small>{revenueLabel(item.source_type)} · {new Date(`${item.occurred_at}Z`).toLocaleString()}</small></span>
                  <div className="historyActions">
                    <strong>{money(item.amount_cents)}</strong>
                    {saleDisputes.some((dispute) => dispute.earnings_event_id === item.id && dispute.status === "pending")
                      ? <small>Report pending</small>
                      : <button type="button" onClick={() => { setDisputedSale(item); setDisputeForm({ reason: "", proof: "" }); }}>Report sale</button>}
                  </div>
                </div>
              )) : <p>No sales in this period.</p>}
              {disputedSale && (
                <form className="disputeForm" onSubmit={submitSaleDispute}>
                  <strong>Report {disputedSale.description}</strong>
                  <label><span>What went wrong?</span><textarea required maxLength={1000} value={disputeForm.reason} onChange={(event) => setDisputeForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain why this sale should be removed." /></label>
                  <label><span>Proof link or details</span><input required maxLength={2000} value={disputeForm.proof} onChange={(event) => setDisputeForm((current) => ({ ...current, proof: event.target.value }))} placeholder="Paste a screenshot link, receipt link, or supporting details." /></label>
                  <button className="primaryAction" disabled={liveLoading}>Submit for owner review</button>
                  <button className="secondaryAction" type="button" onClick={() => setDisputedSale(null)}>Cancel</button>
                </form>
              )}
              <div className="historyTotal"><span>Total</span><strong>{money(earningsView === "weekly" ? earnings.weekly_cents : earnings.all_time_cents)}</strong></div>
            </section>
          )}

          <section className="starsOverview">
            <div className="starsTotal">
              <span>Telegram Stars earned</span>
              <strong>⭐ {starsSummary.total.toLocaleString()}</strong>
              <small>{starsSummary.count} confirmed Star purchases</small>
            </div>
            <div className="starsBreakdown">
              <span><b>⭐ {starsSummary.sexting.toLocaleString()}</b><small>{starsSummary.sexting_count} sexting sessions</small></span>
              <span><b>⭐ {starsSummary.ratings.toLocaleString()}</b><small>{starsSummary.rating_count} dick ratings</small></span>
              <span><b>⭐ {starsSummary.content.toLocaleString()}</b><small>{starsSummary.content_count} content unlocks</small></span>
            </div>
          </section>

          <section className="testChatLab dashboardSection dashboardTest">
            <div className="testChatHeader">
              <div>
                <span className="testChatEyebrow">Private sandbox</span>
                <h3>Test the real conversation flow</h3>
                <p>Uses this creator’s live tone, training, catalog, prices, and workflows. Replies are immediate and never go to Telegram or real earnings.</p>
              </div>
              <div className="testChatResetActions">
                <button disabled={testChatBusy} onClick={() => void resetTestChat(false)} type="button">New verified chat</button>
                <button disabled={testChatBusy} onClick={() => void resetTestChat(true)} type="button">Test age gate</button>
              </div>
            </div>
            <div className="testChatGrid">
              <div className="testChatConversation">
                <div className="testChatMessages" aria-live="polite">
                  {testChatMessages.length ? testChatMessages.map((message) => (
                    <article className={message.role} key={message.id}>
                      <span>{message.role === "user" ? "Test fan" : message.role === "assistant" ? portalUser?.creator_name || "Creator" : "System"}</span>
                      <p>{message.content}</p>
                      <time>{new Date(`${message.created_at.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                    </article>
                  )) : <div className="testChatEmpty"><strong>Start anywhere</strong><p>Try a typo, a short message, a sales question, a custom request, or a workflow cancellation.</p></div>}
                </div>
                <div className="testPromptChips">
                  {["wyd?", "vidoes?", "custom?", "how much is videochat", "I don't want to sext", "can I see the trailer?"].map((prompt) => (
                    <button disabled={testChatBusy} key={prompt} onClick={() => setTestChatInput(prompt)} type="button">{prompt}</button>
                  ))}
                </div>
                <form className="testChatComposer" onSubmit={sendTestChatMessage}>
                  <textarea maxLength={2000} onChange={(event) => setTestChatInput(event.target.value)} placeholder="Message as a test fan..." value={testChatInput} />
                  <button disabled={testChatBusy || !testChatInput.trim()}>{testChatBusy ? "Testing..." : "Send instantly"}</button>
                </form>
                {testChatStatus && <p className="testChatStatus">{testChatStatus}</p>}
              </div>
              <aside className="testChatReview">
                <div>
                  <span className="testChatEyebrow">Fix the latest reply</span>
                  <h4>What should it have said?</h4>
                  <p>Teach a replacement to this creator immediately, or flag the reply so the shared conversation flow can be improved in code.</p>
                </div>
                <textarea maxLength={4000} onChange={(event) => setTestChatCorrection(event.target.value)} placeholder="Write the better response here..." value={testChatCorrection} />
                <button className="primaryAction" disabled={testChatBusy} onClick={() => void reviewTestReply("learn")} type="button">Teach this answer</button>
                <button className="secondaryAction" disabled={testChatBusy} onClick={() => void reviewTestReply("flag")} type="button">Flag this reply</button>
                <div className="testFeedbackHistory">
                  <strong>Recent fixes</strong>
                  {testChatFeedback.slice(0, 5).map((item) => <article key={item.id}>
                    <span>{item.action === "learn" ? "Learned" : "Flagged"}</span>
                    <p>{item.user_message}</p>
                    {item.correction && <small>Better reply: {item.correction}</small>}
                  </article>)}
                  {!testChatFeedback.length && <small>No test corrections saved yet.</small>}
                </div>
              </aside>
            </div>
          </section>

          <section className="conversationInbox dashboardSection dashboardInbox">
            {newChatters.length > 0 && <section className="newChattersQueue">
              <div className="newChattersHeading">
                <div><strong>New chatters</strong><small>Confirm or correct each name before the bot continues.</small></div>
                <span>{newChatters.length} waiting</span>
              </div>
              <div className="newChatterList">
                {newChatters.map((chatter) => <article key={chatter.chat_id}>
                  <div className="newChatterIdentity">
                    <span className="conversationAvatar">{chatter.telegram_name.replace(/^@/, "").slice(0, 1).toUpperCase()}</span>
                    <div><strong>{chatter.telegram_name}</strong><small>They wrote: “{chatter.last_message}”</small><time>{new Date(`${chatter.submitted_at.replace(" ", "T")}Z`).toLocaleString()}</time></div>
                  </div>
                  <label><span>Fan name</span><input aria-label={`Name for ${chatter.telegram_name}`} maxLength={60} onChange={(event) => setNewChatterNames((current) => ({ ...current, [chatter.chat_id]: event.target.value }))} value={newChatterNames[chatter.chat_id] ?? chatter.proposed_name} /></label>
                  <button className="primaryAction" disabled={liveLoading || !(newChatterNames[chatter.chat_id] ?? chatter.proposed_name).trim()} onClick={() => void confirmNewChatterName(chatter.chat_id)} type="button">Confirm name and start bot</button>
                </article>)}
              </div>
            </section>}
            <div className="sectionHeading">
              <div><strong>Current chats</strong><small>{conversations.length} conversations</small></div>
              <div className="conversationInboxActions">
                <span>{conversations.reduce((total, conversation) => total + Number(conversation.pending_count || 0), 0)} need attention</span>
                {portalUser?.role === "owner" && <button className="clearAllConversations" disabled={liveLoading || (conversations.length === 0 && newChatters.length === 0)} onClick={() => void clearAllTestChats()} type="button">Clear all test chats</button>}
              </div>
            </div>
            <label className="conversationSearch">
              <span>Search chats</span>
              <input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search by name or recent message" />
            </label>
            <div className="conversationWorkspace">
              <div className="conversationList">
                {visibleConversations.length ? visibleConversations.map((conversation) => (
                  <button className={selectedConversationId === conversation.chat_id ? "selected" : ""} key={conversation.chat_id} onClick={() => void openConversation(conversation.chat_id)} type="button">
                    <span className="conversationAvatar">{conversation.telegram_name.replace(/^@/, "").slice(0, 1).toUpperCase()}</span>
                    <span className="conversationSummary">
                      <strong>{conversation.telegram_name}</strong>
                      <small>{conversation.last_message || "No saved messages"}</small>
                      <time>{new Date(`${conversation.last_message_at.replace(" ", "T")}Z`).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                    </span>
                    <span className={`workflowBadge ${conversation.is_blocked ? "blocked" : conversation.active_workflow.replace(" ", "-")}`}>{conversation.is_blocked ? "blocked" : conversation.active_workflow}</span>
                    {Number(conversation.pending_count) > 0 && <b className="unreadBadge">{conversation.pending_count}</b>}
                  </button>
                )) : <p>No chats match that search.</p>}
              </div>
              <div className={`conversationDetail ${selectedConversation?.is_blocked ? "blockedFanConversation" : ""}`}>
                {selectedConversation ? <>
                  <header>
                    <div><strong>{selectedConversation.telegram_name}</strong><small>{selectedConversation.message_count} saved messages · {selectedConversation.is_blocked ? "Blocked" : selectedConversation.control_mode === "human" ? "Creator replying" : "Bot active"}</small></div>
                    <div className="conversationHeaderActions">
                      {selectedConversation.age_status === "verified"
                        ? <span className="ageStatusBadge verified">18+ confirmed</span>
                        : selectedConversation.age_status === "blocked"
                          ? <span className="ageStatusBadge blocked">Age declined</span>
                          : <button className="confirmAgeOverride" disabled={liveLoading} onClick={() => void confirmConversationAge(selectedConversation.chat_id)} type="button">Confirm fan is 18+</button>}
                      <label className="botReplySwitch">
                        <span>Bot replies</span>
                        <input aria-label="Bot replies" checked={!selectedConversation.is_blocked && selectedConversation.control_mode === "bot"} disabled={liveLoading || Boolean(selectedConversation.is_blocked)} onChange={(event) => void setConversationBotMode(selectedConversation.chat_id, event.target.checked)} type="checkbox" />
                        <i aria-hidden="true" />
                      </label>
                      <button className="exitConversationFlow" disabled={liveLoading} onClick={() => void exitLiveConversationFlow(selectedConversation.chat_id)} type="button">Exit flow</button>
                      <button className="resetConversation" disabled={liveLoading} onClick={() => void resetLiveConversation(selectedConversation.chat_id)} type="button">Reset chat</button>
                      <button className={`blockConversation ${selectedConversation.is_blocked ? "unblock" : ""}`} disabled={liveLoading} onClick={() => void setConversationBlocked(selectedConversation.chat_id, !Boolean(selectedConversation.is_blocked))} type="button">{selectedConversation.is_blocked ? "Unblock fan" : "Block fan"}</button>
                    </div>
                  </header>
                  <div className="conversationTranscript">
                    {conversationMessages.length ? conversationMessages.map((message) => (
                      <article className={message.role} key={message.id}>
                        <div className="conversationMessageHeader">
                          <span>{message.role === "user" ? selectedConversation.telegram_name : (portalUser?.creator_name.split(/\s+/)[0] || "Creator")}</span>
                          <button aria-label={`Delete message from ${message.role === "user" ? selectedConversation.telegram_name : "creator"}`} disabled={liveLoading} onClick={() => void deleteConversationMessage(message)} type="button">Delete</button>
                        </div>
                        {message.voice_note_id && <audio controls preload="none" src={`/api/admin/conversations/voice/${message.voice_note_id}`} />}
                        <p>{message.content}</p>
                        {message.voice_status === "creator_review" && <small className="voiceReviewFlag">Voice memo awaiting your reply</small>}
                        <time>{new Date(`${message.created_at.replace(" ", "T")}Z`).toLocaleString()}</time>
                      </article>
                    )) : <p className="conversationPlaceholder">{conversationStatus || "No saved messages in this conversation."}</p>}
                  </div>
                  {conversationStatus && conversationMessages.length > 0 && <p className="conversationNotice">{conversationStatus}</p>}
                  {selectedConversation.is_blocked ? <div className="blockedFanNotice"><strong>This fan is blocked</strong><p>The bot and Inbox cannot send messages or content to this fan. Their conversation, orders, and earnings history remain saved.</p></div> : null}
                  <div className="paidFulfillmentPanel">
                    <div className="quickReplyHeading"><strong>Paid order fulfillment</strong><small>These controls stay visible. Each one unlocks when this chat has the matching order.</small></div>
                    <div className="fulfillmentActionBar">
                      <button className="primaryAction" disabled={liveLoading || !selectedPurchase} onClick={() => selectedPurchase && void resolvePurchaseById(selectedPurchase.id, "approve")} type="button">Confirm content payment</button>
                      <button className="secondaryAction" disabled={liveLoading || selectedVideoChat?.status !== "payment_review"} onClick={() => selectedVideoChat && void resolveVideoChat(selectedVideoChat.id, "approve_payment")} type="button">Confirm video chat payment</button>
                      <button className="secondaryAction" disabled={liveLoading || selectedVideoChat?.status !== "scheduled"} onClick={() => selectedVideoChat && void resolveVideoChat(selectedVideoChat.id, "complete")} type="button">Complete video chat + resume bot</button>
                      <button className="secondaryAction" disabled={!selectedCustom} onClick={() => document.querySelector<HTMLInputElement>(`.paidFulfillmentPanel input[type="url"]`)?.focus()} type="button">Send completed custom</button>
                      <button className="secondaryAction" disabled={!selectedRating} onClick={() => document.querySelector<HTMLInputElement>(`.paidFulfillmentPanel input[type="file"]`)?.click()} type="button">Send dick rating video</button>
                    </div>
                    {!selectedPurchase && !selectedCustom && !selectedRating && !selectedVideoChat && <p className="fulfillmentEmpty">No paid order is linked to this chat yet. The correct button will unlock as soon as payment is submitted and the order appears for approval.</p>}
                    {selectedPurchase && <article>
                      <div><strong>{selectedPurchase.product_title}</strong><small>{selectedPurchase.price} · {selectedPurchase.payment_proof_received_at ? "payment screenshot received" : "payment claimed"}</small></div>
                      <button className="primaryAction" disabled={liveLoading} onClick={() => void resolvePurchaseById(selectedPurchase.id, "approve")} type="button">
                        {selectedPurchase.content_type === "video_rating" ? "Confirm payment and request rating photo" : selectedPurchase.content_type === "physical_item" ? "Confirm payment and collect shipping" : "Confirm payment and send video or photos"}
                      </button>
                    </article>}
                    {selectedVideoChat && <article className="videoChatCompletionCard">
                      <div><strong>Video chat with {selectedVideoChat.telegram_name}</strong><small>{videoChatSchedule(selectedVideoChat.scheduled_at)} · {selectedVideoChat.duration_minutes} minutes</small></div>
                      {selectedVideoChat.status === "payment_review" ? <p>The payment screenshot is ready for review. Confirm it to schedule the Telegram call and record the sale.</p> : selectedVideoChat.status === "scheduled" ? <p>Payment is confirmed. After the call, complete it here to move it to history and turn normal bot replies back on.</p> : <p>Waiting for the fan to send payment and a screenshot.</p>}
                    </article>}
                    {selectedCustom && <article>
                      <div><strong>Finished custom for {selectedCustom.telegram_name}</strong><small>{money(selectedCustom.amount_cents)} confirmed</small></div>
                      <input onChange={(event) => setCustomLinks((current) => ({ ...current, [selectedCustom.id]: event.target.value }))} placeholder="Dropbox or delivery link" type="url" value={customLinks[selectedCustom.id] || ""} />
                      <textarea maxLength={1000} onChange={(event) => setCustomComments((current) => ({ ...current, [selectedCustom.id]: event.target.value }))} placeholder="Optional message" value={customComments[selectedCustom.id] || ""} />
                      <button className="primaryAction" disabled={liveLoading || !customLinks[selectedCustom.id]?.trim()} onClick={() => void completeCustom(selectedCustom.id)} type="button">Send finished custom and complete order</button>
                    </article>}
                    {selectedRating && <article>
                      <div><strong>Private video rating for {selectedRating.telegram_name}</strong><small>Photo received · ready for your response clip</small></div>
                      <input accept="video/*" onChange={(event) => setRatingResponseFiles((current) => ({ ...current, [selectedRating.id]: event.target.files?.[0] || null }))} type="file" />
                      <button className="primaryAction" disabled={liveLoading || !ratingResponseFiles[selectedRating.id]} onClick={() => void completeRatingOrder(selectedRating.id)} type="button">Send rating video and complete order</button>
                    </article>}
                  </div>
                  <div className="quickReplies">
                    <div className="quickReplyHeading"><strong>Quick replies</strong><small>Choose one to fill the message, then edit or send it.</small></div>
                    <div className="quickReplyCategories">
                      {(["general", "content", "custom", "bookings", "video_chat", "ratings", "payment", "boundaries"] as QuickReplyCategory[]).map((category) => <button className={quickReplyCategory === category ? "selected" : ""} key={category} onClick={() => setQuickReplyCategory(category)} type="button">{category === "video_chat" ? "Video chat" : category === "ratings" ? "Dick ratings" : category}</button>)}
                    </div>
                    {quickReplyCategory === "content" && <div className="quickReplyProductRow">
                      <label className="quickReplyProduct"><span>Selected content</span><select value={quickReplyProductId || quickReplyProducts[0]?.id || 0} onChange={(event) => setQuickReplyProductId(Number(event.target.value))}>{quickReplyProducts.length ? quickReplyProducts.map((product) => <option key={product.id} value={product.id}>{product.title}</option>) : <option value={0}>No active content</option>}</select></label>
                      <button className="quickSendContent" disabled={!quickReplyProducts.length} onClick={() => void sendQuickProduct("send_product")} type="button">Send selected content</button>
                    </div>}
                    {quickReplyCategory === "content" && <div className="paidPhotoUnlockPanel">
                      <div className="paidPhotoUnlockHeading">
                        <div><strong>Single photo unlock</strong><small>Choose one photo and send it locked behind Telegram Stars.</small></div>
                        {selectedPaidPhotoPreview && <img alt="Selected photo preview" src={selectedPaidPhotoPreview} />}
                      </div>
                      <div className="paidPhotoUnlockFields">
                        <label><span>Photo source</span><select value={paidPhotoSource} onChange={(event) => {
                          setPaidPhotoSource(event.target.value as "sexting" | "catalog");
                          setPaidPhotoMediaId(0);
                        }}><option value="sexting">Sexting photos</option><option value="catalog">Content library</option></select></label>
                        <label><span>Photo</span><select value={selectedPaidPhoto?.id || 0} onChange={(event) => setPaidPhotoMediaId(Number(event.target.value))}>{paidPhotoOptions.length ? paidPhotoOptions.map((media) => <option key={media.id} value={media.id}>{paidPhotoSource === "sexting" ? ((media as SextingMedia).label || media.file_name) : `${(media as CatalogPhotoMedia).product_title} · ${media.file_name}`}</option>) : <option value={0}>No uploaded photos</option>}</select></label>
                        <label><span>Stars price</span><input inputMode="numeric" min={1} max={25000} onChange={(event) => setPaidPhotoStars(event.target.value)} placeholder="500" type="number" value={paidPhotoStars} /></label>
                        <label><span>Unlock title</span><input maxLength={120} onChange={(event) => setPaidPhotoTitle(event.target.value)} placeholder="Private photo" type="text" value={paidPhotoTitle} /></label>
                      </div>
                      <button className="paidPhotoUnlockButton" disabled={liveLoading || !selectedPaidPhoto || !Number.isInteger(Number(paidPhotoStars)) || Number(paidPhotoStars) < 1} onClick={() => void sendPaidPhotoUnlock()} type="button">Send locked photo</button>
                    </div>}
                    <div className="quickReplyOptions">
                      {quickReplyCategory === "general" && <><button onClick={() => fillQuickReply("saw_message")} type="button">Saw your message</button><button onClick={() => fillQuickReply("busy")} type="button">Busy right now</button><button onClick={() => fillQuickReply("anything_else")} type="button">Anything else</button></>}
                      {quickReplyCategory === "content" && <><button onClick={() => fillQuickReply("catalog")} type="button">Show catalog</button><button onClick={() => fillQuickReply("trailer")} type="button">Preview trailer reply</button><button onClick={() => fillQuickReply("product_details")} type="button">Send details</button><button onClick={() => fillQuickReply("product_payment")} type="button">Payment instructions</button><button onClick={() => fillQuickReply("product_delivery")} type="button">Preview delivery reply</button></>}
                      {quickReplyCategory === "custom" && <><button onClick={() => fillQuickReply("custom_start")} type="button">Ask for idea</button><button onClick={() => fillQuickReply("custom_more")} type="button">Anything else</button><button onClick={() => fillQuickReply("custom_review")} type="button">Review request</button><button onClick={() => fillQuickReply("custom_quote")} type="button">Need details first</button><button className="quickSendContent" disabled={!selectedCustom} onClick={() => document.querySelector<HTMLInputElement>(`.paidFulfillmentPanel input[type="url"]`)?.focus()} title={selectedCustom ? "Add the delivery link above" : "Available after a custom payment is confirmed"} type="button">Send finished custom</button></>}
                      {quickReplyCategory === "bookings" && <><button onClick={() => fillQuickReply("booking_options")} type="button">Booking options</button><button onClick={() => fillQuickReply("booking_schedule")} type="button">Date and time</button><button onClick={() => fillQuickReply("booking_contact")} type="button">City and contact</button></>}
                      {quickReplyCategory === "video_chat" && <><button onClick={() => fillQuickReply("video_chat_now")} type="button">Available right now</button><button onClick={() => fillQuickReply("video_chat_not_now")} type="button">Not available now</button><button onClick={() => fillQuickReply("video_chat")} type="button">Rate and minimum</button><button onClick={() => fillQuickReply("video_chat_schedule")} type="button">Ask for schedule</button><button onClick={() => fillQuickReply("video_chat_payment")} type="button">Payment methods</button><button onClick={() => fillQuickReply("video_chat_confirm")} type="button">Confirm Telegram call</button></>}
                      {quickReplyCategory === "ratings" && <><button onClick={() => fillQuickReply("rating_offer")} type="button">Offer video rating</button><button onClick={() => fillQuickReply("rating_photo")} type="button">Request photo</button><button onClick={() => fillQuickReply("rating_payment")} type="button">Rating payment</button><button className="quickSendContent" disabled={!selectedRating} onClick={() => document.querySelector<HTMLInputElement>(`.paidFulfillmentPanel input[type="file"]`)?.click()} title={selectedRating ? "Choose the response video above" : "Available after payment and the rating photo are confirmed"} type="button">Upload and send rating video</button></>}
                      {quickReplyCategory === "payment" && <><button onClick={() => fillQuickReply("payment_options")} type="button">Payment options</button><button onClick={() => fillQuickReply("payment_screenshot")} type="button">Request screenshot</button><button onClick={() => fillQuickReply("payment_received")} type="button">Payment received</button><button className="quickSendContent" disabled={!selectedPurchase} onClick={() => selectedPurchase && void resolvePurchaseById(selectedPurchase.id, "approve")} title={selectedPurchase ? "Confirm and fulfill this paid order" : "Available when this chat has a payment awaiting confirmation"} type="button">Confirm payment and send content</button></>}
                      {quickReplyCategory === "boundaries" && <><button onClick={() => fillQuickReply("telegram_tos")} type="button">Telegram TOS</button><button onClick={() => fillQuickReply("unavailable")} type="button">Cannot help</button></>}
                    </div>
                    {quickReplyWorkflow && <p className="workflowNotice">Sending this keeps Bot replies on and starts the {quickReplyWorkflow === "start_custom" ? "custom detail" : quickReplyWorkflow === "start_video_chat" ? "video chat scheduling" : "booking detail"} flow.</p>}
                  </div>
                  <form className="conversationReplyForm" onSubmit={sendConversationReply}>
                    <textarea maxLength={4000} value={conversationReply} onChange={(event) => setConversationReply(event.target.value)} placeholder={`Reply to ${selectedConversation.telegram_name}`} />
                    <div className="conversationReplyActions">
                      <button className="primaryAction" disabled={liveLoading || !conversationReply.trim()}>Send once</button>
                      <button className="secondaryAction" disabled={liveLoading || !conversationReply.trim()} onClick={() => void submitConversationReply(true)} type="button">Send and save for future</button>
                      {Number(selectedConversation.pending_count) > 0 && <button className="ignoreAction clearRequestAction" disabled={liveLoading} onClick={() => void dismissConversationRequest()} type="button">Clear request without replying</button>}
                    </div>
                    <small>{quickReplyWorkflow ? "This workflow reply keeps the bot active so it can collect the remaining order details." : "Sending a reply pauses automatic responses for this chat until you turn Bot replies back on."}</small>
                  </form>
                </> : <div className="conversationPlaceholder">Choose a chat to view its recent messages and controls.</div>}
              </div>
            </div>
          </section>

          <section className="announcementCenter dashboardSection dashboardToday">
            <div className="sectionHeading"><strong>Announcements</strong><span>{announcements.length}</span></div>
            <p className="queueNote">Push a live link, new catalog item, or custom update to every fan chat.</p>
            <div className="announcementForm">
              <label><span>Announcement type</span><select value={announcementForm.kind} onChange={(event) => { setAnnouncementPreview(false); setAnnouncementForm((current) => ({ ...current, kind: event.target.value as typeof current.kind })); }}><option value="live">Going live</option><option value="new_content">New content</option><option value="custom">Custom update</option></select></label>
              {announcementForm.kind === "live" && <><label><span>Platform</span><select value={announcementForm.platform} onChange={(event) => setAnnouncementForm((current) => ({ ...current, platform: event.target.value }))}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Twitch</option><option>X</option><option>Pornhub</option><option>OnlyFans</option><option>Other</option></select></label><label><span>Live stream link</span><input type="url" required placeholder="https://..." value={announcementForm.stream_url} onChange={(event) => setAnnouncementForm((current) => ({ ...current, stream_url: event.target.value }))} /></label></>}
              {announcementForm.kind === "new_content" && <label><span>Catalog item</span><select value={announcementForm.product_id} onChange={(event) => setAnnouncementForm((current) => ({ ...current, product_id: Number(event.target.value) }))}><option value={0}>Choose content</option>{contentProducts.filter((product) => product.active && !["physical_item", "video_rating"].includes(product.content_type)).map((product) => <option key={product.id} value={product.id}>{product.title}{product.stars_price > 0 ? ` · ⭐ ${product.stars_price}` : ""}</option>)}</select></label>}
              {announcementForm.kind === "custom" && <label><span>Optional secure link</span><input type="url" placeholder="https://..." value={announcementForm.stream_url} onChange={(event) => setAnnouncementForm((current) => ({ ...current, stream_url: event.target.value }))} /></label>}
              <label className="announcementMessage"><span>{announcementForm.kind === "custom" ? "Message" : "Optional message"}</span><textarea maxLength={500} placeholder={announcementForm.kind === "live" ? "Come hang out with me live!" : announcementForm.kind === "new_content" ? "I just added something new, babe!" : "Write your announcement"} value={announcementForm.message} onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))} /></label>
              {!announcementPreview ? <button className="primaryAction" type="button" disabled={(announcementForm.kind === "live" && !announcementForm.stream_url.trim()) || (announcementForm.kind === "new_content" && !announcementForm.product_id) || (announcementForm.kind === "custom" && !announcementForm.message.trim())} onClick={() => setAnnouncementPreview(true)}>Review announcement</button> : <div className="announcementPreview"><strong>Preview</strong><p>{announcementForm.kind === "live" ? `I'm live on ${announcementForm.platform} right now, babe!` : announcementForm.kind === "new_content" ? (announcementForm.message || "I just added something new, babe!") : announcementForm.message}</p>{announcementForm.kind === "new_content" && <p>{contentProducts.find((product) => product.id === announcementForm.product_id)?.title}</p>}{announcementForm.kind !== "new_content" && announcementForm.stream_url && <a href={announcementForm.stream_url} rel="noreferrer" target="_blank">{announcementForm.stream_url}</a>}<button className="primaryAction" type="button" disabled={liveLoading} onClick={() => void sendAnnouncement()}>Send to all fan chats</button><button className="secondaryAction" type="button" disabled={liveLoading} onClick={() => setAnnouncementPreview(false)}>Edit</button></div>}
            </div>
            <div className="announcementHistory">
              {announcements.slice(0, 8).map((announcement) => <article key={announcement.id}><div><strong>{announcement.platform}</strong>{announcement.stream_url && <a href={announcement.stream_url} rel="noreferrer" target="_blank">Open link</a>}</div><small>{announcement.status === "sending" ? "Sending now" : `${announcement.delivered_count} delivered${announcement.failed_count ? ` · ${announcement.failed_count} failed` : ""}`} · {new Date(`${announcement.created_at}Z`).toLocaleString()}</small></article>)}
            </div>
          </section>

          <section className="dailyAgenda dashboardSection dashboardToday">
            <div className="sectionHeading"><strong>Daily task list</strong><span>{openAgendaCount}</span></div>
            <div className="agendaControls">
              <label><span>Day</span><input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /></label>
              <small>Pacific time</small>
            </div>
            {unscheduledCount > 0 && (
              <div className="needsScheduling">
                <strong>{unscheduledCount} items need attention</strong>
                <small>{liveBookings.length} booking requests · {liveCustoms.length} customs · {videoChats.filter((order) => order.status !== "scheduled").length} video chats awaiting payment · {livePurchases.length} deliveries · {physicalOrders.length} shipments · {ratingOrders.length} ratings · {sextingSessions.length} sexting sessions</small>
              </div>
            )}
            {physicalOrders.length > 0 && <div className="fulfillmentTasks">
              <strong>Physical orders</strong>
              {physicalOrders.map((order) => <article key={order.id}>
                <div>
                  <span>{order.status.replaceAll("_", " ")}</span>
                  <b>{order.product_title}</b>
                  <small>{money(order.amount_cents)}</small>
                </div>
                {order.status === "awaiting_name" && <p>Waiting for the customer’s shipping name.</p>}
                {order.status === "awaiting_address" && <p>{order.customer_name} · Waiting for their shipping address.</p>}
                {order.status === "awaiting_shipment" && <>
                  <p><b>{order.customer_name}</b><br />{order.shipping_address}</p>
                  <label><span>Tracking number</span><input value={trackingNumbers[order.id] || ""} onChange={(event) => setTrackingNumbers((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Enter tracking number" /></label>
                  <button className="primaryAction" disabled={liveLoading || !trackingNumbers[order.id]?.trim()} onClick={() => void shipPhysicalOrder(order.id)}>Confirm sent and send tracking</button>
                </>}
              </article>)}
            </div>}
            {ratingOrders.length > 0 && <div className="fulfillmentTasks">
              <strong>Video ratings</strong>
              {ratingOrders.map((order) => <article key={order.id}>
                <div><span>{order.status.replaceAll("_", " ")}</span><b>{order.telegram_name}</b><small>⭐ {order.stars} · {money(order.amount_cents)} listed value</small></div>
                <p>{order.status === "awaiting_photo" ? "Waiting for the client to send their photo." : "Payment and photo confirmed. Upload the private response clip here to send it and complete the order."}</p>
                {order.status === "awaiting_response" && <div className="fulfillmentActions">
                  <label className="filePicker">Rating response video
                    <input accept="video/*" onChange={(event) => setRatingResponseFiles((current) => ({ ...current, [order.id]: event.target.files?.[0] ?? null }))} type="file" />
                  </label>
                  <button disabled={!ratingResponseFiles[order.id]} onClick={() => completeRatingOrder(order.id)} type="button">Send rating video and complete order</button>
                </div>}
              </article>)}
            </div>}
            <div className="agendaList">
              {selectedAgendaTasks.length ? selectedAgendaTasks.map((task) => (
                <article className={task.status === "completed" ? "completed" : ""} key={task.id}>
                  <time>{new Date(task.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                  <div>
                    <span>{task.task_type.replaceAll("_", " ")}</span>
                    <strong>{task.title}</strong>
                    {task.fan_name && <small>{task.fan_name}</small>}
                    {task.details && <p>{task.details}</p>}
                  </div>
                  {task.amount_cents > 0 && <b>{money(task.amount_cents)}</b>}
                  <button type="button" onClick={() => void updateDailyTask(task.id, task.status === "open" ? "complete" : "reopen")}>{task.status === "open" ? "Complete" : "Reopen"}</button>
                  <button className="removeTask" type="button" onClick={() => void updateDailyTask(task.id, "remove")}>Remove</button>
                </article>
              )) : <p className="queueNote">Nothing scheduled for this day.</p>}
            </div>
            <form className="taskForm" onSubmit={addDailyTask}>
              <strong>Add a task</strong>
              <label><span>Task</span><input required value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Video chat with Alex" /></label>
              <label><span>Type</span><select value={taskForm.task_type} onChange={(event) => setTaskForm((current) => ({ ...current, task_type: event.target.value as DailyTask["task_type"] }))}><option value="video_chat">Video chat</option><option value="custom">Custom</option><option value="delivery">Content delivery</option><option value="follow_up">Follow up</option><option value="in_person">In person</option><option value="other">Other</option></select></label>
              <label><span>Date and time</span><input required type="datetime-local" value={taskForm.scheduled_at} onChange={(event) => setTaskForm((current) => ({ ...current, scheduled_at: event.target.value }))} /></label>
              <label><span>Fan or client</span><input value={taskForm.fan_name} onChange={(event) => setTaskForm((current) => ({ ...current, fan_name: event.target.value }))} placeholder="@username" /></label>
              <label><span>Amount</span><input inputMode="decimal" min="0" step="0.01" type="number" value={taskForm.amount} onChange={(event) => setTaskForm((current) => ({ ...current, amount: event.target.value }))} placeholder="250.00" /></label>
              <label className="taskDetails"><span>Breakdown and notes</span><textarea value={taskForm.details} onChange={(event) => setTaskForm((current) => ({ ...current, details: event.target.value }))} placeholder="What needs to happen, links, preparation, and follow up details" /></label>
              <button className="primaryAction" disabled={liveLoading}>Add to task list</button>
            </form>
          </section>

          <section className="sextingQueue dashboardSection dashboardToday">
            <div className="sectionHeading"><strong>Sexting sessions</strong><span>{sextingSessions.length}</span></div>
            {sextingSessions.length ? sextingSessions.map((session) => (
              <div className="sessionCard" key={session.id}>
                <div className="customMeta"><strong>{session.telegram_name}</strong><span>⭐ {session.stars.toLocaleString()}</span></div>
                <p>{session.package_title}</p>
                <small>{session.status === "paid" ? "Paid and waiting to start" : `${session.control_mode === "human" ? "Creator responding personally" : "Bot responding"} until ${session.ends_at ? new Date(`${session.ends_at}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "complete"}`}</small>
                <button className="primaryAction" disabled={liveLoading} onClick={() => void updateSextingSession(session.id, session.status === "paid" ? "start" : "complete")}>
                  {session.status === "paid" ? "Start session" : "Complete session"}
                </button>
                {session.status === "active" && <button className="sessionControl" disabled={liveLoading} onClick={() => void updateSextingSession(session.id, session.control_mode === "human" ? "resume" : "takeover")}>
                  {session.control_mode === "human" ? "Return replies to bot" : "Take over in Telegram"}
                </button>}
              </div>
            )) : <p className="queueNote">No paid sexting sessions waiting.</p>}
          </section>

          <section className="creatorOnboarding dashboardSection dashboardContent">
            <div className="onboardingHeading">
              <div><span>Creator onboarding</span><strong>Media readiness</strong></div>
              <b>{onboardingProgress}%</b>
            </div>
            <div className="onboardingProgress"><i style={{ width: `${onboardingProgress}%` }} /></div>
            <div className="onboardingChecklist">
              <article className={onboardingPhotoCount >= 20 ? "complete" : ""}>
                <span>{onboardingPhotoCount >= 20 ? "✓" : onboardingPhotoCount}</span>
                <div><strong>20 sexting photos</strong><p>Include selfies, close ups, lingerie, implied nude, nude, and other approved intimate photos with a useful label for each image.</p><small>{onboardingPhotoCount} of 20 uploaded</small></div>
              </article>
              <article className={onboardingClipCount >= 5 ? "complete" : ""}>
                <span>{onboardingClipCount >= 5 ? "✓" : onboardingClipCount}</span>
                <div><strong>5 to 10 short clips</strong><p>Upload approved two to three second tease clips that can be used naturally during a paid sexting session.</p><small>{onboardingClipCount} uploaded · minimum 5</small></div>
              </article>
              <article className={contentProducts.length > 0 ? "complete" : ""}>
                <span>{contentProducts.length > 0 ? "✓" : contentProducts.length}</span>
                <div><strong>Sale catalog</strong><p>Add every photo set, video, or bundle being offered, including its title, price, searchable tags, actors, preview link, and private Dropbox delivery link.</p><small>{contentProducts.length} product{contentProducts.length === 1 ? "" : "s"} added</small></div>
              </article>
            </div>
            <p className="onboardingConsent">Only upload media the creator owns or is authorized to use. Every depicted participant must be an adult and have consented to the content and its distribution.</p>
          </section>

          <section className="mediaLibrary dashboardSection dashboardContent">
            <div className="sectionHeading"><strong>Sexting media library</strong><span>{sextingMedia.length}</span></div>
            <p className="queueNote">Returning fans receive media they have not seen first. Keep adding new photos and clips regularly so repeat sessions stay fresh.</p>
            <form onSubmit={uploadSextingMedia}>
              <label><span>Optional label</span><input onChange={(event) => setMediaLabel(event.target.value)} placeholder="Lingerie tease" value={mediaLabel} /></label>
              <label><span>Upload approved photos or videos</span><input key={mediaUploadKey} accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm" multiple onChange={(event) => setMediaFiles(Array.from(event.target.files || []))} type="file" /></label>
              {mediaFiles.length > 0 && <small>{mediaFiles.length} file{mediaFiles.length === 1 ? "" : "s"} selected</small>}
              {mediaUploadStatus && <small>{mediaUploadStatus}</small>}
              <button className="primaryAction" disabled={liveLoading || !mediaFiles.length}>{liveLoading ? "Uploading..." : "Upload media"}</button>
            </form>
            <div className="mediaGrid">
              {sextingMedia.map((media) => (
                <article key={media.id}>
                  {media.media_type === "image"
                    ? <img alt={media.label} src={`/api/admin/sexting-media/${media.id}/file`} />
                    : <video controls preload="metadata" src={`/api/admin/sexting-media/${media.id}/file`} />}
                  <strong>{media.label}</strong>
                  <small>{media.file_name}</small>
                  <button disabled={liveLoading} onClick={() => void deleteSextingMedia(media.id)} type="button">Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="scriptLibrary dashboardSection dashboardContent">
            <div className="sectionHeading"><strong>Sexting scripts</strong><span>{sextingScripts.length}</span></div>
            <p className="queueNote">Active scripts guide the bot only during an approved session. It adapts them to the conversation instead of repeating them word for word.</p>
            <form onSubmit={addSextingScript}>
              <label><span>Conversation stage</span><select value={scriptForm.stage} onChange={(event) => setScriptForm((current) => ({ ...current, stage: event.target.value as SextingScript["stage"] }))}><option value="warmup">Warm up</option><option value="transition">Transition</option><option value="fantasy">Fantasy</option><option value="climax">Final minutes</option><option value="closing">Closing</option></select></label>
              <label><span>Script title</span><input required value={scriptForm.title} onChange={(event) => setScriptForm((current) => ({ ...current, title: event.target.value }))} placeholder="Playful transition" /></label>
              <label><span>Instructions or approved lines</span><textarea required value={scriptForm.script_text} onChange={(event) => setScriptForm((current) => ({ ...current, script_text: event.target.value }))} placeholder="Paste approved wording or describe how this stage should sound..." /></label>
              <label><span>Matching media label</span><input value={scriptForm.media_label} onChange={(event) => setScriptForm((current) => ({ ...current, media_label: event.target.value }))} placeholder="Teaser video" /></label>
              <button className="primaryAction" disabled={liveLoading}>Add script</button>
            </form>
            <div className="scriptList">
              {sextingScripts.map((script) => (
                <article className={script.active ? "" : "inactive"} key={script.id}>
                  <div><span>{script.stage}</span><strong>{script.title}</strong></div>
                  <p>{script.script_text}</p>
                  {script.media_label && <small>Media: {script.media_label}</small>}
                  <button type="button" onClick={() => void updateSextingScript(script.id, "toggle", Boolean(script.active))}>{script.active ? "Deactivate" : "Activate"}</button>
                  <button type="button" onClick={() => void updateSextingScript(script.id, "remove")}>Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="contentCatalog dashboardSection dashboardContent">
            <div className="sectionHeading"><strong>Content catalog</strong><span>{contentProducts.length}</span></div>
            <p className="queueNote">The newest active item is what the bot offers first.</p>
            <form onSubmit={addContentProduct}>
              <label><span>Product type</span><select value={productForm.content_type} onChange={(event) => setProductForm((current) => ({ ...current, content_type: event.target.value as ContentProduct["content_type"] }))}><option value="photo">Photo</option><option value="photo_package">Photo package</option><option value="video">Video</option><option value="video_bundle">Video bundle</option><option value="physical_item">Panties or clothing item</option><option value="video_rating">Private video rating</option></select></label>
              <label><span>Title</span><input required value={productForm.title} onChange={(event) => setProductForm((current) => ({ ...current, title: event.target.value }))} placeholder="Content title" /></label>
              <label><span>Price</span><input inputMode="decimal" min="1" required type="number" step="0.01" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="24.99" /></label>
              {["photo", "photo_package", "video", "video_bundle"].includes(productForm.content_type) && <label><span>Locked Telegram Stars price (optional)</span><input inputMode="numeric" min="0" max="25000" type="number" step="1" value={productForm.stars_price} onChange={(event) => setProductForm((current) => ({ ...current, stars_price: event.target.value }))} placeholder="Leave blank to disable" /><small>Fans can unlock this exact item once inside Telegram. A Stars unlock requires 1 to 10 files uploaded here; Dropbox links remain part of the manual payment flow.</small></label>}
              <label className="tagField">
                <span>Tags</span>
                {productTags(productForm.genre).length > 0 && <div className="tagPool">
                  {productTags(productForm.genre).map((tag, index) => <span className="tagChip" key={`${tag}:${index}`}>{tag}<button aria-label={`Remove ${tag} tag`} onClick={() => removeProductTag(index)} type="button">×</button></span>)}
                </div>}
                <div className="tagComposer">
                  <input
                    onChange={(event) => setProductTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addProductTag();
                      }
                    }}
                    placeholder="Type a tag, such as solo"
                    value={productTagDraft}
                  />
                  <button className="tagAddButton" disabled={!productTagDraft.trim()} onClick={addProductTag} type="button">Add</button>
                </div>
                <small>Add tags one at a time. Press Enter or click Add, then use × to remove one.</small>
              </label>
              <label><span>Actors</span><input value={productForm.actors} onChange={(event) => setProductForm((current) => ({ ...current, actors: event.target.value }))} placeholder="Names separated by commas" /></label>
              <label><span>Trailer or preview link</span><input type="url" value={productForm.trailer_url} onChange={(event) => setProductForm((current) => ({ ...current, trailer_url: event.target.value }))} placeholder="https://..." /></label>
              <label><span>{["physical_item", "video_rating"].includes(productForm.content_type) ? "Delivery link not needed" : "Dropbox delivery link (optional when uploading files)"}</span><input disabled={["physical_item", "video_rating"].includes(productForm.content_type)} type="url" value={productForm.delivery_url} onChange={(event) => setProductForm((current) => ({ ...current, delivery_url: event.target.value }))} placeholder="https://..." /></label>
              {!['physical_item', 'video_rating'].includes(productForm.content_type) && <label><span>Upload one or multiple files</span><input accept="image/*,video/*" key={productUploadKey} multiple onChange={(event) => setProductFiles(Array.from(event.target.files || []))} type="file" /><small>{productFiles.length ? `${productFiles.length} file${productFiles.length === 1 ? "" : "s"} selected` : "Choose all photos or videos belonging to this product at once."}</small></label>}
              <button className="primaryAction" disabled={liveLoading}>{editingProductId ? "Save changes" : "Add content"}</button>
              {editingProductId && <button className="secondaryAction" type="button" onClick={cancelContentEdit}>Cancel editing</button>}
            </form>
            <div className="catalogList">
              {contentProducts.map((product) => (
                <article className={product.active ? "" : "inactive"} key={product.id}>
                  <div><strong>{product.title}</strong><small>{product.content_type.replaceAll("_", " ")} · {money(product.price_cents)}{product.stars_price > 0 ? ` · ⭐ ${product.stars_price.toLocaleString()}` : ""}{product.genre ? ` · Tags: ${product.genre}` : ""}{product.media_count ? ` · ${product.media_count} uploaded file${product.media_count === 1 ? "" : "s"}` : ""}</small></div>
                  <span>{product.active ? "Active" : "Hidden"}</span>
                  <button type="button" onClick={() => editContentProduct(product)}>Edit</button>
                  <button type="button" onClick={() => void updateContentProduct(product.id, "toggle", Boolean(product.active))}>{product.active ? "Hide" : "Activate"}</button>
                  <button type="button" onClick={() => void updateContentProduct(product.id, "remove")}>Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="customQueue dashboardSection dashboardToday">
            <div className="sectionHeading">
              <strong>Custom orders</strong>
              <span>{liveCustoms.length}</span>
            </div>
            {liveCustoms.length ? liveCustoms.map((custom) => (
              <div className="customCard" key={custom.id}>
                <div className="customMeta">
                  <strong>{custom.telegram_name}</strong>
                  <span>{custom.duration_minutes} minutes · {money(custom.amount_cents)}</span>
                </div>
                <p>{custom.description}</p>
                {custom.status === "awaiting_payment" && <>
                  <p className="queueNote">Quote sent. Waiting for the fan to send payment.</p>
                  <button className="ignoreAction" disabled={liveLoading} onClick={() => void closeCustomUnpaid(custom.id)}>Close unpaid and follow up</button>
                </>}
                {custom.status === "payment_review" && <>
                  <p className="queueNote">The fan says payment was sent. Verify it before starting the custom.</p>
                  <button className="primaryAction" disabled={liveLoading} onClick={() => void reviewCustomPayment(custom.id, true)}>Approve payment</button>
                  <button className="secondaryAction" disabled={liveLoading} onClick={() => void reviewCustomPayment(custom.id, false)}>Payment not verified</button>
                </>}
                {custom.status === "awaiting_fulfillment" && <><label className="amountField">
                  <span>Finished custom link</span>
                  <input
                    aria-label={`Delivery link for ${custom.telegram_name}`}
                    onChange={(event) => setCustomLinks((current) => ({ ...current, [custom.id]: event.target.value }))}
                    placeholder="https://..."
                    type="url"
                    value={customLinks[custom.id] || ""}
                  />
                </label>
                <label className="amountField">
                  <span>Optional comment</span>
                  <textarea
                    aria-label={`Optional delivery comment for ${custom.telegram_name}`}
                    maxLength={1000}
                    onChange={(event) => setCustomComments((current) => ({ ...current, [custom.id]: event.target.value }))}
                    placeholder="Add a personal note if needed..."
                    value={customComments[custom.id] || ""}
                  />
                </label>
                <button className="primaryAction" disabled={liveLoading || !customLinks[custom.id]?.trim()} onClick={() => void completeCustom(custom.id)}>
                  Finish custom and send
                </button>
                </>}
                <button className="secondaryAction" disabled={liveLoading} onClick={() => void cancelCustom(custom.id)}>
                  Cancel custom
                </button>
              </div>
            )) : <p className="queueNote">No custom orders waiting.</p>}
          </section>

          <section className="customQueue videoChatQueue dashboardSection dashboardToday">
            <div className="sectionHeading">
              <strong>Video chat schedule</strong>
              <span>{videoChats.length}</span>
            </div>
            {videoChats.length ? videoChats.map((order) => (
              <div className="customCard" key={order.id}>
                <div className="customMeta">
                  <strong>{order.telegram_name}</strong>
                  <span>{order.duration_minutes} minutes · {money(order.amount_cents)}</span>
                </div>
                <p><b>{videoChatSchedule(order.scheduled_at)}</b><br />Telegram video chat</p>
                {order.status === "awaiting_payment" && <>
                  <p className="queueNote">Time selected. Waiting for a payment screenshot.</p>
                  <button className="ignoreAction" disabled={liveLoading} onClick={() => void resolveVideoChat(order.id, "close_unpaid")}>Close unpaid and follow up</button>
                </>}
                {order.status === "payment_review" && <>
                  <p className="queueNote">Payment screenshot received. Verify it before confirming the appointment.</p>
                  <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveVideoChat(order.id, "approve_payment")}>Confirm payment and schedule</button>
                  <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolveVideoChat(order.id, "payment_not_verified")}>Payment not verified</button>
                </>}
                {order.status === "scheduled" && <>
                  <p className="queueNote">Payment confirmed. This appointment is on the daily task list. Complete it after the call to return the fan to normal chat mode.</p>
                  <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveVideoChat(order.id, "complete")}>Complete video chat and resume bot</button>
                </>}
                <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolveVideoChat(order.id, "cancel")}>Cancel video chat</button>
              </div>
            )) : <p className="queueNote">No video chats waiting or scheduled.</p>}
          </section>

          {livePurchases.length ? (
            <div className="takeoverCard purchaseApproval dashboardSection dashboardToday">
              <div className="alertTitle"><span>$</span> {livePurchases[0].payment_proof_received_at ? "Payment screenshot received" : "Payment claimed"}</div>
              <p className="fanQuestion">{livePurchases[0].product_title}</p>
              <div className="purchasePrice">{livePurchases[0].price}</div>
              <small>Requested {new Date(`${livePurchases[0].created_at}Z`).toLocaleDateString()}</small>
              <div className={`paymentProofStatus ${livePurchases[0].payment_proof_received_at ? "received" : "needed"}`}>
                {livePurchases[0].payment_proof_received_at ? "Screenshot received. Verify it before approving." : "Waiting for a payment screenshot."}
              </div>
              <div className="botPaused">Fan message: “{livePurchases[0].payment_note}”</div>
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolvePurchase("approve")}>
                {livePurchases[0].content_type === "physical_item" ? "Confirm payment and collect shipping" : livePurchases[0].content_type === "video_rating" ? "Confirm payment and request rating photo" : "Confirm payment and send video or photos"}
              </button>
              <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolvePurchase("decline")}>
                Payment not verified
              </button>
              <button className="ignoreAction" disabled={liveLoading} onClick={() => void resolvePurchase("close_unpaid")}>
                Close as unpaid and follow up
              </button>
            </div>
          ) : liveBookings.length ? (
            <div className="takeoverCard bookingApproval dashboardSection dashboardToday">
              <div className="alertTitle"><span>□</span> {liveBookings[0].suggested_type === "custom_content" ? "Custom request" : "Booking request"}</div>
              <div className="requestOwner">{liveBookings[0].telegram_name}</div>
              <p className="fanQuestion">“{liveBookings[0].details}”</p>
              <small>Requested {new Date(`${liveBookings[0].created_at}Z`).toLocaleDateString()}</small>
              <div className="botPaused">Check the date, time, service, city, and calendar before replying.</div>
              <textarea
                aria-label="Booking reply"
                onChange={(event) => setCreatorReply(event.target.value)}
                placeholder="Confirm, suggest another time, or ask a question..."
                value={creatorReply}
              />
              <label className="amountField">
                <span>Service</span>
                <select onChange={(event) => setBookingType(event.target.value as typeof bookingType)} value={bookingType}>
                  <option value="video_chat">Video chat</option>
                  <option value="custom_content">Custom content</option>
                  <option value="in_person">In person meet</option>
                </select>
              </label>
              <label className="amountField">
                <span>{bookingType === "in_person" ? "Hours" : "Minutes"}</span>
                <input inputMode="decimal" min={bookingType === "video_chat" ? "5" : "1"} onChange={(event) => setBookingDuration(event.target.value)} placeholder={bookingType === "video_chat" ? "5" : "1"} value={bookingDuration} />
              </label>
              {bookingType === "video_chat" && <label className="amountField">
                <span>Confirmed date and time</span>
                <input min={new Date().toISOString().slice(0, 16)} onChange={(event) => setBookingScheduledAt(event.target.value)} type="datetime-local" value={bookingScheduledAt} />
              </label>}
              {bookingType === "video_chat" && /\b(?:right now|video (?:chat|call) now|immediately|asap|rn)\b/i.test(liveBookings[0].details) && <p className="queueNote">The fan asked for a video chat right now. You can approve it without choosing another time.</p>}
              {bookingType === "custom_content" ? <label className="amountField">
                <span>Custom quote total</span>
                <input inputMode="decimal" min="1" onChange={(event) => setBookingAmount(event.target.value)} placeholder="Enter the amount the creator wants to charge" type="number" value={bookingAmount} />
              </label> : <div className="calculatedTotal">
                Total: {money(Math.round(Number(bookingDuration || 0) * Number(bookingType === "in_person" ? settings.in_person_rate : settings.video_chat_rate) * 100))}
                {bookingType === "in_person" && <small>Excluded from earnings</small>}
              </div>}
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveBooking("approve")}>
                {bookingType === "custom_content" ? "Accept custom and send quote" : bookingType === "video_chat" ? "Approve video chat and request payment" : "Approve booking and send"}
              </button>
              <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolveBooking("decline")}>
                Decline and send reply
              </button>
              <button className="ignoreAction" disabled={liveLoading} onClick={() => void resolveBooking("ignore")}>
                Ignore
              </button>
              <button className="ignoreAction" disabled={liveLoading} onClick={() => void resolveBooking("close_unpaid")}>
                Close as unpaid and follow up
              </button>
            </div>
          ) : null}

          <div className="testPrompts dashboardSection dashboardSettings">
            <strong>Quick test prompts</strong>
            <button onClick={() => { setInput("Can I get a custom video?"); setCreatorMode(false); }}>Custom request</button>
            <button onClick={() => { setInput("What anime do you like?"); setCreatorMode(false); }}>Personality question</button>
            <button onClick={() => { setInput("I want to book a call"); setCreatorMode(false); }}>Booking request</button>
          </div>

          <div className="personaSummary settingsPanel dashboardSection dashboardSettings">
            <div>
              <span>Flirty level</span>
              <section>{(["soft", "flirty", "very"] as const).map((value) => <button className={settings.flirty_level === value ? "selected" : ""} key={value} onClick={() => changeSetting("flirty_level", value)}>{value}</button>)}</section>
            </div>
            <div><span>Human takeover</span><strong>Always available</strong></div>
            <div><span>Learning</span><button className="settingToggle" onClick={() => changeSetting("learning", settings.learning === "approval" ? "off" : "approval")}>{settings.learning === "approval" ? "Approval only" : "Off"}</button></div>
            <div><span>Custom approval</span><button className="settingToggle" onClick={() => changeSetting("custom_approval", settings.custom_approval === "required" ? "off" : "required")}>{settings.custom_approval === "required" ? "Required" : "Off"}</button></div>
            <div><span>Sexting</span><button className="settingToggle" onClick={() => changeSetting("sexting_enabled", settings.sexting_enabled === "on" ? "off" : "on")}>{settings.sexting_enabled}</button></div>
            <div><span>Sleep hours</span><button className="settingToggle" onClick={() => changeSetting("sleep_hours_enabled", settings.sleep_hours_enabled === "on" ? "off" : "on")}>{settings.sleep_hours_enabled}</button></div>
            <div className="rateSetting"><span>Sleep time</span><label><input aria-label="Sleep start time" onChange={(event) => changeSetting("sleep_start", event.target.value)} type="time" value={settings.sleep_start} /></label></div>
            <div className="rateSetting"><span>Wake time</span><label><input aria-label="Wake time" onChange={(event) => changeSetting("sleep_end", event.target.value)} type="time" value={settings.sleep_end} /></label></div>
            <div><span>Sexting intensity</span><section>{(["soft", "hard", "hot"] as const).map((value) => <button className={settings.sexting_intensity === value ? "selected" : ""} key={value} onClick={() => changeSetting("sexting_intensity", value)}>{value}</button>)}</section></div>
            <div className="rateSetting"><span>Video chat per minute</span><label>$<input aria-label="Video chat rate per minute" inputMode="decimal" min="1" onChange={(event) => changeSetting("video_chat_rate", event.target.value)} type="number" value={settings.video_chat_rate} /></label></div>
            <div className="rateSetting"><span>In person meet per hour</span><label>$<input aria-label="In person meet rate per hour" inputMode="decimal" min="1" onChange={(event) => changeSetting("in_person_rate", event.target.value)} type="number" value={settings.in_person_rate} /></label></div>
            <div className="rateSetting"><span>Dick rating price</span><label>$<input aria-label="Dick rating price" inputMode="decimal" min="1" onChange={(event) => changeSetting("video_rating_rate", event.target.value)} step="0.01" type="number" value={settings.video_rating_rate} /></label></div>
            <div className="rateSetting"><span>Sexting per minute</span><label>$<input aria-label="Sexting rate per minute" inputMode="decimal" min="1" onChange={(event) => changeSetting("sexting_rate", event.target.value)} type="number" value={settings.sexting_rate} /></label></div>
            <div className="rateSetting"><span>Sexting minimum minutes</span><label><input aria-label="Minimum sexting session length" inputMode="numeric" min="1" max="9" onChange={(event) => changeSetting("sexting_min_minutes", event.target.value)} type="number" value={settings.sexting_min_minutes} /></label></div>
            <div className="rateSetting"><span>{settings.sexting_min_minutes || "5"} minute Stars price</span><label>⭐<input aria-label="Minimum sexting package price in Stars" inputMode="numeric" min="1" onChange={(event) => changeSetting("sexting_5_stars", event.target.value)} type="number" value={settings.sexting_5_stars} /></label></div>
            <div className="rateSetting"><span>10 minute Stars price</span><label>⭐<input aria-label="10 minute sexting price in Stars" inputMode="numeric" min="1" onChange={(event) => changeSetting("sexting_10_stars", event.target.value)} type="number" value={settings.sexting_10_stars} /></label></div>
            <button className="primaryAction" disabled={liveLoading || !settingsDirty} onClick={() => void saveCreatorSettings()} type="button">{liveLoading ? "Saving..." : "Save changes"}</button>
            {settingsSaveStatus && <small className={settingsDirty ? "settingsUnsaved" : "settingsSaved"}>{settingsSaveStatus}</small>}
          </div>

          <div className="creatorProfileLinks dashboardSection dashboardSettings">
            <div className="sectionHeading"><strong>Approved social links</strong><span>{socialLinks.length}</span></div>
            <p className="queueNote">The bot shares only links shown here.</p>
            <form onSubmit={addSocialLink}>
              <label><span>Platform</span><select value={socialForm.platform} onChange={(event) => setSocialForm((current) => ({ ...current, platform: event.target.value }))}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Twitch</option><option>X</option><option>Pornhub</option><option>OnlyFans</option><option>All links</option><option>Other</option></select></label>
              <label><span>Display name</span><input required placeholder="@username or profile name" value={socialForm.label} onChange={(event) => setSocialForm((current) => ({ ...current, label: event.target.value }))} /></label>
              <label><span>Profile link</span><input required type="url" placeholder="https://..." value={socialForm.url} onChange={(event) => setSocialForm((current) => ({ ...current, url: event.target.value }))} /></label>
              <button className="primaryAction" disabled={liveLoading}>{editingSocialId ? "Save changes" : "Add social link"}</button>
              {editingSocialId && <button className="secondaryAction" type="button" onClick={cancelSocialEdit}>Cancel editing</button>}
            </form>
            <div className="socialLinkList">
              {socialLinks.map((link) => <article key={link.id}><a href={link.url} rel="noreferrer" target="_blank"><span>{link.platform}</span><b>{link.label}</b></a><button type="button" disabled={liveLoading} onClick={() => editSocialLink(link)}>Edit</button><button type="button" disabled={liveLoading} onClick={() => void deleteSocialLink(link.id)}>Delete</button></article>)}
            </div>
          </div>

          <section className="conversationTraining dashboardSection dashboardSettings">
            <div className="sectionHeading"><strong>Conversation training</strong><span>{trainingSuggestions.length}</span></div>
            <p className="queueNote">Teach the bot what the creator likes, dislikes, knows about herself, and how she naturally texts. Include complete examples. Saved changes apply immediately.</p>
            <form onSubmit={addTrainingSuggestion}>
              <label><span>Training type</span><select value={trainingForm.category} onChange={(event) => setTrainingForm((current) => ({ ...current, category: event.target.value as TrainingSuggestion["category"] }))}><option value="fact">Personal fact or answer</option><option value="like">Like or favorite</option><option value="dislike">Dislike</option><option value="voice">How I say things</option><option value="topic">Topic to discuss</option><option value="avoid">Topic to avoid</option><option value="tone">Tone instruction</option><option value="feedback">Behavior feedback</option></select></label>
              <label><span>Suggestion</span><textarea required maxLength={1000} placeholder={trainingForm.category === "fact" ? "I went to Comic Con in 2025." : trainingForm.category === "like" ? "My favorite anime is Sailor Moon." : trainingForm.category === "dislike" ? "I don't like rude people." : trainingForm.category === "voice" ? "Example: lol yeah babe, that sounds fun" : "Add one clear instruction..."} value={trainingForm.suggestion} onChange={(event) => setTrainingForm((current) => ({ ...current, suggestion: event.target.value }))} /></label>
              <button className="primaryAction" disabled={liveLoading}>{editingTrainingId ? "Save changes" : "Add training suggestion"}</button>
              {editingTrainingId && <button className="secondaryAction" type="button" onClick={cancelTrainingEdit}>Cancel editing</button>}
            </form>
            <div className="trainingSuggestionList">
              {trainingSuggestions.map((item) => <article key={item.id}><div><span>{item.category === "fact" ? "Personal answer" : item.category === "like" ? "Likes and favorites" : item.category === "dislike" ? "Dislikes" : item.category === "voice" ? "My texting style" : item.category === "topic" ? "Talk about" : item.category === "avoid" ? "Avoid" : item.category === "tone" ? "Tone" : "Feedback"}</span><p>{item.suggestion}</p></div><button type="button" disabled={liveLoading} onClick={() => editTrainingSuggestion(item)}>Edit</button><button type="button" disabled={liveLoading} onClick={() => void deleteTrainingSuggestion(item.id)}>Delete</button></article>)}
            </div>
            <div className="fixedBoundaries">
              <strong>Fixed safety boundaries</strong>
              <p>Politics and political topics, religion, race and racism, racial slurs, war, riots, stealing, scams and scammers, threats, underage people, minors, kids, children, rape and nonconsensual activity, scat, pee, poop, urine, watersports, and bathroom play. These cannot be edited or deleted.</p>
            </div>
          </section>

          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Content order history</strong>
            {purchaseHistory.length ? purchaseHistory.map((purchase) => (
              <div key={purchase.id}>
                <span><b>{purchase.product_title}</b><small>{new Date(`${purchase.created_at}Z`).toLocaleString()} · {purchase.status?.replaceAll("_", " ")}</small></span>
                <time>{purchase.price}</time>
              </div>
            )) : <p>No content orders yet.</p>}
          </section>

          <div className="recentSales dashboardSection dashboardHistory">
            <strong>Recent earnings</strong>
            {earnings.recent.length ? earnings.recent.slice(0, 6).map((item) => (
              <div key={item.id}>
                <span>{item.description}<small>{new Date(`${item.occurred_at}Z`).toLocaleString()}</small></span>
                <b>{money(item.amount_cents)}</b>
              </div>
            )) : <p>No approved sales yet.</p>}
          </div>

          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Custom history</strong>
            {customHistory.length ? customHistory.map((custom) => (
              <div key={custom.id}>
                <span>
                  <b>{custom.telegram_name}</b>
                  <small>{custom.duration_minutes} minutes · {money(custom.amount_cents)}{custom.completion_comment ? ` · ${custom.completion_comment}` : ""}</small>
                  {custom.delivery_url && <a href={custom.delivery_url} rel="noreferrer" target="_blank">Open finished custom</a>}
                </span>
                <time>{custom.status === "cancelled" ? "Cancelled" : custom.status === "closed_unpaid" ? "Closed unpaid" : custom.completed_at ? new Date(`${custom.completed_at}Z`).toLocaleDateString() : "Completed"}</time>
              </div>
            )) : <p>No completed customs yet.</p>}
          </section>

          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Video chat history</strong>
            {videoChatHistory.length ? videoChatHistory.map((order) => (
              <div key={order.id}>
                <span><b>{order.telegram_name}</b><small>{videoChatSchedule(order.scheduled_at)} · {order.duration_minutes} minutes · {money(order.amount_cents)}</small></span>
                <time>{order.status === "completed" ? "Completed" : order.status === "closed_unpaid" ? "Closed unpaid" : "Cancelled"}</time>
              </div>
            )) : <p>No completed video chats yet.</p>}
          </section>

          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Shipped merchandise</strong>
            {physicalOrderHistory.length ? physicalOrderHistory.map((order) => (
              <div key={order.id}>
                <span><b>{order.product_title}</b><small>{order.customer_name} · Tracking {order.tracking_number}</small></span>
                <time>{order.shipped_at ? new Date(`${order.shipped_at}Z`).toLocaleDateString() : money(order.amount_cents)}</time>
              </div>
            )) : <p>No shipped merchandise yet.</p>}
          </section>

          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Completed video ratings</strong>
            {ratingOrderHistory.length ? ratingOrderHistory.map((order) => (
              <div key={order.id}>
                <span><b>{order.telegram_name}</b><small>⭐ {order.stars} · {money(order.amount_cents)} listed value</small></span>
                <time>{order.completed_at ? new Date(`${order.completed_at}Z`).toLocaleDateString() : "Completed"}</time>
              </div>
            )) : <p>No completed video ratings yet.</p>}
          </section>
          <section className="customHistory dashboardSection dashboardHistory">
            <strong>Completed sexting sessions</strong>
            {sextingHistory.length ? sextingHistory.map((session) => (
              <div key={session.id}>
                <span><b>{session.telegram_name}</b><small>{session.package_title}</small></span>
                <time>⭐ {session.stars.toLocaleString()}</time>
                {saleDisputes.some((dispute) => dispute.source_type === "sexting_stars" && dispute.source_id === String(session.id) && dispute.status === "pending")
                  ? <small>Report pending</small>
                  : <button type="button" onClick={() => { setDisputedStarsSession(session); setDisputeForm({ reason: "", proof: "" }); }}>Report sale</button>}
              </div>
            )) : <p>No completed sexting sessions yet.</p>}
            {disputedStarsSession && (
              <form className="disputeForm" onSubmit={submitStarsDispute}>
                <strong>Report {disputedStarsSession.package_title}</strong>
                <label><span>What went wrong?</span><textarea required maxLength={1000} value={disputeForm.reason} onChange={(event) => setDisputeForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain why these Stars should be removed from earnings." /></label>
                <label><span>Proof link or details</span><input required maxLength={2000} value={disputeForm.proof} onChange={(event) => setDisputeForm((current) => ({ ...current, proof: event.target.value }))} placeholder="Paste a screenshot link, receipt link, or supporting details." /></label>
                <button className="primaryAction" disabled={liveLoading}>Submit for owner review</button>
                <button className="secondaryAction" type="button" onClick={() => setDisputedStarsSession(null)}>Cancel</button>
              </form>
            )}
          </section>
        </aside>
      </section>
      <footer className="footerNote">Live creator controls · Manual payment approvals · Earnings logged after approval</footer>
    </main>
  );
}
