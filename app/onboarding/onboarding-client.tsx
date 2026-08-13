"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from "react";
import styles from "./onboarding.module.css";

type PortalUser = {
  email: string;
  role: "owner" | "creator";
  creator_key: string;
  creator_name: string;
};

type Intake = {
  status: string;
  answers: Record<string, string | boolean>;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  updated_at: string | null;
};

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "select" | "range";
  placeholder?: string;
  options?: string[];
  required?: boolean;
};

type Section = {
  title: string;
  eyebrow: string;
  description: string;
  fields: Field[];
};

const sections: Section[] = [
  {
    title: "Basics",
    eyebrow: "01 · About you",
    description: "The names and details your team should know.",
    fields: [
      { key: "legal_name", label: "Legal name", required: true },
      { key: "stage_names", label: "Stage or performer name", required: true },
      { key: "nicknames", label: "Nicknames you like" },
      { key: "pronouns", label: "Pronouns" },
      { key: "date_of_birth", label: "Date of birth", type: "date", required: true },
      { key: "zodiac", label: "Zodiac sign" },
      { key: "hometown", label: "Where are you from?" },
      { key: "current_city", label: "Where do you live now?" },
    ],
  },
  {
    title: "Your story",
    eyebrow: "02 · Background",
    description: "Give the chat enough context to speak about your career naturally.",
    fields: [
      { key: "industry_time", label: "How long have you been in the industry?" },
      { key: "industry_origin", label: "What drew you to the industry?", type: "textarea" },
      { key: "content_style", label: "Describe your content, style, and on screen persona", type: "textarea", required: true },
      { key: "niches", label: "What are your niches or specialties?", type: "textarea" },
      { key: "brand_summary", label: "Describe your brand in one or two sentences", type: "textarea" },
      { key: "childhood_ambition", label: "What did you want to be growing up?" },
      { key: "favorite_childhood_memory", label: "Favorite childhood memory", type: "textarea" },
      { key: "proudest_moment", label: "Proudest moment", type: "textarea" },
      { key: "turning_point", label: "Biggest turning point in your life", type: "textarea" },
      { key: "embarrassing_story", label: "A funny or embarrassing story you are comfortable sharing", type: "textarea" },
      { key: "top_videos", label: "Your top three videos", type: "textarea" },
      { key: "top_performers", label: "Your top three performers or inspirations", type: "textarea" },
    ],
  },
  {
    title: "Personality",
    eyebrow: "03 · Who you are",
    description: "This helps the bot feel like you instead of a generic assistant.",
    fields: [
      { key: "three_words", label: "Describe yourself in three words", required: true },
      { key: "friends_describe", label: "How would your friends describe you?", type: "textarea" },
      { key: "biggest_strength", label: "Biggest strength" },
      { key: "biggest_flaw", label: "Biggest flaw" },
      { key: "social_energy", label: "Are you an introvert, extrovert, or a mix?", type: "select", options: ["Introvert", "Extrovert", "A mix"] },
      { key: "outlook", label: "Optimist, pessimist, or realist?", type: "select", options: ["Optimist", "Pessimist", "Realist", "A mix"] },
      { key: "love_language", label: "Your love language" },
      { key: "handle_stress", label: "How do you handle stress?", type: "textarea" },
      { key: "handle_conflict", label: "How do you handle conflict?", type: "textarea" },
      { key: "makes_laugh", label: "What always makes you laugh?", type: "textarea" },
      { key: "makes_emotional", label: "What makes you emotional?", type: "textarea" },
      { key: "pet_peeves", label: "Pet peeves", type: "textarea" },
      { key: "sarcasm_level", label: "Sarcasm level", type: "range" },
      { key: "flirty_level", label: "Flirty level", type: "range" },
      { key: "unexpected_fact", label: "One thing people would never guess about you", type: "textarea" },
    ],
  },
  {
    title: "Voice and vibe",
    eyebrow: "04 · How you text",
    description: "Show us how you sound in a real conversation.",
    fields: [
      { key: "texting_style", label: "Describe your natural texting style", type: "textarea", required: true, placeholder: "Short, playful, lowercase, blunt, affectionate..." },
      { key: "catchphrases", label: "Words or catchphrases you use often", type: "textarea" },
      { key: "emojis", label: "Emojis you actually use" },
      { key: "slang", label: "Slang and abbreviations you use", type: "textarea" },
      { key: "pet_names", label: "Pet names you use for fans" },
      { key: "talk_topics", label: "Topics you can talk about for hours", type: "textarea", required: true },
      { key: "redirect_topics", label: "Topics you want redirected or avoided", type: "textarea" },
      { key: "bot_tone", label: "Tone the chat should use", type: "textarea", required: true },
      { key: "sample_replies", label: "Paste a few real examples of how you reply", type: "textarea", placeholder: "Fan: wyd?\nMe: running errands babe, what are you up to?" },
    ],
  },
  {
    title: "Favorites",
    eyebrow: "05 · Likes and loves",
    description: "These answers make everyday follow up questions easy and personal.",
    fields: [
      { key: "favorite_color", label: "Favorite color" },
      { key: "favorite_season", label: "Favorite season" },
      { key: "favorite_holiday", label: "Favorite holiday" },
      { key: "favorite_scent", label: "Favorite scent or perfume" },
      { key: "favorite_drink", label: "Favorite alcoholic drink" },
      { key: "favorite_non_alcoholic", label: "Favorite nonalcoholic drink" },
      { key: "comfort_food", label: "Comfort food" },
      { key: "favorite_dessert", label: "Favorite dessert or ice cream" },
      { key: "favorite_candle", label: "Favorite candle scent" },
      { key: "favorite_flower", label: "Favorite flower" },
      { key: "favorite_artist", label: "Favorite artist or band" },
      { key: "favorite_song_now", label: "Favorite song right now" },
      { key: "favorite_movie", label: "All time favorite movie" },
      { key: "favorite_show", label: "Show you love to binge" },
      { key: "favorite_book", label: "Favorite book or genre" },
      { key: "favorite_sport", label: "Favorite sport or team" },
      { key: "favorite_app", label: "Favorite app" },
      { key: "favorite_emoji", label: "Favorite emoji" },
      { key: "favorite_restaurant", label: "Favorite restaurant" },
      { key: "favorite_games", label: "Favorite games" },
      { key: "dream_destinations", label: "Dream travel destinations", type: "textarea" },
      { key: "hidden_talent", label: "Hidden talent" },
      { key: "guilty_pleasure", label: "Guilty pleasure" },
      { key: "gift_preferences", label: "Gifts or gift cards you genuinely like", type: "textarea" },
    ],
  },
  {
    title: "Daily life and style",
    eyebrow: "06 · Real life",
    description: "The small details that make casual conversation believable.",
    fields: [
      { key: "pets", label: "Pets and their names", type: "textarea" },
      { key: "favorite_animal", label: "Favorite animal" },
      { key: "coffee_or_tea", label: "Coffee or tea, and how do you take it?" },
      { key: "morning_or_night", label: "Morning person or night owl?" },
      { key: "ideal_day_off", label: "Ideal day off", type: "textarea" },
      { key: "fridge_staples", label: "What is always in your fridge?" },
      { key: "homebody_or_out", label: "Homebody or always going out?" },
      { key: "dream_home", label: "Dream home" },
      { key: "dream_car", label: "Dream car" },
      { key: "massage_preference", label: "Do you like massages? What kind?" },
      { key: "alternative_career", label: "What would you do outside this industry?" },
      { key: "personal_style", label: "Describe your personal style" },
      { key: "favorite_outfit", label: "Favorite outfit or lingerie style" },
      { key: "tattoos_piercings", label: "Tattoos or piercings and their stories", type: "textarea" },
      { key: "favorite_feature", label: "Feature people compliment most" },
    ],
  },
  {
    title: "Flirting and boundaries",
    eyebrow: "07 · Adult conversation",
    description: "Only share what you are comfortable using in adult fan chats.",
    fields: [
      { key: "relationship_status", label: "Relationship status you want fans to hear" },
      { key: "attracted_personality", label: "What personality are you attracted to?", type: "textarea" },
      { key: "turn_ons", label: "Turn ons", type: "textarea" },
      { key: "turn_offs", label: "Turn offs or icks", type: "textarea" },
      { key: "flirting_style", label: "Describe your flirting style", type: "textarea" },
      { key: "favorite_date", label: "Perfect date", type: "textarea" },
      { key: "favorite_toys", label: "Adult toys you are comfortable discussing", type: "textarea" },
      { key: "favorite_positions", label: "Positions you are comfortable discussing", type: "textarea" },
      { key: "favorite_performers", label: "Performers you like or would collaborate with", type: "textarea" },
      { key: "fan_safe_kinks", label: "Kinks or fantasies that are okay in fan chats", type: "textarea" },
      { key: "intimacy_off_limits", label: "Anything completely off limits", type: "textarea", required: true },
      { key: "industry_hot_take", label: "Something you would change about the industry", type: "textarea" },
      { key: "favorite_fan_part", label: "Favorite part of your fan community", type: "textarea" },
      { key: "fan_pet_peeve", label: "A fan behavior that bothers you", type: "textarea" },
      { key: "best_fan_gift", label: "Best fan gift or interaction", type: "textarea" },
    ],
  },
  {
    title: "Goals and chat persona",
    eyebrow: "08 · Make it yours",
    description: "Set the rules the bot will use when it represents you.",
    fields: [
      { key: "five_year_goal", label: "Where do you see yourself in five years?", type: "textarea" },
      { key: "dream_collab", label: "Dream collaboration" },
      { key: "bucket_list", label: "What is on your bucket list?", type: "textarea" },
      { key: "money_no_object", label: "What would you do if money were no object?", type: "textarea" },
      { key: "never_discuss", label: "Topics the chat should never discuss", type: "textarea", required: true },
      { key: "fan_faqs", label: "Common fan questions and how you answer them", type: "textarea", required: true },
      { key: "explicitness", label: "How explicit should the chat be by default?", type: "select", options: ["Flirty but not explicit", "Suggestive", "Explicit after age confirmation", "Creator approval first"] },
      { key: "authenticity_notes", label: "What will make the chat feel most like you?", type: "textarea" },
      { key: "anything_else", label: "Anything else your chat team should know?", type: "textarea" },
    ],
  },
  {
    title: "Account setup",
    eyebrow: "09 · Launch checklist",
    description: "Everything needed to connect your account and prepare your catalog.",
    fields: [
      { key: "telegram_username", label: "Telegram username", required: true, placeholder: "@username" },
      { key: "business_bot_username", label: "Telegram business bot username" },
      { key: "timezone", label: "Time zone", required: true, placeholder: "Pacific, Eastern, London..." },
      { key: "sleep_hours", label: "Sleep hours when the bot should stay quiet" },
      { key: "social_links", label: "Social links, one per line", type: "textarea" },
      { key: "payment_details", label: "Cash App, Venmo, Zelle, and other payment details", type: "textarea" },
      { key: "content_dropbox", label: "Dropbox or catalog folder link" },
      { key: "sexting_assets", label: "Describe the 20 photos and 5 to 10 short clips you will provide", type: "textarea" },
      { key: "sale_catalog", label: "Videos, photo sets, bundles, and physical items you want to sell", type: "textarea" },
      { key: "launch_notes", label: "Special launch notes", type: "textarea" },
    ],
  },
];

const requiredKeys = sections.flatMap((section) => section.fields.filter((field) => field.required).map((field) => field.key));

function statusLabel(status: string) {
  if (status === "submitted") return "Ready for review";
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes requested";
  return "Draft";
}

export default function IntakeForm() {
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    void fetch("/api/admin/intake", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to open the private intake." : "The intake could not be loaded.");
        return response.json();
      })
      .then((data) => {
        setPortalUser(data.portal_user);
        setIntake(data.intake);
        setAnswers(data.intake.answers || {});
        setReviewNote(data.intake.review_note || "");
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  const completed = useMemo(() => {
    const answered = sections.flatMap((section) => section.fields).filter((field) => {
      const value = answers[field.key];
      return typeof value === "boolean" ? value : String(value || "").trim().length > 0;
    }).length;
    return Math.round((answered / sections.flatMap((section) => section.fields).length) * 100);
  }, [answers]);

  const missingRequired = requiredKeys.filter((key) => !String(answers[key] || "").trim());
  const current = sections[sectionIndex];

  async function save(action: "save" | "submit" | "approve" | "request_changes" = "save") {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/intake", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, answers, review_note: reviewNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Changes could not be saved.");
      setIntake((existing) => existing ? { ...existing, status: data.status, updated_at: data.updated_at, review_note: reviewNote } : existing);
      setMessage(action === "submit" ? "Your intake was submitted for review."
        : action === "approve" ? "This creator intake is approved."
          : action === "request_changes" ? "The creator can now see your requested changes."
            : "Draft saved securely.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function update(key: string, value: string | boolean) {
    setAnswers((existing) => ({ ...existing, [key]: value }));
    setMessage("");
  }

  if (loading) return <div className={styles.loadingCard}>Opening your private intake...</div>;
  if (error && !portalUser) return <div className={styles.deniedCard}><strong>Creator access only</strong><p>{error}</p><a href="/">Return to the portal</a></div>;
  if (!portalUser || !intake) return null;

  return (
    <div className={styles.intakeApp}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/"><span>CB</span><div><strong>CreatorsBots</strong><small>Private creator onboarding</small></div></a>
        <div className={styles.account}><span>{portalUser.role === "owner" ? "Owner" : "Creator"}</span><strong>{portalUser.email}</strong><a href="/">Dashboard</a></div>
      </header>

      <section className={styles.hero}>
        <div>
          <p>{portalUser.creator_name}</p>
          <h1>Let’s build a chat that sounds like you.</h1>
          <span>Your answers are private, saved securely, and only visible to you and the platform owner.</span>
        </div>
        <div className={styles.progressCard}>
          <div><strong>{completed}%</strong><span>complete</span></div>
          <div className={styles.progressTrack}><i style={{ width: `${completed}%` }} /></div>
          <small>{statusLabel(intake.status)}{intake.updated_at ? ` · saved ${new Date(intake.updated_at).toLocaleString()}` : ""}</small>
        </div>
      </section>

      {intake.status === "changes_requested" && intake.review_note ? (
        <div className={styles.reviewAlert}><strong>Changes requested</strong><p>{intake.review_note}</p></div>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.steps}>
          {sections.map((section, index) => (
            <button className={index === sectionIndex ? styles.activeStep : ""} key={section.title} onClick={() => setSectionIndex(index)} type="button">
              <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.title}</strong><small>{section.fields.filter((field) => String(answers[field.key] || "").trim()).length} of {section.fields.length}</small></div>
            </button>
          ))}
          <button className={sectionIndex === sections.length ? styles.activeStep : ""} onClick={() => setSectionIndex(sections.length)} type="button">
            <span>10</span><div><strong>Review and submit</strong><small>{missingRequired.length ? `${missingRequired.length} required left` : "Ready"}</small></div>
          </button>
        </aside>

        <section className={styles.formCard}>
          {sectionIndex < sections.length ? (
            <>
              <div className={styles.sectionHeading}><p>{current.eyebrow}</p><h2>{current.title}</h2><span>{current.description}</span></div>
              <div className={styles.fieldGrid}>
                {current.fields.map((field) => (
                  <label className={field.type === "textarea" ? styles.fullField : ""} key={field.key}>
                    <span>{field.label}{field.required ? <b>Required</b> : null}</span>
                    {field.type === "textarea" ? (
                      <textarea value={String(answers[field.key] || "")} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder} />
                    ) : field.type === "select" ? (
                      <select value={String(answers[field.key] || "")} onChange={(event) => update(field.key, event.target.value)}>
                        <option value="">Choose one</option>
                        {field.options?.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : field.type === "range" ? (
                      <div className={styles.rangeField}><input min="1" max="10" type="range" value={String(answers[field.key] || "5")} onChange={(event) => update(field.key, event.target.value)} /><strong>{String(answers[field.key] || "5")} / 10</strong></div>
                    ) : (
                      <input type={field.type || "text"} value={String(answers[field.key] || "")} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder} />
                    )}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.reviewPane}>
              <div className={styles.sectionHeading}><p>10 · Final review</p><h2>Ready to submit?</h2><span>You can keep editing after saving a draft. Submission tells the owner it is ready to review.</span></div>
              <div className={styles.reviewStats}><article><strong>{completed}%</strong><span>Complete</span></article><article><strong>{missingRequired.length}</strong><span>Required answers left</span></article><article><strong>{statusLabel(intake.status)}</strong><span>Current status</span></article></div>
              {missingRequired.length ? <div className={styles.missing}><strong>Finish the required answers first</strong><p>{missingRequired.map((key) => sections.flatMap((section) => section.fields).find((field) => field.key === key)?.label).join(", ")}</p></div> : null}
              <label className={styles.adultConfirm}><input checked={answers.adult_confirmation === true} onChange={(event) => update("adult_confirmation", event.target.checked)} type="checkbox" /><span><strong>I confirm that I am 18 years of age or older.</strong><small>This intake is only available to adult creators.</small></span></label>
              {portalUser.role === "owner" ? (
                <div className={styles.ownerReview}><label><span>Private review note</span><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Tell the creator what should be updated" /></label><div><button disabled={saving} onClick={() => void save("request_changes")} type="button">Request changes</button><button className={styles.primary} disabled={saving} onClick={() => void save("approve")} type="button">Approve intake</button></div></div>
              ) : (
                <button className={styles.submitButton} disabled={saving || missingRequired.length > 0 || answers.adult_confirmation !== true} onClick={() => void save("submit")} type="button">Submit private intake</button>
              )}
            </div>
          )}

          <footer className={styles.formFooter}>
            <button disabled={saving || sectionIndex === 0} onClick={() => setSectionIndex((index) => Math.max(0, index - 1))} type="button">Back</button>
            <div>{error ? <span className={styles.error}>{error}</span> : message ? <span className={styles.success}>{message}</span> : <small>Drafts stay private until you submit.</small>}</div>
            <button disabled={saving} onClick={() => void save("save")} type="button">{saving ? "Saving..." : "Save draft"}</button>
            {sectionIndex < sections.length ? <button className={styles.primary} disabled={saving} onClick={() => { void save("save"); setSectionIndex((index) => Math.min(sections.length, index + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button">Save and continue</button> : null}
          </footer>
        </section>
      </div>
    </div>
  );
}
