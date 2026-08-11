"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Message = {
  id: number;
  role: "bot" | "fan" | "system";
  text: string;
  time: string;
};

type LivePendingReply = {
  id: number;
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
  status?: "awaiting_fulfillment" | "completed" | "cancelled" | "closed_unpaid";
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
    text: "Before you join, I have to make sure you're 18+. Can you say yes or no?",
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
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productUploadKey, setProductUploadKey] = useState(0);
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
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
  const [settings, setSettings] = useState<CreatorSettings>({ flirty_level: "very", human_takeover: "on", learning: "approval", custom_approval: "required", video_chat_rate: "50", custom_content_rate: "50", in_person_rate: "1500", preferred_topics: "", avoid_topics: "", tone_guidance: "Short, blunt, warm, confident, flirty, and natural", creator_feedback: "", sexting_enabled: "on", sexting_intensity: "soft", sexting_rate: "10", sexting_min_minutes: "5", sexting_5_stars: "500", sexting_10_stars: "1000", sleep_hours_enabled: "on", sleep_start: "02:00", sleep_end: "08:00" });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dashboardView, setDashboardView] = useState<"today" | "content" | "settings" | "history">("today");
  const previousAttentionCount = useRef<number | null>(null);
  const settingsDirtyRef = useRef(false);

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { portal_user: PortalUser; platform_overview: PlatformOverview | null; pending: LivePendingReply[]; purchases: LivePurchase[]; purchase_history: LivePurchase[]; bookings: LiveBooking[]; customs: LiveCustom[]; custom_history: LiveCustom[]; sexting_sessions: LiveSextingSession[]; sexting_history: LiveSextingSession[]; sexting_media: SextingMedia[]; sexting_scripts: SextingScript[]; daily_tasks: DailyTask[]; physical_orders: PhysicalOrder[]; physical_order_history: PhysicalOrder[]; rating_orders: RatingOrder[]; rating_order_history: RatingOrder[]; announcements: Announcement[]; social_links: SocialLink[]; training_suggestions: TrainingSuggestion[]; sale_disputes: SaleDispute[]; products: ContentProduct[]; stars: { total: number; count: number }; learned_count: number; earnings: EarningsSummary; settings: CreatorSettings };
      setPortalUser(data.portal_user);
      setPlatformOverview(data.platform_overview);
      setLivePending(data.pending);
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
    const timer = window.setInterval(() => void loadLivePending(), 15000);
    return () => window.clearInterval(timer);
  }, [loadLivePending]);

  const statusText = useMemo(() => {
    if (blocked) return "Conversation closed";
    if (!verified) return "Waiting for age confirmation";
    if (livePurchases.length) return "Payment approval needed";
    if (sextingSessions.length) return "Paid sexting session waiting";
    if (liveCustoms.length) return "Custom content to fulfill";
    if (liveBookings.length) return "Booking approval needed";
    if (livePending.length) return "Tiffani reply needed";
    return "AI assistant active";
  }, [blocked, liveBookings.length, liveCustoms.length, livePending.length, livePurchases.length, sextingSessions.length, verified]);

  const attentionCount = livePending.length + livePurchases.length + liveBookings.length + liveCustoms.length + sextingSessions.length;
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
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action, answer, service_type: bookingType, duration: bookingDuration }),
      });
      if (!response.ok) throw new Error("Booking update failed");
      setCreatorReply("");
      setBookingDuration("");
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
    if (!mediaFile || !mediaLabel.trim()) return;
    try {
      setLiveLoading(true);
      const form = new FormData();
      form.set("label", mediaLabel.trim());
      form.set("file", mediaFile);
      const response = await fetch("/api/admin/sexting-media", { method: "POST", body: form });
      if (!response.ok) throw new Error("Upload failed");
      setMediaLabel("");
      setMediaFile(null);
      await loadLivePending();
    } catch {
      setLiveError("The photo or video could not be uploaded. Please try again.");
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
      const response = await fetch(editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(productForm),
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
    setProductFiles([]);
    setProductUploadKey((current) => current + 1);
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
      const entries = Object.entries(settings).filter(([key]) => key !== "human_takeover");
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
            <span>Telegram pilot</span>
          </div>
        </div>
        <div className="topActions">
          {portalUser && <span className="accountBadge">{portalUser.role === "owner" ? "Owner" : "Creator"} · {portalUser.email}</span>}
          <span className={`statusPill ${livePending.length || livePurchases.length || liveBookings.length || liveCustoms.length || sextingSessions.length ? "needsReply" : ""}`}>
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
        <aside className="sidePanel">
          <p className="eyebrow">Creator operations</p>
          <h1>Everything you need in one place.</h1>
          <p className="intro">
            Manage Telegram conversations, tasks, sales, content, bookings, and creator settings.
          </p>

          <div className="profileCard">
            <div className="avatar">T</div>
            <div>
              <strong>Tiffani Madison</strong>
              <span>Soft and sweet · switch domme</span>
            </div>
            <span className="onlineDot" aria-label="Online" />
          </div>

          <div className="metricGrid">
            <div><strong>18+</strong><span>Age gate</span></div>
            <div><strong>{savedAnswers}</strong><span>Learned replies</span></div>
            <div><strong>{livePending.length + livePurchases.length + liveBookings.length}</strong><span>Needs Tiffani</span></div>
            <div><strong>Very</strong><span>Flirty level</span></div>
          </div>

          <div className="ruleCard">
            <div className="ruleIcon">♡</div>
            <div>
              <strong>Voice active</strong>
              <p>Short, blunt, lightly flirty, and confident with occasional emojis.</p>
            </div>
          </div>
          <div className="ruleCard safe">
            <div className="ruleIcon">✓</div>
            <div>
              <strong>Safety active</strong>
              <p>Adults only. Consent required. Private information stays private.</p>
            </div>
          </div>
        </aside>

        <aside className="creatorPanel visible" data-dashboard-view={dashboardView}>
          <nav className="controlRoomNav" aria-label="Control room sections">
            {(["today", "content", "settings", "history"] as const).map((view) => (
              <button className={dashboardView === view ? "active" : ""} key={view} onClick={() => setDashboardView(view)} type="button">
                {view === "today" ? "Today" : view === "content" ? "Content" : view === "settings" ? "Settings" : "History"}
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
                <div><strong>Sale catalog</strong><p>Add every photo set, video, or bundle being offered, including its title, price, genre, actors, preview link, and private Dropbox delivery link.</p><small>{contentProducts.length} product{contentProducts.length === 1 ? "" : "s"} added</small></div>
              </article>
            </div>
            <p className="onboardingConsent">Only upload media the creator owns or is authorized to use. Every depicted participant must be an adult and have consented to the content and its distribution.</p>
          </section>

          <section className="mediaLibrary dashboardSection dashboardContent">
            <div className="sectionHeading"><strong>Sexting media library</strong><span>{sextingMedia.length}</span></div>
            <form onSubmit={uploadSextingMedia}>
              <label><span>Photo or video label</span><input onChange={(event) => setMediaLabel(event.target.value)} placeholder="Pink lingerie tease" value={mediaLabel} /></label>
              <label><span>Upload approved media</span><input accept="image/*,video/*" onChange={(event) => setMediaFile(event.target.files?.[0] || null)} type="file" /></label>
              <button className="primaryAction" disabled={liveLoading || !mediaFile || !mediaLabel.trim()}>Upload media</button>
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
              <label><span>Genre</span><input value={productForm.genre} onChange={(event) => setProductForm((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre" /></label>
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
                  <div><strong>{product.title}</strong><small>{product.content_type.replaceAll("_", " ")} · {money(product.price_cents)}{product.content_type === "video_rating" ? ` · ⭐ ${product.stars_price.toLocaleString()}` : ""}{product.media_count ? ` · ${product.media_count} uploaded file${product.media_count === 1 ? "" : "s"}` : ""}</small></div>
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
              <strong>Customs to fulfill</strong>
              <span>{liveCustoms.length}</span>
            </div>
            {liveCustoms.length ? liveCustoms.map((custom) => (
              <div className="customCard" key={custom.id}>
                <div className="customMeta">
                  <strong>{custom.telegram_name}</strong>
                  <span>{custom.duration_minutes} minutes · {money(custom.amount_cents)}</span>
                </div>
                <p>{custom.description}</p>
                <label className="amountField">
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
                <button className="secondaryAction" disabled={liveLoading} onClick={() => void cancelCustom(custom.id)}>
                  Cancel custom
                </button>
              </div>
            )) : <p className="queueNote">No customs waiting to be fulfilled.</p>}
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
                <input inputMode="decimal" min={bookingType === "in_person" ? "1" : "5"} onChange={(event) => setBookingDuration(event.target.value)} placeholder={bookingType === "in_person" ? "1" : "5"} value={bookingDuration} />
              </label>
              <div className="calculatedTotal">
                Total: {money(Math.round(Number(bookingDuration || 0) * Number(bookingType === "in_person" ? settings.in_person_rate : bookingType === "custom_content" ? settings.custom_content_rate : settings.video_chat_rate) * 100))}
                {bookingType === "in_person" && <small>Excluded from earnings</small>}
              </div>
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveBooking("approve")}>
                {bookingType === "custom_content" ? "Accept custom" : "Approve booking and send"}
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
            <div className="takeoverCard dashboardSection dashboardToday">
              <div className="alertTitle"><span>!</span> Reply requested</div>
              <p className="fanQuestion">“{livePending[0].question}”</p>
              <div className="botPaused">The bot stayed silent so you can answer personally.</div>
              <textarea
                aria-label="Creator reply"
                onChange={(event) => setCreatorReply(event.target.value)}
                placeholder="Type as Tiffani..."
                value={creatorReply}
              />
              {settings.learning === "approval" && (
                <button className="primaryAction" disabled={liveLoading} onClick={() => void sendLiveCreatorReply(true)}>
                  Send and save for later
                </button>
              )}
              <button className="secondaryAction" disabled={liveLoading} onClick={() => void sendLiveCreatorReply(false)}>
                Send once
              </button>
              <button className="ignoreAction" disabled={liveLoading} onClick={() => void ignoreLiveQuestion()}>
                Ignore
              </button>
            </div>
          ) : (
            <div className="emptyQueue dashboardSection dashboardToday">
              <span>✓</span>
              <h3>{liveLoading ? "Checking live messages" : "You're all caught up"}</h3>
              <p>{liveError || "Unanswered questions and payment approvals will appear here automatically."}</p>
            </div>
          )}

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
            <div className="rateSetting"><span>Custom content per minute</span><label>$<input aria-label="Custom content rate per minute" inputMode="decimal" min="1" onChange={(event) => changeSetting("custom_content_rate", event.target.value)} type="number" value={settings.custom_content_rate} /></label></div>
            <div className="rateSetting"><span>In person meet per hour</span><label>$<input aria-label="In person meet rate per hour" inputMode="decimal" min="1" onChange={(event) => changeSetting("in_person_rate", event.target.value)} type="number" value={settings.in_person_rate} /></label></div>
            <div className="rateSetting"><span>Sexting per minute</span><label>$<input aria-label="Sexting rate per minute" inputMode="decimal" min="1" onChange={(event) => changeSetting("sexting_rate", event.target.value)} type="number" value={settings.sexting_rate} /></label></div>
            <div className="rateSetting"><span>Sexting minimum minutes</span><label><input aria-label="Minimum sexting session length" inputMode="numeric" min="1" max="9" onChange={(event) => changeSetting("sexting_min_minutes", event.target.value)} type="number" value={settings.sexting_min_minutes} /></label></div>
            <div className="rateSetting"><span>{settings.sexting_min_minutes || "5"} minute Stars price</span><label>⭐<input aria-label="Minimum sexting package price in Stars" inputMode="numeric" min="1" onChange={(event) => changeSetting("sexting_5_stars", event.target.value)} type="number" value={settings.sexting_5_stars} /></label></div>
            <div className="rateSetting"><span>10 minute Stars price</span><label>⭐<input aria-label="10 minute sexting price in Stars" inputMode="numeric" min="1" onChange={(event) => changeSetting("sexting_10_stars", event.target.value)} type="number" value={settings.sexting_10_stars} /></label></div>
            <div><span>Age gate</span><strong>Required</strong></div>
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
              <p>Politics, religion, underage people, minors, kids, children, rape and nonconsensual activity, scat, pee, poop, urine, watersports, and bathroom play. These cannot be edited or deleted.</p>
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
