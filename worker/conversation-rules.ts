export function isBotQuestion(text: string) {
  return /\b(are you (?:a )?bot|is this (?:a )?bot|am i talking to (?:a )?bot|is this automated|are these automated responses|who am i talking to)\b/i.test(text);
}

export function bookingDetailsMissing(text: string) {
  const isVideoChat = /\b(video chat|video call)\b/i.test(text);
  const isInPerson = /\b(in person|meet in person|meet and greet)\b/i.test(text);
  const hasService = isVideoChat || isInPerson;
  const hasDate = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text) ||
    /\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/.test(text);
  const hasTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text) ||
    /\b(noon|midnight|morning|afternoon|evening)\b/i.test(text);
  const missing = [];
  if (!hasService) missing.push("video chat or in person meet");
  if (!hasDate) missing.push("preferred date");
  if (!hasTime) missing.push("preferred time");
  if (isInPerson && !/\b(?:city(?:\s+is)?|location(?:\s+is)?|in\s+(?!person\b))[ :]?[a-z][a-z .']{2,}\b/i.test(text)) missing.push("city");
  return missing;
}

export function isLikelyCityReply(text: string) {
  const value = text.trim().replace(/[.!?]+$/g, "");
  if (!/^[a-z][a-z .'-]{1,59}$/i.test(value)) return false;
  return !/^(today|tomorrow|tonight|morning|afternoon|evening|noon|midnight|yes|no|sure|okay|ok|alright)$/i.test(value) &&
    !/^(?:what|which|who|whose|where|when|why|how|can|could|would|will|do|does|did|is|are|am|should|have|has)\b/i.test(value);
}

export function customDetailsMissing(text: string) {
  const hasDuration = /\b\d+(?:\.\d+)?\s*(?:minute|minutes|min|mins)\b/i.test(text) ||
    /\b(five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s*(?:minute|minutes|min|mins)\b/i.test(text);
  const usefulWords = text.replace(/\b(custom|customs|video|content|i want|i would like|please|babe)\b/gi, " ")
    .trim().split(/\s+/).filter(Boolean);
  return { duration: !hasDuration, description: usefulWords.length < 5 };
}

export function isCustomDetailsFinished(text: string) {
  return /^(?:yes|yes,? that(?:'s| is) all|yes,? that(?:'s| is) everything|done|finished|all done|complete|i(?:'m| am) done|that(?:'s| is) all|that(?:'s| is) everything|that(?:'s| is) it|nothing else|no,? that(?:'s| is) everything|those are all the details)[.! ]*$/i.test(text.trim());
}

export function isMessageBurst(count: number, limit = 15) {
  return Number.isFinite(count) && count > limit;
}

export function isAffirmativeReply(text: string) {
  return /^(yes|yes i do|yes i want to|yes please|yes babe|yeah|yeah i do|yep|sure|okay|ok|alright|i guess|okay i guess|ok i guess|let's do it|lets do it|i do|i want to|i'd love to|id love to)[.! ]*$/i.test(text.trim());
}

export function isTrailerOfferAwaitingConfirmation(text: string) {
  const value = text.trim();
  if (!/\b(trailer|preview)\b/i.test(value) || /https?:\/\//i.test(value)) return false;
  return /\b(?:want|wanna|like|interested)\b[^?!.]{0,180}\b(?:trailer|preview)\b/i.test(value) ||
    /\b(?:trailer|preview)\b[^?!.]{0,180}\b(?:want|wanna|like|interested)\b/i.test(value);
}

export function isPresenceCheck(text: string) {
  const value = text.trim();
  if (/^\?{1,8}$/.test(value)) return true;
  return /\b(?:are you (?:still )?there|are we still talking|are you still talking to me|you still there|still there|did you leave|where did you go|can you hear me)\b/i.test(value) ||
    /^(?:hello|hey|hi)[?!. ]+$/i.test(value);
}

export function isGenericCancelReply(text: string) {
  return /\b(cancel|cancel that|cancel this|never mind|nevermind|not now|maybe later|no thanks|no thank you|forget it|not interested|changed my mind|don't want it|dont want it|do not want it|not anymore|stop this)\b/i.test(text) ||
    /^(?:no|nope|neither)(?:\s+(?:thanks|thank you|sorry))?[.! ]*$/i.test(text.trim());
}

export function isCancelReply(text: string) {
  return isGenericCancelReply(text) || isBookingDecline(text) || isCustomDecline(text) ||
    isPhysicalOrderDecline(text) || isRatingDecline(text) || isSextingDecline(text);
}

export function isBookingDecline(text: string) {
  return /\b(?:do not|don't|dont|no longer)\s+(?:want\s+(?:a\s+)?)?(?:video chat|video call|booking|meet and greet|in person meet)\b/i.test(text);
}

export function isCustomDecline(text: string) {
  return /\b(?:do not|don't|dont|no longer)\s+(?:want\s+(?:a\s+)?)?(?:custom|custom video|custom content)\b/i.test(text);
}

export function isPhysicalOrderDecline(text: string) {
  return /\b(?:do not|don't|dont|no longer)\s+(?:want\s+(?:the\s+)?)?(?:item|order|panty|panties|clothing|clothes)\b/i.test(text);
}

export function isRatingDecline(text: string) {
  return /\b(?:do not|don't|dont|no longer)\s+(?:want\s+(?:a\s+)?)?(?:rating|dick rating|video rating)\b/i.test(text);
}

export function isConversationQuestion(text: string) {
  return /\?/.test(text) || /^(?:what|which|who|whose|where|when|why|how|can|could|would|will|do|does|did|is|are|am|should|have|has)\b/i.test(text.trim());
}

export function isLikelyShippingName(text: string) {
  const value = text.trim().replace(/[,.!]+$/g, "");
  if (isConversationQuestion(value) || /\b(?:sext|video chat|video call|custom|buy|book|payment|pay)\b/i.test(value)) return false;
  return /^(?:[a-z][a-z'-]*\s*){1,5}$/i.test(value);
}

export function isLikelyShippingAddress(text: string) {
  const value = text.trim();
  return /\d/.test(value) && (/,/.test(value) ||
    /\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|highway|hwy|apartment|apt|suite|unit|zip)\b/i.test(value) ||
    /\b\d{5}(?:-\d{4})?\b/.test(value));
}

export function isLikelyBookingDetailReply(text: string, expectingCity = false) {
  if (/\b(video chat|video call|in person|meet and greet)\b/i.test(text)) return true;
  if (/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|noon|midnight)\b/i.test(text)) return true;
  if (/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/i.test(text)) return true;
  if (/^(?:you|with you|a meeting with you|meet with you)\??[.! ]*$/i.test(text.trim())) return true;
  return expectingCity && isLikelyCityReply(text);
}

export function isLikelyCustomDetailReply(text: string) {
  if (!isConversationQuestion(text)) {
    return !/^(?:hi|hey|hello|lol|lmao|thanks|thank you|okay|ok|cool|nice|what's up|whats up)[.! ]*$/i.test(text.trim());
  }
  return /\b(custom|customs|custom video|custom content|how much|price|cost|pay|payment|turnaround|when.*(?:done|ready))\b/i.test(text);
}

export function isSextingPackageFollowUp(text: string) {
  const value = text.trim();
  if (isSextingDecline(value)) return false;
  return isAffirmativeReply(value) ||
    /\b(sext|sexting|package|option|stars?|minutes?)\b/i.test(value) ||
    /^(?:5|five|10|ten)[.! ]*$/i.test(value) ||
    /^(?:how much|what does it cost|what are the prices?)[?!. ]*$/i.test(value);
}

export function isSextingDecline(text: string) {
  return /\b(?:i\s+)?(?:do not|don't|dont|no longer)\s+(?:(?:want|wanna)\s+(?:to\s+)?)?(?:sext|sexting)\b|\b(?:not interested in|no|not)\s+sexting\b|\b(?:stop|quit)\s+(?:asking\s+(?:me\s+)?about\s+)?sexting\b/i.test(text);
}

export function parseNameIntroduction(text: string) {
  const cleaned = text.trim().replace(/^(?:my name is|i am|i'm|im)\s+/i, "");
  const intent = /\s+(?=(?:and\s+)?(?:i\s+(?:want|wanna|would like|need)|i'd\s+like|can\s+i|could\s+i|do\s+you|what\b|how\b|let's\b|lets\b))/i.exec(cleaned);
  const boundary = intent?.index ?? cleaned.length;
  const rawName = cleaned.slice(0, boundary).replace(/[,!.?]+$/g, "").trim();
  const remainder = cleaned.slice(boundary).trim().replace(/^and\s+/i, "");
  const name = rawName.split(/\s+/).slice(0, 3)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part)
    .join(" ");
  return { name, remainder };
}
