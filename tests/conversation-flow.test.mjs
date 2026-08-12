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
  isLikelyBookingDetailReply,
  isLikelyCityReply,
  isLikelyCustomDetailReply,
  isLikelyShippingAddress,
  isLikelyShippingName,
  isMessageBurst,
  isPhysicalOrderDecline,
  isPresenceCheck,
  isRatingDecline,
  isSextingDecline,
  isSextingPackageFollowUp,
  isTrailerOfferAwaitingConfirmation,
  normalizeCasualText,
  parseNameIntroduction,
  productTitleMatchesMessage,
} from "../worker/conversation-rules.ts";

test("natural confirmations are accepted", () => {
  for (const reply of ["yes", "Yes I do", "yeah i do", "let's do it", "ok", "alright", "I guess"]) {
    assert.equal(isAffirmativeReply(reply), true, reply);
  }
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

test("partial catalog titles select the intended product", () => {
  assert.equal(productTitleMatchesMessage("Blonde Bombshell After Dark", "Can I buy the blonde bombshell"), true);
  assert.equal(productTitleMatchesMessage("Bday Airtight Orgy", "I want bday airtight"), true);
  assert.equal(productTitleMatchesMessage("The biggest BBC I've ever taken - Brickzilla", "show me brickzilla"), true);
  assert.equal(productTitleMatchesMessage("Blonde Bombshell After Dark", "show me a BBC video"), false);
});

test("a fan can explicitly reset a stuck conversation", () => {
  for (const message of ["/reset", "reset chat", "start over", "normal chat", "exit sexting"]) {
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

test("ordinary questions are not mistaken for form answers", () => {
  assert.equal(isConversationQuestion("Which movie?"), true);
  assert.equal(isLikelyCityReply("Which movie?"), false);
  assert.equal(isLikelyBookingDetailReply("Which movie?", true), false);
  assert.equal(isLikelyCustomDetailReply("What are you doing tonight?"), false);
  assert.equal(isLikelyShippingName("I want a video chat"), false);
  assert.equal(isLikelyShippingAddress("How are you?"), false);
});

test("natural fulfillment and booking answers remain accepted", () => {
  assert.equal(isLikelyShippingName("Johnny Smith"), true);
  assert.equal(isLikelyShippingAddress("123 Main Street, Los Angeles, CA 90001"), true);
  assert.equal(isLikelyBookingDetailReply("tomorrow at 3 pm"), true);
  assert.equal(isLikelyBookingDetailReply("10 minutes"), true);
  assert.equal(isLikelyBookingDetailReply("Los Angeles", true), true);
  assert.equal(isLikelyCustomDetailReply("5 minutes wearing red lingerie"), true);
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
  assert.deepEqual(bookingDetailsMissing("video chat tomorrow at 3 pm"), ["video chat length"]);
  assert.deepEqual(bookingDetailsMissing("video chat"), ["preferred date", "preferred time", "video chat length"]);
  assert.deepEqual(bookingDetailsMissing("tomorrow at 3 pm"), ["video chat or in person meet"]);
  assert.deepEqual(bookingDetailsMissing("in person tomorrow at 3 pm"), ["city"]);
  assert.deepEqual(bookingDetailsMissing("in person tomorrow at 3 pm in Los Angeles"), []);
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
});
