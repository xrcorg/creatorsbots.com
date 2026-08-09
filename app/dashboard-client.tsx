"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

const products = [
  { name: "Pink tease set", price: "$35", kind: "12 photos" },
  { name: "Private video", price: "$75", kind: "5 minutes" },
  { name: "Video call", price: "$150", kind: "15 minutes" },
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
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveCustoms, setLiveCustoms] = useState<LiveCustom[]>([]);
  const [customHistory, setCustomHistory] = useState<LiveCustom[]>([]);
  const [customLinks, setCustomLinks] = useState<Record<number, string>>({});
  const [earnings, setEarnings] = useState<EarningsSummary>({ weekly_cents: 0, weekly_count: 0, all_time_cents: 0, all_time_count: 0, recent: [], history: [] });
  const [earningsView, setEarningsView] = useState<"weekly" | "all" | null>(null);
  const [bookingType, setBookingType] = useState<"video_chat" | "custom_content" | "in_person">("video_chat");
  const [bookingDuration, setBookingDuration] = useState("");
  const [settings, setSettings] = useState<CreatorSettings>({ flirty_level: "very", human_takeover: "on", learning: "approval", custom_approval: "required", video_chat_rate: "50", custom_content_rate: "50", in_person_rate: "1500" });
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { pending: LivePendingReply[]; purchases: LivePurchase[]; bookings: LiveBooking[]; customs: LiveCustom[]; custom_history: LiveCustom[]; learned_count: number; earnings: EarningsSummary; settings: CreatorSettings };
      setLivePending(data.pending);
      setLivePurchases(data.purchases);
      setLiveBookings(data.bookings);
      setLiveCustoms(data.customs || []);
      setCustomHistory(data.custom_history || []);
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
    if (liveCustoms.length) return "Custom content to fulfill";
    if (liveBookings.length) return "Booking approval needed";
    if (livePending.length) return "Tiffani reply needed";
    return "AI assistant active";
  }, [blocked, liveBookings.length, liveCustoms.length, livePending.length, livePurchases.length, verified]);

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
          <span className={`statusPill ${livePending.length || livePurchases.length || liveBookings.length || liveCustoms.length ? "needsReply" : ""}`}>
            <i /> {statusText}
          </span>
          <button className="ghostButton" onClick={resetDemo}>Reset test</button>
          <button className="modeButton" onClick={() => setCreatorMode((value) => !value)}>
            {creatorMode ? "View fan chat" : "Creator controls"}
          </button>
        </div>
      </header>

      <section className={`workspace ${creatorMode ? "creatorOpen" : ""}`}>
        <aside className="sidePanel">
          <p className="eyebrow">Live test</p>
          <h1>Sweet. Flirty. Always in control.</h1>
          <p className="intro">
            Test Tiffani's fan experience before connecting the real Telegram bot.
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

        <section className="phoneStage" aria-label="Telegram chat simulator">
          <div className="phone">
            <div className="phoneTop">
              <span className="back">‹</span>
              <div className="miniAvatar">T</div>
              <div className="chatIdentity">
                <strong>Tiffani Madison</strong>
                <span>bot · online</span>
              </div>
              <span className="more">•••</span>
            </div>

            <div className="chatArea">
              <div className="disclosure">AI assisted chat · Tiffani can take over anytime</div>
              {activeTab === "chat" && (
                <>
                  {messages.map((message) => (
                    <div className={`messageRow ${message.role}`} key={message.id}>
                      <div className="messageBubble">
                        {message.text}
                        <span>{message.time}</span>
                      </div>
                    </div>
                  ))}

                  {!verified && !blocked && (
                    <div className="ageActions">
                      <button onClick={() => confirmAge(true)}>Yes, I am 18+</button>
                      <button className="secondary" onClick={() => confirmAge(false)}>No</button>
                    </div>
                  )}
                </>
              )}

              {activeTab === "shop" && (
                <div className="panelContent">
                  <p className="eyebrow">Tiffani's shop</p>
                  <h2>Pick your temptation</h2>
                  {!verified ? (
                    <div className="lockedCard">Confirm you are 18+ in chat to unlock the shop.</div>
                  ) : (
                    products.slice(0, 2).map((product, index) => (
                      <button className="productCard" key={product.name}>
                        <span className={`productArt art${index + 1}`}>♡</span>
                        <span><strong>{product.name}</strong><small>{product.kind}</small></span>
                        <b>{product.price}</b>
                      </button>
                    ))
                  )}
                  <p className="checkoutNote">Test mode. No real payment will be taken.</p>
                </div>
              )}

              {activeTab === "book" && (
                <div className="panelContent">
                  <p className="eyebrow">Private booking</p>
                  <h2>Choose your time</h2>
                  {!verified ? (
                    <div className="lockedCard">Confirm you are 18+ in chat to view availability.</div>
                  ) : (
                    <>
                      <div className="bookingProduct">
                        <span>Video call</span><strong>$150 · 15 minutes</strong>
                      </div>
                      <div className="dateStrip">
                        {[["MON", "12"], ["TUE", "13"], ["WED", "14"], ["THU", "15"]].map(([day, date], index) => (
                          <button className={index === 1 ? "selected" : ""} key={day}>
                            <span>{day}</span><strong>{date}</strong>
                          </button>
                        ))}
                      </div>
                      <div className="timeGrid">
                        <button>11:00 AM</button><button>1:30 PM</button><button>4:00 PM</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {activeTab === "chat" && (
              <form className="composer" onSubmit={sendMessage}>
                <button type="button" aria-label="Add attachment">＋</button>
                <input
                  aria-label="Message Tiffani"
                  disabled={!verified || blocked}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={verified ? "Message Tiffani" : "Confirm age to continue"}
                  value={input}
                />
                <button className="sendButton" disabled={!input.trim() || blocked}>➤</button>
              </form>
            )}

            <nav className="tabbar" aria-label="Telegram Mini App tabs">
              <button className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>
                <span>●</span>Chat
              </button>
              <button className={activeTab === "shop" ? "active" : ""} onClick={() => setActiveTab("shop")}>
                <span>♡</span>Shop
              </button>
              <button className={activeTab === "book" ? "active" : ""} onClick={() => setActiveTab("book")}>
                <span>□</span>Book
              </button>
            </nav>
          </div>
        </section>

        <aside className={`creatorPanel ${creatorMode ? "visible" : ""}`}>
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
                Approve booking and send
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
            <div className="rateSetting"><span>Video chat per minute</span><label>$<input aria-label="Video chat rate per minute" inputMode="decimal" min="1" onBlur={() => void updateSetting("video_chat_rate", settings.video_chat_rate)} onChange={(event) => setSettings((current) => ({ ...current, video_chat_rate: event.target.value }))} type="number" value={settings.video_chat_rate} /></label></div>
            <div className="rateSetting"><span>Custom content per minute</span><label>$<input aria-label="Custom content rate per minute" inputMode="decimal" min="1" onBlur={() => void updateSetting("custom_content_rate", settings.custom_content_rate)} onChange={(event) => setSettings((current) => ({ ...current, custom_content_rate: event.target.value }))} type="number" value={settings.custom_content_rate} /></label></div>
            <div className="rateSetting"><span>In person meet per hour</span><label>$<input aria-label="In person meet rate per hour" inputMode="decimal" min="1" onBlur={() => void updateSetting("in_person_rate", settings.in_person_rate)} onChange={(event) => setSettings((current) => ({ ...current, in_person_rate: event.target.value }))} type="number" value={settings.in_person_rate} /></label></div>
            <div><span>Age gate</span><strong>Required</strong></div>
          </div>

          <div className="creatorProfileLinks">
            <strong>Approved social links</strong>
            <a href="https://www.instagram.com/tiffanimadisonvip/?hl=en" rel="noreferrer" target="_blank">
              <span>Instagram</span>
              <b>@tiffanimadisonvip</b>
            </a>
            <a href="https://www.pornhub.com/pornstar/tiffani-madison" rel="noreferrer" target="_blank">
              <span>Pornhub</span>
              <b>Tiffani Madison</b>
            </a>
          </div>

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
        </aside>
      </section>
      <footer className="footerNote">Live creator controls · Manual payment approvals · Earnings logged after approval</footer>
    </main>
  );
}
