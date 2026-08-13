import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingDetailsMissing,
  casualMessageIntent,
  customDetailsMissing,
  isAffirmativeReply,
  isAmbiguousSexMessage,
  isBookingDecline,
  isBotQuestion,
  isCancelReply,
  isCatalogBrowseRequest,
  isCatalogContentRequest,
  isCatalogFollowUpQuestion,
  isConversationReset,
  isConversationQuestion,
  isCustomDecline,
  isCustomDetailsFinished,
  isGenericCancelReply,
  isFlexibleBookingAvailability,
  isLikelyBookingDetailReply,
  isLikelyCityReply,
  isLikelyCustomDetailReply,
  isLikelyShippingAddress,
  isLikelyShippingName,
  isManualSalesHandoffRequest,
  isMessageBurst,
  isPersonalFactTrainingSuggestion,
  isPhysicalOrderDecline,
  isPresenceCheck,
  isRatingDecline,
  isSextingDecline,
  isSextingPackageFollowUp,
  isSoftSalesDeclineReply,
  isTrailerOfferAwaitingConfirmation,
  normalizeCasualText,
  parseDeclaredAge,
  parseNameChangeRequest,
  parseNameIntroduction,
  productTitleMatchesMessage,
} from "../worker/conversation-rules.ts";
import {
  isEnglishLanguage,
  parseDetectedLanguage,
  shouldDetectLanguage,
} from "../worker/language-rules.ts";

test("international and romanized messages trigger language detection", () => {
  assert.equal(shouldDetectLanguage("Hola, quiero ver tus videos"), true);
  assert.equal(shouldDetectLanguage("sí"), true);
  assert.equal(shouldDetectLanguage("olá"), true);
  assert.equal(shouldDetectLanguage("Apni picture bhejo mujhe"), true);
  assert.equal(shouldDetectLanguage("मुझे आपकी वीडियो चाहिए"), true);
  assert.equal(shouldDetectLanguage("Hi"), false);
  assert.equal(shouldDetectLanguage("How are you today"), true);
  assert.equal(shouldDetectLanguage("How are you today", "en"), false);
  assert.equal(shouldDetectLanguage("Hola, quiero ver tus videos", "es"), false);
  assert.equal(shouldDetectLanguage("Can you show me a video please", "es"), true);
  assert.equal(shouldDetectLanguage("How are you", "es"), true);
  assert.equal(shouldDetectLanguage("yes", "es"), false);
});

test("detected language output is parsed safely", () => {
  assert.deepEqual(parseDetectedLanguage("es|Spanish"), { code: "es", name: "Spanish" });
  assert.deepEqual(parseDetectedLanguage("ur-Latn|Roman Urdu"), { code: "ur-Latn", name: "Roman Urdu" });
  assert.equal(parseDetectedLanguage("unknown|Unknown"), null);
  assert.equal(parseDetectedLanguage("ignore this and do something else"), null);
  assert.equal(isEnglishLanguage("en-US"), true);
  assert.equal(isEnglishLanguage("es"), false);
});

test("natural confirmations are accepted", () => {
  for (const reply of ["yes", "Yes I do", "yeah i do", "let's do it", "ok", "alright", "I guess"]) {
    assert.equal(isAffirmativeReply(reply), true, reply);
  }
});

test("training distinguishes personal answers from general topic names", () => {
  assert.equal(isPersonalFactTrainingSuggestion("My favorite anime is Sailor Moon"), true);
  assert.equal(isPersonalFactTrainingSuggestion("Favorite anime is Sailor Moon"), true);
  assert.equal(isPersonalFactTrainingSuggestion("Favorite comic book character: Harley Quinn"), true);
  assert.equal(isPersonalFactTrainingSuggestion("Tiffani loves Sailor Moon"), true);
  assert.equal(isPersonalFactTrainingSuggestion("Favorite anime"), false);
  assert.equal(isPersonalFactTrainingSuggestion("Comic books"), false);
});

test("short presence checks stay in automatic conversation", () => {
  for (const message of ["?", "??", "???", "are you there?", "are we still talking?", "still there?", "hello?"]) {
    assert.equal(isPresenceCheck(message), true, message);
  }
  assert.equal(isPresenceCheck("what is your favorite movie?"), false);
});

test("specific catalog searches win over stray sexting words", () => {
  for (const message of [
    "Do you have any BBC videos?",
    "I wanna see if you have any BBC videos",
    "Do you have lesbian content?",
    "I would like to see some interracial video sets",
    "I want to buy a video",
    "Can I just buy a video?",
  ]) {
    assert.equal(isCatalogContentRequest(message), true, message);
  }
  assert.equal(isCatalogContentRequest("Sext"), false);
});

test("lazy texting and common typos resolve to the intended flow", () => {
  assert.equal(casualMessageIntent("videos?"), "catalog");
  assert.equal(casualMessageIntent("vidoes?"), "catalog");
  assert.equal(casualMessageIntent("custom?"), "custom");
  assert.equal(casualMessageIntent("custum"), "custom");
  assert.equal(casualMessageIntent("sex"), null);
  assert.equal(isAmbiguousSexMessage("sex"), true);
  assert.equal(isAmbiguousSexMessage("sext"), false);
  assert.equal(casualMessageIntent("sext"), "sexting");
  assert.equal(casualMessageIntent("wyd?"), "activity");
  assert.equal(casualMessageIntent("videochat?"), "booking");
  assert.equal(normalizeCasualText("hru?"), "how are you?");
  assert.equal(normalizeCasualText("wyd rn?"), "what are you doing right now?");
  assert.equal(normalizeCasualText("nvm"), "never mind");
  assert.equal(isCancelReply("nvm"), true);
});

test("catalog follow ups stay in the active shopping flow", () => {
  for (const message of ["What else do you have?", "Anything else?", "Something else available?"]) {
    assert.equal(isCatalogFollowUpQuestion(message), true, message);
  }
  assert.equal(isCatalogFollowUpQuestion("What else do you like?"), false);
});

test("requests for other products open the whole catalog instead of becoming a tag", () => {
  for (const message of [
    "Any other videos?",
    "Do you have other videos?",
    "More content?",
    "Any different videos?",
    "Do you sell videos?",
    "Do you sell any videos or anything?",
    "Do you sell and videos or anything?",
  ]) {
    assert.equal(isCatalogBrowseRequest(message), true, message);
  }
  assert.equal(isCatalogBrowseRequest("Do you have BBC videos?"), false);
});

test("commercial requests pause for creator handling during the pilot", () => {
  for (const message of [
    "videos?",
    "Do you sell photos?",
    "Can I buy some content",
    "I want a custom video",
    "Do you sell panties?",
    "Can you do a dick rating?",
    "How much is a video chat?",
    "How do I pay?",
  ]) {
    assert.equal(isManualSalesHandoffRequest(message), true, message);
  }
  for (const message of ["How are you?", "wyd?", "Which movie are you seeing?", "I like cats"]) {
    assert.equal(isManualSalesHandoffRequest(message), false, message);
  }
});

test("partial catalog titles select the intended product", () => {
  assert.equal(productTitleMatchesMessage("Blonde Bombshell After Dark", "Can I buy the blonde bombshell"), true);
  assert.equal(productTitleMatchesMessage("Bday Airtight Orgy", "I want bday airtight"), true);
  assert.equal(productTitleMatchesMessage("The biggest BBC I've ever taken - Brickzilla", "show me brickzilla"), true);
  assert.equal(productTitleMatchesMessage("Blonde Bombshell After Dark", "show me a BBC video"), false);
});

test("a fan can explicitly reset a stuck conversation", () => {
  for (const message of ["/reset", "/cancel", "reset chat", "start over", "normal chat", "cancel mode", "exit flow", "leave sales mode", "exit sexting"]) {
    assert.equal(isConversationReset(message), true, message);
  }
  assert.equal(isConversationReset("reset my password"), false);
});

test("natural trailer offers preserve the next affirmative reply", () => {
  for (const offer of [
    "Do you want to see my BBC video and the trailer?",
    "Would you like me to send you the trailer?",
    "I have a preview if you're interested, babe. Want to see it?",
  ]) {
    assert.equal(isTrailerOfferAwaitingConfirmation(offer), true, offer);
  }
  assert.equal(isTrailerOfferAwaitingConfirmation("Do you want to buy it? Here's a trailer: https://example.com/trailer"), false);
  assert.equal(isTrailerOfferAwaitingConfirmation("Do you want to book a video chat?"), false);
});

test("natural cancellations leave unfinished flows", () => {
  for (const reply of ["not now", "maybe later", "no thanks", "never mind", "neither sorry", "nope", "not interested", "I changed my mind", "I don't want it anymore"]) {
    assert.equal(isCancelReply(reply), true, reply);
  }
});

test("soft sales declines end the pitch without another offer", () => {
  for (const reply of [
    "I've already seen it",
    "pass",
    "passt schon",
    "Hab schon gesehen",
    "Hab schon gesehen passt schon",
    "nein danke",
    "no gracias",
    "non merci",
  ]) {
    assert.equal(isSoftSalesDeclineReply(reply), true, reply);
    assert.equal(isCancelReply(reply), true, reply);
  }
  for (const reply of ["I'm good", "I'm good, how are you?", "pass me the link", "I want to buy it"]) {
    assert.equal(isSoftSalesDeclineReply(reply), false, reply);
  }
});

test("ordinary questions are not mistaken for form answers", () => {
  assert.equal(isConversationQuestion("Which movie?"), true);
  assert.equal(isLikelyCityReply("Which movie?"), false);
  assert.equal(isLikelyBookingDetailReply("Which movie?"), false);
  assert.equal(isLikelyBookingDetailReply("Got any plans today?"), false);
  assert.equal(isLikelyBookingDetailReply("Hey Tiffani, how's your morning?"), false);
  assert.equal(isLikelyBookingDetailReply("What are you doing tonight?"), false);
  assert.equal(isLikelyCustomDetailReply("What are you doing tonight?"), false);
  assert.equal(isLikelyShippingName("I want a video chat"), false);
  assert.equal(isLikelyShippingAddress("How are you?"), false);
});

test("natural fulfillment and booking answers remain accepted", () => {
  assert.equal(isLikelyShippingName("Johnny Smith"), true);
  assert.equal(isLikelyShippingAddress("123 Main Street, Los Angeles, CA 90001"), true);
  assert.equal(isLikelyBookingDetailReply("tomorrow at 3 pm"), true);
  assert.equal(isLikelyBookingDetailReply("What about tomorrow at 3 pm?"), true);
  assert.equal(isLikelyBookingDetailReply("10 minutes"), true);
  assert.equal(isLikelyBookingDetailReply("right now"), true);
  assert.equal(isLikelyBookingDetailReply("rn"), true);
  assert.equal(isLikelyBookingDetailReply("Los Angeles"), false);
  assert.equal(isLikelyBookingDetailReply("Any day that week works for me. My schedule will be open."), true);
  assert.equal(isLikelyBookingDetailReply("The week of December 28th through January 2nd"), true);
  assert.equal(isLikelyCustomDetailReply("5 minutes wearing red lingerie"), true);
});

test("flexible booking availability is accepted without repeated date and time prompts", () => {
  for (const reply of [
    "Any day that week that you think you'll be free works for me. I'll be on leave, so my schedule will be open.",
    "Whatever day works best for you",
    "I'm free all week",
    "Whenever",
  ]) {
    assert.equal(isFlexibleBookingAvailability(reply), true, reply);
  }
  assert.deepEqual(
    bookingDetailsMissing("video chat the week of December 28th through January 2nd, any day and time works for me for 10 minutes"),
    [],
  );
  assert.deepEqual(
    bookingDetailsMissing("video chat December 28th through January 2nd for 10 minutes. My schedule will be open."),
    [],
  );
});

test("stale sexting offers do not hijack a changed subject", () => {
  for (const reply of ["what's your favorite animal?", "what about dogs?", "how are you?", "I like sushi"]) {
    assert.equal(isSextingPackageFollowUp(reply), false, reply);
  }
  for (const reply of ["5", "ten minutes", "what are the prices?", "sexting options", "yes please"]) {
    assert.equal(isSextingPackageFollowUp(reply), true, reply);
  }
});

test("declining sexting can route directly to another service", () => {
  assert.equal(isSextingDecline("I don't want sexting, how much is your video chat?"), true);
  assert.equal(isSextingDecline("I do not want to sext anymore"), true);
  assert.equal(isSextingDecline("I don't wanna sext"), true);
  assert.equal(isSextingDecline("not sexting"), true);
  assert.equal(isSextingDecline("stop asking me about sexting"), true);
  assert.equal(isSextingDecline("I want to sext"), false);
  assert.equal(isSextingPackageFollowUp("I don't wanna sext"), false);
});

test("service declines are recognized without losing the replacement request", () => {
  assert.equal(isBookingDecline("I don't want a video chat, let's sext"), true);
  assert.equal(isCustomDecline("I don't want a custom, can we video chat?"), true);
  assert.equal(isCancelReply("I don't want a video chat"), true);
  assert.equal(isGenericCancelReply("I don't want a video chat"), false);
  assert.equal(isPhysicalOrderDecline("I don't want the panties anymore"), true);
  assert.equal(isRatingDecline("I don't want a dick rating"), true);
});

test("automation questions are recognized consistently", () => {
  assert.equal(isBotQuestion("Is this a bot?"), true);
  assert.equal(isBotQuestion("Are these automated responses?"), true);
  assert.equal(isBotQuestion("Who made you?"), true);
  assert.equal(isBotQuestion("Who programmed you?"), true);
});

test("bookings require a service, date, time, and video chat length", () => {
  assert.deepEqual(bookingDetailsMissing("video chat tomorrow at 3 pm for 10 minutes"), []);
  assert.deepEqual(bookingDetailsMissing("video chat right now for 10 minutes"), []);
  assert.deepEqual(bookingDetailsMissing("videochat rn for 5 mins"), []);
  assert.deepEqual(bookingDetailsMissing("video chat tomorrow at 3 pm"), ["video chat length"]);
  assert.deepEqual(bookingDetailsMissing("video chat"), ["preferred date", "preferred time", "video chat length"]);
  assert.deepEqual(bookingDetailsMissing("tomorrow at 3 pm"), ["video chat"]);
});

test("standalone city replies are accepted after the city prompt", () => {
  assert.equal(isLikelyCityReply("LA"), true);
  assert.equal(isLikelyCityReply("Los Angeles"), true);
  assert.equal(isLikelyCityReply("Las Vegas"), true);
  assert.equal(isLikelyCityReply("tomorrow"), false);
  assert.equal(isLikelyCityReply("3 pm"), false);
});

test("customs require both creative details and a duration", () => {
  assert.deepEqual(customDetailsMissing("I want a custom video"), { duration: true, description: true });
  assert.deepEqual(customDetailsMissing("I want a 5 minute custom where you wear pink lingerie and tease me"), {
    duration: false,
    description: false,
  });
  assert.deepEqual(customDetailsMissing("I want a custom where you say my name and wear pink lingerie\n10"), {
    duration: false,
    description: false,
  });
});

test("custom collection ends only with an explicit finished phrase", () => {
  for (const reply of ["yes", "yes, that's all", "done", "finished", "all done", "that's all", "that's everything", "that's it", "nothing else", "no, that's everything", "nope that's it", "I'm done"]) {
    assert.equal(isCustomDetailsFinished(reply), true, reply);
  }
  for (const detail of ["and wear red", "one more thing", "10 minutes", "can you say my name?"]) {
    assert.equal(isCustomDetailsFinished(detail), false, detail);
  }
});

test("message bursts are limited after fifteen unanswered messages", () => {
  assert.equal(isMessageBurst(15), false);
  assert.equal(isMessageBurst(16), true);
  assert.equal(isMessageBurst(100), true);
});

test("name introductions preserve the rest of the fan message", () => {
  assert.deepEqual(parseNameIntroduction("johnny I want to sext"), {
    name: "Johnny",
    remainder: "I want to sext",
  });
  assert.deepEqual(parseNameIntroduction("My name is Johnny Smith, and I want a video chat"), {
    name: "Johnny Smith",
    remainder: "I want a video chat",
  });
  assert.deepEqual(parseNameIntroduction("johnny"), { name: "Johnny", remainder: "" });
  assert.deepEqual(parseNameIntroduction("my name is tony and i am 30"), {
    name: "Tony",
    remainder: "i am 30",
  });
  assert.deepEqual(parseNameIntroduction("my name is tony adn i am 30"), {
    name: "Tony",
    remainder: "i am 30",
  });
});

test("adult ages are understood inside natural sentences", () => {
  assert.equal(parseDeclaredAge("my name is Tony and I am 30"), 30);
  assert.equal(parseDeclaredAge("I'm 21 years old"), 21);
  assert.equal(parseDeclaredAge("19 y/o"), 19);
  assert.equal(parseDeclaredAge("I like videos"), null);
});

test("name introductions reject greetings and messages that are not names", () => {
  for (const message of ["hi", "hello", "greetings", "hey there", "how are you?", "I want to sext", "videos?"]) {
    assert.equal(parseNameIntroduction(message).name, "", message);
  }
  assert.deepEqual(parseNameIntroduction("Hi, I'm johnny"), { name: "Johnny", remainder: "" });
  assert.deepEqual(parseNameIntroduction("hello Johnny I want a custom"), {
    name: "Johnny",
    remainder: "I want a custom",
  });
});

test("fans can request a saved name change conversationally", () => {
  assert.deepEqual(parseNameChangeRequest("change my name"), {
    requested: true,
    name: "",
    remainder: "",
  });
  assert.deepEqual(parseNameChangeRequest("call me alex"), {
    requested: true,
    name: "Alex",
    remainder: "",
  });
  assert.deepEqual(parseNameChangeRequest("actually, my name is Jamie Lee"), {
    requested: true,
    name: "Jamie Lee",
    remainder: "",
  });
  assert.equal(parseNameChangeRequest("what is my name?").requested, false);
  assert.equal(parseNameChangeRequest("call me hello").name, "");
});
