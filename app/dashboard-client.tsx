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
  status?: "pending" | "approved" | "declined";
  resolved_at?: string;
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
  completed_at?: string;
};

type LiveSextingSession = {
  id: number;
  telegram_name: string;
  package_title: string;
  duration_minutes: number;
  stars: number;
  status: "paid" | "active" | "completed";
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
  content_type: "photo" | "photo_package" | "video" | "video_bundle";
  title: string;
  price_cents: number;
  genre: string;
  actors: string;
  trailer_url: string;
  delivery_url: string;
  active: number;
  created_at: string;
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
  sexting_test_mode: "on" | "off";
  sexting_intensity: "soft" | "hard" | "hot";
  sexting_rate: string;
  sexting_5_stars: string;
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementForm, setAnnouncementForm] = useState({ platform: "Instagram", message: "", stream_url: "" });
  const [announcementPreview, setAnnouncementPreview] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialForm, setSocialForm] = useState({ platform: "Instagram", label: "", url: "" });
  const [trainingSuggestions, setTrainingSuggestions] = useState<TrainingSuggestion[]>([]);
  const [trainingForm, setTrainingForm] = useState({ category: "topic" as TrainingSuggestion["category"], suggestion: "" });
  const [agendaDate, setAgendaDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()));
  const [taskForm, setTaskForm] = useState({ title: "", task_type: "video_chat" as DailyTask["task_type"], scheduled_at: "", fan_name: "", details: "", amount: "" });
  const [scriptForm, setScriptForm] = useState({ stage: "warmup" as SextingScript["stage"], title: "", script_text: "", media_label: "" });
  const [productForm, setProductForm] = useState({ content_type: "video" as ContentProduct["content_type"], title: "", price: "", genre: "", actors: "", trailer_url: "", delivery_url: "" });
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [customLinks, setCustomLinks] = useState<Record<number, string>>({});
  const [earnings, setEarnings] = useState<EarningsSummary>({ weekly_cents: 0, weekly_count: 0, all_time_cents: 0, all_time_count: 0, recent: [], history: [] });
  const [earningsView, setEarningsView] = useState<"weekly" | "all" | null>(null);
  const [bookingType, setBookingType] = useState<"video_chat" | "custom_content" | "in_person">("video_chat");
  const [bookingDuration, setBookingDuration] = useState("");
  const [settings, setSettings] = useState<CreatorSettings>({ flirty_level: "very", human_takeover: "on", learning: "approval", custom_approval: "required", video_chat_rate: "50", custom_content_rate: "50", in_person_rate: "1500", preferred_topics: "", avoid_topics: "", tone_guidance: "Short, blunt, warm, confident, flirty, and natural", creator_feedback: "", sexting_enabled: "on", sexting_test_mode: "on", sexting_intensity: "soft", sexting_rate: "10", sexting_5_stars: "3850", sleep_hours_enabled: "on", sleep_start: "02:00", sleep_end: "08:00" });
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const previousAttentionCount = useRef<number | null>(null);

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { pending: LivePendingReply[]; purchases: LivePurchase[]; purchase_history: LivePurchase[]; bookings: LiveBooking[]; customs: LiveCustom[]; custom_history: LiveCustom[]; sexting_sessions: LiveSextingSession[]; sexting_history: LiveSextingSession[]; sexting_media: SextingMedia[]; sexting_scripts: SextingScript[]; daily_tasks: DailyTask[]; announcements: Announcement[]; social_links: SocialLink[]; training_suggestions: TrainingSuggestion[]; products: ContentProduct[]; stars: { total: number; count: number }; learned_count: number; earnings: EarningsSummary; settings: CreatorSettings };
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
      setAnnouncements(data.announcements || []);
      setSocialLinks(data.social_links || []);
      setTrainingSuggestions(data.training_suggestions || []);
      if (data.bookings[0]?.suggested_type) setBookingType(data.bookings[0].suggested_type);
      setEarnings(data.earnings);
      setSettings(data.settings);
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

  async function resolvePurchase(action: "approve" | "decline") {
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

  async function resolveBooking(action: "approve" | "decline" | "ignore") {
    const current = liveBookings[0];
    if (!current) return;
    const answer = creatorReply.trim();
    if (action !== "ignore" && !answer) return;
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
        body: JSON.stringify({ id, delivery_url: deliveryUrl }),
      });
      if (!response.ok) throw new Error("Custom delivery failed");
      setCustomLinks((current) => ({ ...current, [id]: "" }));
      await loadLivePending();
    } catch {
      setLiveError("The custom link was not sent. Check the link and try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function updateSextingSession(id: number, action: "start" | "complete") {
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
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(productForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Product could not be added");
      }
      setProductForm({ content_type: "video", title: "", price: "", genre: "", actors: "", trailer_url: "", delivery_url: "" });
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The content could not be added. Please try again.");
    } finally {
      setLiveLoading(false);
    }
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

  async function updateSetting<K extends keyof CreatorSettings>(key: K, value: CreatorSettings[K]) {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) throw new Error("Setting update failed");
      setSettings((current) => ({ ...current, [key]: value }));
      setLiveError("");
    } catch {
      setLiveError("The setting could not be changed. Please try again.");
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
      const response = await fetch("/api/admin/social-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(socialForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Social link could not be added");
      }
      setSocialForm({ platform: "Instagram", label: "", url: "" });
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The social link could not be added.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function deleteSocialLink(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/social-links/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Social link could not be removed");
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
      const response = await fetch("/api/admin/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trainingForm),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Training suggestion could not be added");
      }
      setTrainingForm((current) => ({ ...current, suggestion: "" }));
      await loadLivePending();
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "The training suggestion could not be added.");
    } finally {
      setLiveLoading(false);
    }
  }

  async function deleteTrainingSuggestion(id: number) {
    try {
      setLiveLoading(true);
      const response = await fetch(`/api/admin/training/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Training suggestion could not be removed");
      await loadLivePending();
    } catch {
      setLiveError("The training suggestion could not be removed. Please try again.");
    } finally {
      setLiveLoading(false);
    }
  }

  const selectedAgendaTasks = dailyTasks.filter((task) => task.scheduled_at.slice(0, 10) === agendaDate);
  const openAgendaCount = selectedAgendaTasks.filter((task) => task.status === "open").length;
  const unscheduledCount = liveBookings.length + liveCustoms.length + livePurchases.length + sextingSessions.length;

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
          <span className={`statusPill ${livePending.length || livePurchases.length || liveBookings.length || liveCustoms.length || sextingSessions.length ? "needsReply" : ""}`}>
            <i /> {statusText}
          </span>
          <button className="ghostButton" onClick={() => void enableNotifications()}>{notificationsEnabled ? "Alerts on" : "Enable alerts"}</button>
        </div>
      </header>

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

        <aside className="creatorPanel visible">
          <div className="creatorHeader">
            <div>
              <p className="eyebrow">Creator inbox</p>
              <h2>Tiffani control room</h2>
            </div>
            <span className="liveBadge">Live</span>
          </div>

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
                  <strong>{money(item.amount_cents)}</strong>
                </div>
              )) : <p>No sales in this period.</p>}
              <div className="historyTotal"><span>Total</span><strong>{money(earningsView === "weekly" ? earnings.weekly_cents : earnings.all_time_cents)}</strong></div>
            </section>
          )}

          <section className="starsOverview">
            <span>Telegram Stars earned</span>
            <strong>⭐ {starsSummary.total.toLocaleString()}</strong>
            <small>{starsSummary.count} paid sexting sessions</small>
          </section>

          <section className="announcementCenter">
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

          <section className="dailyAgenda">
            <div className="sectionHeading"><strong>Daily task list</strong><span>{openAgendaCount}</span></div>
            <div className="agendaControls">
              <label><span>Day</span><input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /></label>
              <small>Pacific time</small>
            </div>
            {unscheduledCount > 0 && (
              <div className="needsScheduling">
                <strong>{unscheduledCount} items need attention</strong>
                <small>{liveBookings.length} bookings · {liveCustoms.length} customs · {livePurchases.length} deliveries · {sextingSessions.length} sexting sessions</small>
              </div>
            )}
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

          <section className="sextingQueue">
            <div className="sectionHeading"><strong>Sexting sessions</strong><span>{sextingSessions.length}</span></div>
            {sextingSessions.length ? sextingSessions.map((session) => (
              <div className="sessionCard" key={session.id}>
                <div className="customMeta"><strong>{session.telegram_name}</strong><span>⭐ {session.stars.toLocaleString()}</span></div>
                <p>{session.package_title}</p>
                <small>{session.status === "paid" ? "Paid and waiting to start" : `Active until ${session.ends_at ? new Date(`${session.ends_at}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "complete"}`}</small>
                <button className="primaryAction" disabled={liveLoading} onClick={() => void updateSextingSession(session.id, session.status === "paid" ? "start" : "complete")}>
                  {session.status === "paid" ? "Start session" : "Complete session"}
                </button>
              </div>
            )) : <p className="queueNote">No paid sexting sessions waiting.</p>}
          </section>

          <section className="mediaLibrary">
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

          <section className="scriptLibrary">
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

          <section className="contentCatalog">
            <div className="sectionHeading"><strong>Content catalog</strong><span>{contentProducts.length}</span></div>
            <p className="queueNote">The newest active item is what the bot offers first.</p>
            <form onSubmit={addContentProduct}>
              <label><span>Content type</span><select value={productForm.content_type} onChange={(event) => setProductForm((current) => ({ ...current, content_type: event.target.value as ContentProduct["content_type"] }))}><option value="photo">Photo</option><option value="photo_package">Photo package</option><option value="video">Video</option><option value="video_bundle">Video bundle</option></select></label>
              <label><span>Title</span><input required value={productForm.title} onChange={(event) => setProductForm((current) => ({ ...current, title: event.target.value }))} placeholder="Content title" /></label>
              <label><span>Price</span><input inputMode="decimal" min="1" required type="number" step="0.01" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="24.99" /></label>
              <label><span>Genre</span><input value={productForm.genre} onChange={(event) => setProductForm((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre" /></label>
              <label><span>Actors</span><input value={productForm.actors} onChange={(event) => setProductForm((current) => ({ ...current, actors: event.target.value }))} placeholder="Names separated by commas" /></label>
              <label><span>Trailer or preview link</span><input type="url" value={productForm.trailer_url} onChange={(event) => setProductForm((current) => ({ ...current, trailer_url: event.target.value }))} placeholder="https://..." /></label>
              <label><span>Full delivery link</span><input required type="url" value={productForm.delivery_url} onChange={(event) => setProductForm((current) => ({ ...current, delivery_url: event.target.value }))} placeholder="https://..." /></label>
              <button className="primaryAction" disabled={liveLoading}>Add content</button>
            </form>
            <div className="catalogList">
              {contentProducts.map((product) => (
                <article className={product.active ? "" : "inactive"} key={product.id}>
                  <div><strong>{product.title}</strong><small>{product.content_type.replaceAll("_", " ")} · {money(product.price_cents)}</small></div>
                  <span>{product.active ? "Active" : "Hidden"}</span>
                  <button type="button" onClick={() => void updateContentProduct(product.id, "toggle", Boolean(product.active))}>{product.active ? "Hide" : "Activate"}</button>
                  <button type="button" onClick={() => void updateContentProduct(product.id, "remove")}>Remove</button>
                </article>
              ))}
            </div>
          </section>

          <section className="customQueue">
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
                <button className="primaryAction" disabled={liveLoading || !customLinks[custom.id]?.trim()} onClick={() => void completeCustom(custom.id)}>
                  Send custom and complete
                </button>
              </div>
            )) : <p className="queueNote">No customs waiting to be fulfilled.</p>}
          </section>

          {livePurchases.length ? (
            <div className="takeoverCard purchaseApproval">
              <div className="alertTitle"><span>$</span> Payment approval</div>
              <p className="fanQuestion">{livePurchases[0].product_title}</p>
              <div className="purchasePrice">{livePurchases[0].price}</div>
              <div className="botPaused">Fan message: “{livePurchases[0].payment_note}”</div>
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolvePurchase("approve")}>
                Approve and send full video
              </button>
              <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolvePurchase("decline")}>
                Payment not verified
              </button>
            </div>
          ) : liveBookings.length ? (
            <div className="takeoverCard bookingApproval">
              <div className="alertTitle"><span>□</span> {liveBookings[0].suggested_type === "custom_content" ? "Custom request" : "Booking request"}</div>
              <div className="requestOwner">{liveBookings[0].telegram_name}</div>
              <p className="fanQuestion">“{liveBookings[0].details}”</p>
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
                {bookingType === "custom_content" ? "Approve custom and send" : "Approve booking and send"}
              </button>
              <button className="secondaryAction" disabled={liveLoading} onClick={() => void resolveBooking("decline")}>
                Decline and send reply
              </button>
              <button className="ignoreAction" disabled={liveLoading} onClick={() => void resolveBooking("ignore")}>
                Ignore
              </button>
            </div>
          ) : livePending.length ? (
            <div className="takeoverCard">
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
            <div className="emptyQueue">
              <span>✓</span>
              <h3>{liveLoading ? "Checking live messages" : "You're all caught up"}</h3>
              <p>{liveError || "Unanswered questions and payment approvals will appear here automatically."}</p>
            </div>
          )}

          <div className="testPrompts">
            <strong>Quick test prompts</strong>
            <button onClick={() => { setInput("Can I get a custom video?"); setCreatorMode(false); }}>Custom request</button>
            <button onClick={() => { setInput("What anime do you like?"); setCreatorMode(false); }}>Personality question</button>
            <button onClick={() => { setInput("I want to book a call"); setCreatorMode(false); }}>Booking request</button>
          </div>

          <div className="personaSummary settingsPanel">
            <div>
              <span>Flirty level</span>
              <section>{(["soft", "flirty", "very"] as const).map((value) => <button className={settings.flirty_level === value ? "selected" : ""} key={value} onClick={() => void updateSetting("flirty_level", value)}>{value}</button>)}</section>
            </div>
            <div><span>Human takeover</span><button className="settingToggle" onClick={() => void updateSetting("human_takeover", settings.human_takeover === "on" ? "off" : "on")}>{settings.human_takeover}</button></div>
            <div><span>Learning</span><button className="settingToggle" onClick={() => void updateSetting("learning", settings.learning === "approval" ? "off" : "approval")}>{settings.learning === "approval" ? "Approval only" : "Off"}</button></div>
            <div><span>Custom approval</span><button className="settingToggle" onClick={() => void updateSetting("custom_approval", settings.custom_approval === "required" ? "off" : "required")}>{settings.custom_approval === "required" ? "Required" : "Off"}</button></div>
            <div><span>Sexting</span><button className="settingToggle" onClick={() => void updateSetting("sexting_enabled", settings.sexting_enabled === "on" ? "off" : "on")}>{settings.sexting_enabled}</button></div>
            <div><span>Free sexting test mode</span><button className="settingToggle" onClick={() => void updateSetting("sexting_test_mode", settings.sexting_test_mode === "on" ? "off" : "on")}>{settings.sexting_test_mode}</button></div>
            <div><span>Sleep hours</span><button className="settingToggle" onClick={() => void updateSetting("sleep_hours_enabled", settings.sleep_hours_enabled === "on" ? "off" : "on")}>{settings.sleep_hours_enabled}</button></div>
            <div className="rateSetting"><span>Sleep time</span><label><input aria-label="Sleep start time" onBlur={() => void updateSetting("sleep_start", settings.sleep_start)} onChange={(event) => setSettings((current) => ({ ...current, sleep_start: event.target.value }))} type="time" value={settings.sleep_start} /></label></div>
            <div className="rateSetting"><span>Wake time</span><label><input aria-label="Wake time" onBlur={() => void updateSetting("sleep_end", settings.sleep_end)} onChange={(event) => setSettings((current) => ({ ...current, sleep_end: event.target.value }))} type="time" value={settings.sleep_end} /></label></div>
            <div><span>Sexting intensity</span><section>{(["soft", "hard", "hot"] as const).map((value) => <button className={settings.sexting_intensity === value ? "selected" : ""} key={value} onClick={() => void updateSetting("sexting_intensity", value)}>{value}</button>)}</section></div>
            <div className="rateSetting"><span>Video chat per minute</span><label>$<input aria-label="Video chat rate per minute" inputMode="decimal" min="1" onBlur={() => void updateSetting("video_chat_rate", settings.video_chat_rate)} onChange={(event) => setSettings((current) => ({ ...current, video_chat_rate: event.target.value }))} type="number" value={settings.video_chat_rate} /></label></div>
            <div className="rateSetting"><span>Custom content per minute</span><label>$<input aria-label="Custom content rate per minute" inputMode="decimal" min="1" onBlur={() => void updateSetting("custom_content_rate", settings.custom_content_rate)} onChange={(event) => setSettings((current) => ({ ...current, custom_content_rate: event.target.value }))} type="number" value={settings.custom_content_rate} /></label></div>
            <div className="rateSetting"><span>In person meet per hour</span><label>$<input aria-label="In person meet rate per hour" inputMode="decimal" min="1" onBlur={() => void updateSetting("in_person_rate", settings.in_person_rate)} onChange={(event) => setSettings((current) => ({ ...current, in_person_rate: event.target.value }))} type="number" value={settings.in_person_rate} /></label></div>
            <div className="rateSetting"><span>Sexting per minute</span><label>$<input aria-label="Sexting rate per minute" inputMode="decimal" min="1" onBlur={() => void updateSetting("sexting_rate", settings.sexting_rate)} onChange={(event) => setSettings((current) => ({ ...current, sexting_rate: event.target.value }))} type="number" value={settings.sexting_rate} /></label></div>
            <div><span>Sexting minimum</span><strong>5 minutes</strong></div>
            <div className="rateSetting"><span>5 minute Stars price</span><label>⭐<input aria-label="5 minute sexting price in Stars" inputMode="numeric" min="1" onBlur={() => void updateSetting("sexting_5_stars", settings.sexting_5_stars)} onChange={(event) => setSettings((current) => ({ ...current, sexting_5_stars: event.target.value }))} type="number" value={settings.sexting_5_stars} /></label></div>
            <div><span>Age gate</span><strong>Required</strong></div>
          </div>

          <div className="creatorProfileLinks">
            <div className="sectionHeading"><strong>Approved social links</strong><span>{socialLinks.length}</span></div>
            <p className="queueNote">The bot shares only links shown here.</p>
            <form onSubmit={addSocialLink}>
              <label><span>Platform</span><select value={socialForm.platform} onChange={(event) => setSocialForm((current) => ({ ...current, platform: event.target.value }))}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Twitch</option><option>X</option><option>Pornhub</option><option>OnlyFans</option><option>All links</option><option>Other</option></select></label>
              <label><span>Display name</span><input required placeholder="@username or profile name" value={socialForm.label} onChange={(event) => setSocialForm((current) => ({ ...current, label: event.target.value }))} /></label>
              <label><span>Profile link</span><input required type="url" placeholder="https://..." value={socialForm.url} onChange={(event) => setSocialForm((current) => ({ ...current, url: event.target.value }))} /></label>
              <button className="primaryAction" disabled={liveLoading}>Add social link</button>
            </form>
            <div className="socialLinkList">
              {socialLinks.map((link) => <article key={link.id}><a href={link.url} rel="noreferrer" target="_blank"><span>{link.platform}</span><b>{link.label}</b></a><button type="button" disabled={liveLoading} onClick={() => void deleteSocialLink(link.id)}>Delete</button></article>)}
            </div>
          </div>

          <section className="conversationTraining">
            <div className="sectionHeading"><strong>Conversation training</strong><span>{trainingSuggestions.length}</span></div>
            <p className="queueNote">Add or delete individual instructions. Changes affect future bot replies.</p>
            <form onSubmit={addTrainingSuggestion}>
              <label><span>Training type</span><select value={trainingForm.category} onChange={(event) => setTrainingForm((current) => ({ ...current, category: event.target.value as TrainingSuggestion["category"] }))}><option value="topic">Topic to discuss</option><option value="avoid">Topic to avoid</option><option value="tone">Tone instruction</option><option value="feedback">Behavior feedback</option></select></label>
              <label><span>Suggestion</span><textarea required maxLength={1000} placeholder="Add one clear instruction..." value={trainingForm.suggestion} onChange={(event) => setTrainingForm((current) => ({ ...current, suggestion: event.target.value }))} /></label>
              <button className="primaryAction" disabled={liveLoading}>Add training suggestion</button>
            </form>
            <div className="trainingSuggestionList">
              {trainingSuggestions.map((item) => <article key={item.id}><div><span>{item.category === "topic" ? "Talk about" : item.category === "avoid" ? "Avoid" : item.category === "tone" ? "Tone" : "Feedback"}</span><p>{item.suggestion}</p></div><button type="button" disabled={liveLoading} onClick={() => void deleteTrainingSuggestion(item.id)}>Delete</button></article>)}
            </div>
            <div className="fixedBoundaries">
              <strong>Permanent boundaries</strong>
              <p>Death, politics, crimes, illegal activity, underage people, minors, children, kids, poop, pee, scat, urine, watersports, and bathroom play. These cannot be removed by creator feedback or scripts.</p>
            </div>
          </section>

          <section className="customHistory">
            <strong>Content order history</strong>
            {purchaseHistory.length ? purchaseHistory.map((purchase) => (
              <div key={purchase.id}>
                <span><b>{purchase.product_title}</b><small>{new Date(`${purchase.created_at}Z`).toLocaleString()} · {purchase.status}</small></span>
                <time>{purchase.price}</time>
              </div>
            )) : <p>No content orders yet.</p>}
          </section>

          <div className="recentSales">
            <strong>Recent earnings</strong>
            {earnings.recent.length ? earnings.recent.slice(0, 6).map((item) => (
              <div key={item.id}>
                <span>{item.description}<small>{new Date(`${item.occurred_at}Z`).toLocaleString()}</small></span>
                <b>{money(item.amount_cents)}</b>
              </div>
            )) : <p>No approved sales yet.</p>}
          </div>

          <section className="customHistory">
            <strong>Completed customs</strong>
            {customHistory.length ? customHistory.map((custom) => (
              <div key={custom.id}>
                <span><b>{custom.telegram_name}</b><small>{custom.duration_minutes} minutes · {money(custom.amount_cents)}</small></span>
                <time>{custom.completed_at ? new Date(`${custom.completed_at}Z`).toLocaleDateString() : "Completed"}</time>
              </div>
            )) : <p>No completed customs yet.</p>}
          </section>
          <section className="customHistory">
            <strong>Completed sexting sessions</strong>
            {sextingHistory.length ? sextingHistory.map((session) => (
              <div key={session.id}>
                <span><b>{session.telegram_name}</b><small>{session.package_title}</small></span>
                <time>⭐ {session.stars.toLocaleString()}</time>
              </div>
            )) : <p>No completed sexting sessions yet.</p>}
          </section>
        </aside>
      </section>
      <footer className="footerNote">Live creator controls · Manual payment approvals · Earnings logged after approval</footer>
    </main>
  );
}
