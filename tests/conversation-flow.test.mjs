import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingDetailsMissing,
  customDetailsMissing,
  isAffirmativeReply,
  isBotQuestion,
  isCancelReply,
} from "../worker/conversation-rules.ts";

test("natural confirmations are accepted", () => {
  for (const reply of ["yes", "Yes I do", "yeah i do", "let's do it", "ok", "alright", "I guess"]) {
    assert.equal(isAffirmativeReply(reply), true, reply);
  }
});

test("natural cancellations leave unfinished flows", () => {
  for (const reply of ["not now", "maybe later", "no thanks", "never mind"]) {
    assert.equal(isCancelReply(reply), true, reply);
  }
});

test("automation questions are recognized consistently", () => {
  assert.equal(isBotQuestion("Is this a bot?"), true);
  assert.equal(isBotQuestion("Are these automated responses?"), true);
});

test("bookings require a service, date, and time", () => {
  assert.deepEqual(bookingDetailsMissing("video chat tomorrow at 3 pm"), []);
  assert.deepEqual(bookingDetailsMissing("video chat"), ["preferred date", "preferred time"]);
  assert.deepEqual(bookingDetailsMissing("tomorrow at 3 pm"), ["video chat or in person meet"]);
});

test("customs require both creative details and a duration", () => {
  assert.deepEqual(customDetailsMissing("I want a custom video"), { duration: true, description: true });
  assert.deepEqual(customDetailsMissing("I want a 5 minute custom where you wear pink lingerie and tease me"), {
    duration: false,
    description: false,
  });
});
