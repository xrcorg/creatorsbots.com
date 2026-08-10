import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingDetailsMissing,
  customDetailsMissing,
  isAffirmativeReply,
  isBotQuestion,
  isCancelReply,
  isLikelyCityReply,
  parseNameIntroduction,
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
