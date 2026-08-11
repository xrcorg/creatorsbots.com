"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "bot" | "fan" | "system";
  text: string;
  time: string;
};

type LivePendingReply = {
  id: number;
  chat_id: string;
  question: string;
  created_at: string;
};

type LivePurchase = {
  id: number;
  product_title: string;
  price: string;
  payment_note: string;
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

type LiveCustom = {
  id: number;
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
  category: "topic" | "avoid" | "tone" | "feedback";
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
  last_message: string;
  last_role: "user" | "assistant" | "";
  last_message_at: string;
  message_count: number;
  pending_count: number;
  active_workflow: "chat" | "sexting" | "custom" | "booking" | "sexting checkout";
  control_mode: "bot" | "human";
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
  video_rating_stars: string;
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationStatus, setConversationStatus] = useState("");
  const [conversationReply, setConversationReply] = useState("");
  const [quickReplyCategory, setQuickReplyCategory] = useState<QuickReplyCategory>("content");
  const [quickReplyProductId, setQuickReplyProductId] = useState(0);
  const [livePurchases, setLivePurchases] = useState<LivePurchase[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<LivePurchase[]>([]);
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveCustoms, setLiveCustoms] = useState<LiveCustom[]>([]);
  const [customHistory, setCustomHistory] = useState<LiveCustom[]>([]);
  const [sextingSessions, setSextingSessions] = useState<LiveSextingSession[]>([]);
  const [sextingHistory, setSextingHistory] = useState<LiveSextingSession[]>([]);
  const [starsSummary, setStarsSummary] = useState({ total: 0, count: 0 });
  const [sextingMedia, setSextingMedia] = useState<SextingMedia[]>([]);
  const [contentProducts, setContentProducts] = useState<ContentProduct[]>([]);
  const [sextingScripts, setSextingScripts] = useState<SextingScript[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [physicalOrders, setPhysicalOrders] = useState<PhysicalOrder[]>([]);
  const [physicalOrderHistory, setPhysicalOrderHistory] = useState<PhysicalOrder[]>([]);
  const [ratingOrders, setRatingOrders] = useState<RatingOrder[]>([]);
  const [ratingOrderHistory, setRatingOrderHistory] = useState<RatingOrder[]>([]);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<number, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] = useState({ platform: "Instagram", message: "", stream_url: "" });
  const [announcementPreview, setAnnouncementPreview] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialForm, setSocialForm] = useState({ platform: "Instagram", label: "", url: "" });
  const [editingSocialId, setEditingSocialId] = useState<number | null>(null);
  const [trainingSuggestions, setTrainingSuggestions] = useState<TrainingSuggestion[]>([]);
  const [trainingForm, setTrainingForm] = useState({ category: "topic" as TrainingSuggestion["category"], suggestion: "" });
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
  const [earnings, setEarnings] = useState<EarningsSummary>({ weekly_cents: 0, weekly_count: 0, all_time_cents: 0, all_time_count: 0, recent: [], history: [] });
  const [saleDisputes, setSaleDisputes] = useState<SaleDispute[]>([]);
  const [disputedSale, setDisputedSale] = useState<EarningsSummary["history"][number] | null>(null);
  const [disputedStarsSession, setDisputedStarsSession] = useState<LiveSextingSession | null>(null);
  const [disputeForm, setDisputeForm] = useState({ reason: "", proof: "" });
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview | null>(null);
  const [ownerDayView, setOwnerDayView] = useState<string | null>(null);
  const [earningsView, setEarningsView] = useState<"weekly" | "all" | null>(null);
  const [bookingType, setBookingType] = useState<"video_chat" | "custom_content" | "in_person">("video_chat");
  const [bookingDuration, setBookingDuration] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [settings, setSettings] = useState<CreatorSettings>({ flirty_level: "very", human_takeover: "on", learning: "approval", custom_approval: "required", video_chat_rate: "50", custom_content_rate: "50", in_person_rate: "1500", video_rating_rate: "75", video_rating_stars: "5000", preferred_topics: "", avoid_topics: "", tone_guidance: "Short, blunt, warm, confident, flirty, and natural", creator_feedback: "", sexting_enabled: "on", sexting_intensity: "soft", sexting_rate: "10", sexting_min_minutes: "5", sexting_5_stars: "500", sexting_10_stars: "1000", sleep_hours_enabled: "on", response_test_mode: "off", sleep_start: "02:00", sleep_end: "08:00" });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dashboardView, setDashboardView] = useState<"today" | "inbox" | "content" | "settings" | "history">("today");
  const previousAttentionCount = useRef<number | null>(null);
  const settingsDirtyRef = useRef(false);

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { portal_user: PortalUser; platform_overview: PlatformOverview | null; pending: LivePendingReply[]; conversations: LiveConversation[]; purchases: LivePurchase[]; purchase_history: LivePurchase[]; bookings: LiveBooking[]; customs: LiveCustom[]; custom_history: LiveCustom[]; sexting_sessions: LiveSextingSession[]; sexting_history: LiveSextingSession[]; sexting_media: SextingMedia[]; sexting_scripts: SextingScript[]; daily_tasks: DailyTask[]; physical_orders: PhysicalOrder[]; physical_order_history: PhysicalOrder[]; rating_orders: RatingOrder[]; rating_order_history: RatingOrder[]; announcements: Announcement[]; social_links: SocialLink[]; training_suggestions: TrainingSuggestion[]; sale_disputes: SaleDispute[]; products: ContentProduct[]; stars: { total: number; count: number }; learned_count: number; earnings: EarningsSummary; settings: CreatorSettings };
      setPortalUser(data.portal_user);
      setPlatformOverview(data.platform_overview);
      setLivePending(data.pending);
      setConversations(data.conversations || []);
      setLivePurchases(data.purchases);
      setPurchaseHistory(data.purchase_history || []);
      setLiveBookings(data.bookings);
      setLiveCustoms(data.customs || []);
      setCustomHistory(data.custom_history || []);
      setSextingSessions(data.sexting_sessions || []);
      setSextingHistory(data.sexting_history || []);
      setStarsSummary(data.stars || { total: 0, count: 0 });
      setSextingMedia(data.sexting_media || []);
      setContentProducts(data.products || []);
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
      setEarnings(data.earnings);
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
    void loadLivePending();
    const timer = window.setInterval(() => void loadLivePending(), 10000);
    return () => window.clearInterval(timer);
  }, [loadLivePending]);

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

  const attentionCount = livePending.length + livePurchases.length + liveBookings.length + liveCustoms.length + sextingSessions.length;
  const statusText = attentionCount ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} attention` : "Bot active";
  const onboardingPhotoCount = sextingMedia.filter((item) => item.media_type === "image").length;
  const onboardingClipCount = sextingMedia.filter((item) => item.media_type === "video").length;
  const onboardingSteps = [onboardingPhotoCount >= 20, onboardingClipCount >= 5, contentProducts.length > 0];
  const onboardingProgress = Math.round((onboardingSteps.filter(Boolean).length / onboardingSteps.length) * 100);

  useEffect(() => {
    const previous = previousAttentionCount.current;
    previousAttentionCount.current = attentionCount;
    if (!notificationsEnabled || previous === null || attentionCount <= previous || typeof Notification === "undefined") return;
    new Notification("Tiffani creator inbox", {
      body: statusText,
      icon: "/favicon.svg",
    });
  }, [attentionCount, notificationsEnabled, statusText]);

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
          "Hey, it's Tiffany. What are you up to?",
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
      const data = await response.json() as { messages: ConversationMessage[] };
      setConversationMessages(data.messages || []);
      setConversationReply("");
      setConversationStatus("");
    } catch {
      setConversationMessages([]);
      setConversationStatus("This conversation could not be loaded.");
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
        body: JSON.stringify({ chat_id: selectedConversation.chat_id, text: conversationReply.trim(), action: "send", learn: saveForFuture }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Reply failed");
      const resolvedChatId = selectedConversation.chat_id;
      const sentReply = conversationReply.trim();
      setConversationReply("");
      setLivePending((items) => items.filter((item) => item.chat_id !== resolvedChatId));
      setConversations((items) => items.map((item) => item.chat_id === resolvedChatId
        ? { ...item, pending_count: 0, control_mode: "human", last_message: sentReply,
          last_role: "assistant", last_message_at: new Date().toISOString().replace("T", " ").replace("Z", "") }
        : item));
      await loadLivePending();
      await openConversation(resolvedChatId);
      setConversationStatus(saveForFuture
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
    const ratingStars = `${Number(settings.video_rating_stars || 5000).toLocaleString()} Stars`;
    const catalog = products.slice(0, 8).map((item) => `${item.title} · ${money(item.price_cents)}`).join("\n");
    const replies: Record<string, string> = {
      saw_message: "Hey babe, I saw your message. What did you want to know?",
      busy: "Hey babe, I'm busy right now, but I'll reply as soon as I can. Please be patient with me.",
      anything_else: "Got it! Lmk if there's anything else you want!",
      catalog: catalog ? `Here's what I have available right now:\n\n${catalog}\n\nTell me which one you want and I'll send you the details.` : "I'm adding new content soon, babe. What kind of content do you want to see?",
      trailer: product?.trailer_url ? `Here's the trailer for ${product.title}, babe:\n${product.trailer_url}\n\nThe full video is ${productPrice}. Do you want to buy it?` : product ? `I have ${product.title}, babe. I don't have a trailer link ready here, but the full video is ${productPrice}. Do you want the details?` : "Which video did you want the trailer for, babe?",
      product_details: product ? `I have ${product.title}${product.actors ? ` starring ${product.actors}` : ""}.${product.genre ? ` Tags: ${product.genre}.` : ""} It's ${productPrice}. Do you want to buy it?` : "Which video did you want more details about, babe?",
      product_payment: product ? `Please send ${productPrice} and put your Telegram username in the notes. Send me a screenshot after you send it and I'll verify it before I send you ${product.title}.` : "Tell me which video you want and I'll send you the payment details.",
      custom_start: "Yeah babe, I make customs. Tell me what you want and how long you want it to be.",
      custom_more: "Anything else you want me to add?",
      custom_review: "Got it! I'll review everything and let you know what it will cost.",
      custom_quote: "I can't quote you until I know what you want and for how long. Can you send me your idea?",
      booking_options: "Do you wanna set something up? I offer video chats here on Telegram and fan meet and greets. Which one are you interested in?",
      booking_schedule: "Send me your preferred date and time and tell me if you want a video chat or fan meet and greet. If it's a meet and greet, tell me what city you're in too.",
      booking_contact: "What city are you in, babe? Send me your phone number or email and I'll reach out when I'm in your city.",
      video_chat: `Video chats happen right here on Telegram and are $${settings.video_chat_rate} per minute with a 5 minute minimum. What date and time works for you?`,
      video_chat_schedule: "Send me your preferred date, time, and how many minutes you want. I'll check my schedule and get back to you.",
      video_chat_confirm: "Yes babe, the video chat will happen right here on Telegram. Once we confirm the date, time, and payment, I'll call you here.",
      rating_offer: `Yes babe, I do private video ratings. It's ${ratingPrice} or ${ratingStars}. You send me a photo and I'll respond with a short private video rating.`,
      rating_photo: "Send me the photo you want me to rate here. I'll review it after I verify your payment.",
      rating_payment: `The private video rating is ${ratingPrice} or ${ratingStars}. You can pay with Cash App, Venmo, Zelle, or Telegram Stars. Put your Telegram username in the notes and send me a screenshot after you pay.`,
      payment_options: "I accept Cash App, Venmo, and Zelle. Tell me what you're buying and I'll send you the payment information.",
      payment_screenshot: "Please put your Telegram username in the payment notes and send me a screenshot after you send it.",
      payment_received: "Ok, thanks babe. Let me check when I get the chance and I'll send you the link!",
      telegram_tos: "I don't discuss in person sex on here due to Telegram TOS. I don't want to get banned.",
      unavailable: "I can't help with that, babe. We can talk about something else if you want.",
    };
    setConversationReply(replies[template] || "");
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

  function openConversationFromAdmin(chatId: string) {
    setDashboardView("inbox");
    void openConversation(chatId);
    window.setTimeout(() => document.getElementById("creator-control-room")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function resolvePurchase(action: "approve" | "decline" | "close_unpaid") {
    const current = livePurchases[0];
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

  async function resolveBooking(action: "approve" | "decline" | "ignore" | "close_unpaid") {
    const current = liveBookings[0];
    if (!current) return;
    const answer = creatorReply.trim();
    if (action !== "ignore" && action !== "close_unpaid" && !answer) return;
    if (action === "approve" && !bookingDuration.trim()) return;
    if (action === "approve" && bookingType === "custom_content" && !bookingAmount.trim()) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action, answer, service_type: bookingType, duration: bookingDuration, amount: bookingAmount }),
      });
      if (!response.ok) throw new Error("Booking update failed");
      setCreatorReply("");
      setBookingDuration("");
      setBookingAmount("");
      await loadLivePending();
    } catch {
      setLiveError("The booking update was not sent. Please try again.");
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
      setAnnouncementForm({ platform: "Instagram", message: "", stream_url: "" });
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
    setTrainingForm({ category: "topic", suggestion: "" });
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
  const quickReplyProducts = contentProducts.filter((product) => product.active && !["physical_item", "video_rating"].includes(product.content_type));
  const openAgendaCount = selectedAgendaTasks.filter((task) => task.status === "open").length + physicalOrders.length + ratingOrders.length;
  const unscheduledCount = liveBookings.length + liveCustoms.length + livePurchases.length + sextingSessions.length + physicalOrders.length + ratingOrders.length;
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
          <span className="brandMark">TM</span>
          <div>
            <strong>Tiffani Madison</strong>
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
              <p>Review platform activity and securely view each creator's control room.</p>
            </div>
            <span className="supportMode">Viewing as Tiffani</span>
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
                  <span><b>⭐ {creator.all_time_stars.toLocaleString()}</b><small>Sexting Stars</small></span>
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
                                <span><b>{item.description}</b><small>{item.source_type.replaceAll("_", " ")} · {new Date(`${item.occurred_at.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
                                <strong>{money(item.amount_cents)}</strong>
                              </div>
                            ))}
                            {day.star_items.map((item) => (
                              <div key={`stars:${item.id}`}>
                                <span><b>{item.package_title}</b><small>Sexting session · {new Date(`${item.created_at.replace(" ", "T")}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
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
            {(["today", "inbox", "content", "settings", "history"] as const).map((view) => (
              <button className={dashboardView === view ? "active" : ""} key={view} onClick={() => setDashboardView(view)} type="button">
                {view === "today" ? "Today" : view === "inbox" ? "Inbox" : view === "content" ? "Content" : view === "settings" ? "Settings" : "History"}
              </button>
            ))}
          </nav>

          <div className="earningsOverview">
            <button onClick={() => setEarningsView((current) => current === "weekly" ? null : "weekly")}><span>Past 7 days</span><strong>{money(earnings.weekly_cents)}</strong><small>{earnings.weekly_count} approved sales · View history</small></button>
            <button onClick={() => setEarningsView((current) => current === "all" ? null : "all")}><span>All time</span><strong>{money(earnings.all_time_cents)}</strong><small>{earnings.all_time_count} approved sales · View history</small></button>
          </div>
          {earningsView && (
            <section className="earningsHistory">
              <div className="sectionHeading">
                <strong>{earningsView === "weekly" ? "Past 7 days sales" : "All sales"}</strong>
                <button aria-label="Close earnings history" onClick={() => setEarningsView(null)}>×</button>
              </div>
              {(earningsView === "weekly"
                ? earnings.history.filter((item) => new Date(`${item.occurred_at}Z`).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000)
                : earnings.history
              ).length ? (earningsView === "weekly"
                ? earnings.history.filter((item) => new Date(`${item.occurred_at}Z`).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000)
                : earnings.history
              ).map((item) => (
                <div className="historyRow" key={item.id}>
                  <span><b>{item.description}</b><small>{item.source_type.replaceAll("_", " ")} · {new Date(`${item.occurred_at}Z`).toLocaleString()}</small></span>
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
            <span>Telegram Stars earned</span>
            <strong>⭐ {starsSummary.total.toLocaleString()}</strong>
            <small>{starsSummary.count} Star purchases</small>
          </section>

          <section className="conversationInbox dashboardSection dashboardInbox">
            <div className="sectionHeading">
              <div><strong>Current chats</strong><small>{conversations.length} conversations</small></div>
              <span>{conversations.reduce((total, conversation) => total + Number(conversation.pending_count || 0), 0)} need attention</span>
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
                    <span className={`workflowBadge ${conversation.active_workflow.replace(" ", "-")}`}>{conversation.active_workflow}</span>
                    {Number(conversation.pending_count) > 0 && <b className="unreadBadge">{conversation.pending_count}</b>}
                  </button>
                )) : <p>No chats match that search.</p>}
              </div>
              <div className="conversationDetail">
                {selectedConversation ? <>
                  <header>
                    <div><strong>{selectedConversation.telegram_name}</strong><small>{selectedConversation.message_count} saved messages · {selectedConversation.control_mode === "human" ? "Creator replying" : "Bot active"}</small></div>
                    <div className="conversationHeaderActions">
                      <label className="botReplySwitch">
                        <span>Bot replies</span>
                        <input aria-label="Bot replies" checked={selectedConversation.control_mode === "bot"} disabled={liveLoading} onChange={(event) => void setConversationBotMode(selectedConversation.chat_id, event.target.checked)} type="checkbox" />
                        <i aria-hidden="true" />
                      </label>
                      <button className="resetConversation" disabled={liveLoading} onClick={() => void resetLiveConversation(selectedConversation.chat_id)} type="button">Reset chat</button>
                    </div>
                  </header>
                  <div className="conversationTranscript">
                    {conversationMessages.length ? conversationMessages.map((message) => (
                      <article className={message.role} key={message.id}>
                        <span>{message.role === "user" ? selectedConversation.telegram_name : "Tiffani"}</span>
                        {message.voice_note_id && <audio controls preload="none" src={`/api/admin/conversations/voice/${message.voice_note_id}`} />}
                        <p>{message.content}</p>
                        {message.voice_status === "creator_review" && <small className="voiceReviewFlag">Voice memo awaiting your reply</small>}
                        <time>{new Date(`${message.created_at.replace(" ", "T")}Z`).toLocaleString()}</time>
                      </article>
                    )) : <p className="conversationPlaceholder">{conversationStatus || "No saved messages in this conversation."}</p>}
                  </div>
                  {conversationStatus && conversationMessages.length > 0 && <p className="conversationNotice">{conversationStatus}</p>}
                  <div className="quickReplies">
                    <div className="quickReplyHeading"><strong>Quick replies</strong><small>Choose one to fill the message, then edit or send it.</small></div>
                    <div className="quickReplyCategories">
                      {(["general", "content", "custom", "bookings", "video_chat", "ratings", "payment", "boundaries"] as QuickReplyCategory[]).map((category) => <button className={quickReplyCategory === category ? "selected" : ""} key={category} onClick={() => setQuickReplyCategory(category)} type="button">{category === "video_chat" ? "Video chat" : category === "ratings" ? "Dick ratings" : category}</button>)}
                    </div>
                    {quickReplyCategory === "content" && <label className="quickReplyProduct"><span>Video or content</span><select value={quickReplyProductId || quickReplyProducts[0]?.id || 0} onChange={(event) => setQuickReplyProductId(Number(event.target.value))}>{quickReplyProducts.length ? quickReplyProducts.map((product) => <option key={product.id} value={product.id}>{product.title}</option>) : <option value={0}>No active content</option>}</select></label>}
                    <div className="quickReplyOptions">
                      {quickReplyCategory === "general" && <><button onClick={() => fillQuickReply("saw_message")} type="button">Saw your message</button><button onClick={() => fillQuickReply("busy")} type="button">Busy right now</button><button onClick={() => fillQuickReply("anything_else")} type="button">Anything else</button></>}
                      {quickReplyCategory === "content" && <><button onClick={() => fillQuickReply("catalog")} type="button">Show catalog</button><button onClick={() => fillQuickReply("trailer")} type="button">Send trailer for</button><button onClick={() => fillQuickReply("product_details")} type="button">Send details</button><button onClick={() => fillQuickReply("product_payment")} type="button">Payment instructions</button></>}
                      {quickReplyCategory === "custom" && <><button onClick={() => fillQuickReply("custom_start")} type="button">Ask for idea</button><button onClick={() => fillQuickReply("custom_more")} type="button">Anything else</button><button onClick={() => fillQuickReply("custom_review")} type="button">Review request</button><button onClick={() => fillQuickReply("custom_quote")} type="button">Need details first</button></>}
                      {quickReplyCategory === "bookings" && <><button onClick={() => fillQuickReply("booking_options")} type="button">Booking options</button><button onClick={() => fillQuickReply("booking_schedule")} type="button">Date and time</button><button onClick={() => fillQuickReply("booking_contact")} type="button">City and contact</button></>}
                      {quickReplyCategory === "video_chat" && <><button onClick={() => fillQuickReply("video_chat")} type="button">Rate and minimum</button><button onClick={() => fillQuickReply("video_chat_schedule")} type="button">Ask for schedule</button><button onClick={() => fillQuickReply("video_chat_confirm")} type="button">Confirm Telegram call</button></>}
                      {quickReplyCategory === "ratings" && <><button onClick={() => fillQuickReply("rating_offer")} type="button">Offer video rating</button><button onClick={() => fillQuickReply("rating_photo")} type="button">Request photo</button><button onClick={() => fillQuickReply("rating_payment")} type="button">Rating payment</button></>}
                      {quickReplyCategory === "payment" && <><button onClick={() => fillQuickReply("payment_options")} type="button">Payment options</button><button onClick={() => fillQuickReply("payment_screenshot")} type="button">Request screenshot</button><button onClick={() => fillQuickReply("payment_received")} type="button">Payment received</button></>}
                      {quickReplyCategory === "boundaries" && <><button onClick={() => fillQuickReply("telegram_tos")} type="button">Telegram TOS</button><button onClick={() => fillQuickReply("unavailable")} type="button">Cannot help</button></>}
                    </div>
                  </div>
                  <form className="conversationReplyForm" onSubmit={sendConversationReply}>
                    <textarea maxLength={4000} value={conversationReply} onChange={(event) => setConversationReply(event.target.value)} placeholder={`Reply to ${selectedConversation.telegram_name}`} />
                    <div className="conversationReplyActions">
                      <button className="primaryAction" disabled={liveLoading || !conversationReply.trim()}>Send once</button>
                      <button className="secondaryAction" disabled={liveLoading || !conversationReply.trim()} onClick={() => void submitConversationReply(true)} type="button">Send and save for future</button>
                      {Number(selectedConversation.pending_count) > 0 && <button className="ignoreAction" disabled={liveLoading} onClick={() => void dismissConversationRequest()} type="button">Clear request without replying</button>}
                    </div>
                    <small>Sending a reply pauses automatic responses for this chat until you turn Bot replies back on.</small>
                  </form>
                </> : <div className="conversationPlaceholder">Choose a chat to view its recent messages and controls.</div>}
              </div>
            </div>
          </section>

          <section className="announcementCenter dashboardSection dashboardToday">
            <div className="sectionHeading"><strong>Live announcements</strong><span>{announcements.length}</span></div>
            <p className="queueNote">Send a live stream link to every verified fan chat.</p>
            <div className="announcementForm">
              <label><span>Platform</span><select value={announcementForm.platform} onChange={(event) => setAnnouncementForm((current) => ({ ...current, platform: event.target.value }))}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Twitch</option><option>X</option><option>Pornhub</option><option>OnlyFans</option><option>Other</option></select></label>
              <label><span>Live stream link</span><input type="url" required placeholder="https://..." value={announcementForm.stream_url} onChange={(event) => setAnnouncementForm((current) => ({ ...current, stream_url: event.target.value }))} /></label>
              <label className="announcementMessage"><span>Optional message</span><textarea maxLength={500} placeholder="Come hang out with me live!" value={announcementForm.message} onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))} /></label>
              {!announcementPreview ? <button className="primaryAction" type="button" disabled={!announcementForm.stream_url.trim()} onClick={() => setAnnouncementPreview(true)}>Review announcement</button> : <div className="announcementPreview"><strong>Preview</strong><p>I'm live on {announcementForm.platform} right now, babe!</p>{announcementForm.message && <p>{announcementForm.message}</p>}<a href={announcementForm.stream_url} rel="noreferrer" target="_blank">{announcementForm.stream_url}</a><button className="primaryAction" type="button" disabled={liveLoading} onClick={() => void sendAnnouncement()}>Send to verified fans</button><button className="secondaryAction" type="button" disabled={liveLoading} onClick={() => setAnnouncementPreview(false)}>Edit</button></div>}
            </div>
            <div className="announcementHistory">
              {announcements.slice(0, 8).map((announcement) => <article key={announcement.id}><div><strong>{announcement.platform}</strong><a href={announcement.stream_url} rel="noreferrer" target="_blank">Open link</a></div><small>{announcement.status === "sending" ? "Sending now" : `${announcement.delivered_count} delivered${announcement.failed_count ? ` · ${announcement.failed_count} failed` : ""}`} · {new Date(`${announcement.created_at}Z`).toLocaleString()}</small></article>)}
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
                <small>{liveBookings.length} bookings · {liveCustoms.length} customs · {livePurchases.length} deliveries · {physicalOrders.length} shipments · {ratingOrders.length} ratings · {sextingSessions.length} sexting sessions</small>
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
                <p>{order.status === "awaiting_photo" ? "Waiting for the client to send their photo." : "Photo received. Reply to the client with a short video clip in Telegram. The task completes automatically when the clip is sent."}</p>
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
              {productForm.content_type === "video_rating" && <label><span>Telegram Stars price</span><input inputMode="numeric" min="1" required type="number" step="1" value={productForm.stars_price} onChange={(event) => setProductForm((current) => ({ ...current, stars_price: event.target.value }))} placeholder="5000" /><small>Set this separately from the listed dollar value because Telegram’s Star exchange rate can vary.</small></label>}
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
                  <div><strong>{product.title}</strong><small>{product.content_type.replaceAll("_", " ")} · {money(product.price_cents)}{product.content_type === "video_rating" ? ` · ⭐ ${product.stars_price.toLocaleString()}` : ""}{product.genre ? ` · Tags: ${product.genre}` : ""}{product.media_count ? ` · ${product.media_count} uploaded file${product.media_count === 1 ? "" : "s"}` : ""}</small></div>
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

          {livePurchases.length ? (
            <div className="takeoverCard purchaseApproval dashboardSection dashboardToday">
              <div className="alertTitle"><span>$</span> Payment approval</div>
              <p className="fanQuestion">{livePurchases[0].product_title}</p>
              <div className="purchasePrice">{livePurchases[0].price}</div>
              <small>Requested {new Date(`${livePurchases[0].created_at}Z`).toLocaleDateString()}</small>
              <div className="botPaused">Fan message: “{livePurchases[0].payment_note}”</div>
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolvePurchase("approve")}>
                {livePurchases[0].content_type === "physical_item" ? "Approve payment and collect shipping" : livePurchases[0].content_type === "video_rating" ? "Approve payment and request photo" : "Approve and send content"}
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
              {bookingType === "custom_content" ? <label className="amountField">
                <span>Custom quote total</span>
                <input inputMode="decimal" min="1" onChange={(event) => setBookingAmount(event.target.value)} placeholder="Enter the amount Tiffani wants to charge" type="number" value={bookingAmount} />
              </label> : <div className="calculatedTotal">
                Total: {money(Math.round(Number(bookingDuration || 0) * Number(bookingType === "in_person" ? settings.in_person_rate : settings.video_chat_rate) * 100))}
                {bookingType === "in_person" && <small>Excluded from earnings</small>}
              </div>}
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveBooking("approve")}>
                {bookingType === "custom_content" ? "Accept custom and send quote" : "Approve booking and send"}
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
          ) : livePending.length ? (
            <div className="inboxQueueNotice dashboardSection dashboardToday">
              <span className="inboxQueueIcon">!</span>
              <div>
                <strong>{livePending.length} {livePending.length === 1 ? "chat needs" : "chats need"} your reply</strong>
                <small>Open the Inbox to review the conversation and respond.</small>
              </div>
              <button
                className="primaryAction"
                onClick={() => {
                  const conversation = conversations.find((item) => Number(item.pending_count) > 0);
                  if (conversation) openConversationFromAdmin(conversation.chat_id);
                  else setDashboardView("inbox");
                }}
                type="button"
              >
                Open inbox
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
            <div><span>Fast testing mode</span><button className="settingToggle" onClick={() => changeSetting("response_test_mode", settings.response_test_mode === "on" ? "off" : "on")}>{settings.response_test_mode}</button></div>
            <div className="rateSetting"><span>Sleep time</span><label><input aria-label="Sleep start time" onChange={(event) => changeSetting("sleep_start", event.target.value)} type="time" value={settings.sleep_start} /></label></div>
            <div className="rateSetting"><span>Wake time</span><label><input aria-label="Wake time" onChange={(event) => changeSetting("sleep_end", event.target.value)} type="time" value={settings.sleep_end} /></label></div>
            <div><span>Sexting intensity</span><section>{(["soft", "hard", "hot"] as const).map((value) => <button className={settings.sexting_intensity === value ? "selected" : ""} key={value} onClick={() => changeSetting("sexting_intensity", value)}>{value}</button>)}</section></div>
            <div className="rateSetting"><span>Video chat per minute</span><label>$<input aria-label="Video chat rate per minute" inputMode="decimal" min="1" onChange={(event) => changeSetting("video_chat_rate", event.target.value)} type="number" value={settings.video_chat_rate} /></label></div>
            <div className="rateSetting"><span>In person meet per hour</span><label>$<input aria-label="In person meet rate per hour" inputMode="decimal" min="1" onChange={(event) => changeSetting("in_person_rate", event.target.value)} type="number" value={settings.in_person_rate} /></label></div>
            <div className="rateSetting"><span>Dick rating price</span><label>$<input aria-label="Dick rating price" inputMode="decimal" min="1" onChange={(event) => changeSetting("video_rating_rate", event.target.value)} step="0.01" type="number" value={settings.video_rating_rate} /></label></div>
            <div className="rateSetting"><span>Dick rating Stars price</span><label>⭐<input aria-label="Dick rating price in Telegram Stars" inputMode="numeric" min="1" onChange={(event) => changeSetting("video_rating_stars", event.target.value)} step="1" type="number" value={settings.video_rating_stars} /></label></div>
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
            <p className="queueNote">Add, edit, or delete instructions. Choose Topic to avoid for a removable creator boundary. Saved changes apply to the bot immediately.</p>
            <form onSubmit={addTrainingSuggestion}>
              <label><span>Training type</span><select value={trainingForm.category} onChange={(event) => setTrainingForm((current) => ({ ...current, category: event.target.value as TrainingSuggestion["category"] }))}><option value="topic">Topic to discuss</option><option value="avoid">Topic to avoid</option><option value="tone">Tone instruction</option><option value="feedback">Behavior feedback</option></select></label>
              <label><span>Suggestion</span><textarea required maxLength={1000} placeholder="Add one clear instruction..." value={trainingForm.suggestion} onChange={(event) => setTrainingForm((current) => ({ ...current, suggestion: event.target.value }))} /></label>
              <button className="primaryAction" disabled={liveLoading}>{editingTrainingId ? "Save changes" : "Add training suggestion"}</button>
              {editingTrainingId && <button className="secondaryAction" type="button" onClick={cancelTrainingEdit}>Cancel editing</button>}
            </form>
            <div className="trainingSuggestionList">
              {trainingSuggestions.map((item) => <article key={item.id}><div><span>{item.category === "topic" ? "Talk about" : item.category === "avoid" ? "Avoid" : item.category === "tone" ? "Tone" : "Feedback"}</span><p>{item.suggestion}</p></div><button type="button" disabled={liveLoading} onClick={() => editTrainingSuggestion(item)}>Edit</button><button type="button" disabled={liveLoading} onClick={() => void deleteTrainingSuggestion(item.id)}>Delete</button></article>)}
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
