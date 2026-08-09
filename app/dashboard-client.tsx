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
};

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
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  const loadLivePending = useCallback(async () => {
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/pending", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the creator inbox");
      const data = await response.json() as { pending: LivePendingReply[]; purchases: LivePurchase[]; bookings: LiveBooking[]; learned_count: number };
      setLivePending(data.pending);
      setLivePurchases(data.purchases);
      setLiveBookings(data.bookings);
      setSavedAnswers(data.learned_count);
      setLiveError("");
    } catch {
      setLiveError("The live creator inbox could not be loaded.");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!creatorMode) return;
    void loadLivePending();
    const timer = window.setInterval(() => void loadLivePending(), 15000);
    return () => window.clearInterval(timer);
  }, [creatorMode, loadLivePending]);

  const statusText = useMemo(() => {
    if (blocked) return "Conversation closed";
    if (!verified) return "Waiting for age confirmation";
    if (livePurchases.length) return "Payment approval needed";
    if (liveBookings.length) return "Booking approval needed";
    if (livePending.length) return "Tiffani reply needed";
    return "AI assistant active";
  }, [blocked, liveBookings.length, livePending.length, livePurchases.length, verified]);

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

  async function resolveBooking(action: "send" | "ignore") {
    const current = liveBookings[0];
    if (!current) return;
    const answer = creatorReply.trim();
    if (action === "send" && !answer) return;
    try {
      setLiveLoading(true);
      const response = await fetch("/api/admin/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, action, answer }),
      });
      if (!response.ok) throw new Error("Booking update failed");
      setCreatorReply("");
      await loadLivePending();
    } catch {
      setLiveError("The booking update was not sent. Please try again.");
    } finally {
      setLiveLoading(false);
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
          <span className={`statusPill ${livePending.length || livePurchases.length || liveBookings.length ? "needsReply" : ""}`}>
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
              <div className="alertTitle"><span>□</span> Booking request</div>
              <p className="fanQuestion">“{liveBookings[0].details}”</p>
              <div className="botPaused">Check the date, time, service, city, and calendar before replying.</div>
              <textarea
                aria-label="Booking reply"
                onChange={(event) => setCreatorReply(event.target.value)}
                placeholder="Confirm, suggest another time, or ask a question..."
                value={creatorReply}
              />
              <button className="primaryAction" disabled={liveLoading} onClick={() => void resolveBooking("send")}>
                Send booking reply
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
              <button className="primaryAction" disabled={liveLoading} onClick={() => void sendLiveCreatorReply(true)}>
                Send and save for later
              </button>
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

          <div className="personaSummary">
            <div><span>Flirty level</span><strong>Very</strong></div>
            <div><span>Human takeover</span><strong>On</strong></div>
            <div><span>Learning</span><strong>Approval only</strong></div>
            <div><span>Age gate</span><strong>Required</strong></div>
          </div>
        </aside>
      </section>
      <footer className="footerNote">Live creator controls · Telegram replies are sent immediately · No live payments</footer>
    </main>
  );
}
