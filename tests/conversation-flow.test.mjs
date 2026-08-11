import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingDetailsMissing,
  customDetailsMissing,
  isAffirmativeReply,
  isBookingDecline,
  isBotQuestion,
  isCancelReply,
  isConversationQuestion,
  isCustomDecline,
  isGenericCancelReply,
  isLikelyBookingDetailReply,
  isLikelyCityReply,
  isLikelyCustomDetailReply,
  isLikelyShippingAddress,
  isLikelyShippingName,
  isPhysicalOrderDecline,
  isRatingDecline,
  isSextingDecline,
  isSextingPackageFollowUp,
  parseNameIntroduction,
} from "../worker/conversation-rules.ts";

test("natural confirmations are accepted", () => {
  for (const reply of ["yes", "Yes I do", "yeah i do", "let's do it", "ok", "alright", "I guess"]) {
    assert.equal(isAffirmativeReply(reply), true, reply);
  }
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
  assert.equal(isSextingDecline("I want to sext"), false);
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
});

test("bookings require a service, date, and time", () => {
  assert.deepEqual(bookingDetailsMissing("video chat tomorrow at 3 pm"), []);
  assert.deepEqual(bookingDetailsMissing("video chat"), ["preferred date", "preferred time"]);
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
