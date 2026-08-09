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

export function customDetailsMissing(text: string) {
  const hasDuration = /\b\d+(?:\.\d+)?\s*(?:minute|minutes|min|mins)\b/i.test(text) ||
    /\b(five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s*(?:minute|minutes|min|mins)\b/i.test(text);
  const usefulWords = text.replace(/\b(custom|customs|video|content|i want|i would like|please|babe)\b/gi, " ")
    .trim().split(/\s+/).filter(Boolean);
  return { duration: !hasDuration, description: usefulWords.length < 5 };
}

export function isAffirmativeReply(text: string) {
  return /^(yes|yes i do|yes i want to|yes please|yes babe|yeah|yeah i do|yep|sure|okay|ok|alright|i guess|okay i guess|ok i guess|let's do it|lets do it|i do|i want to|i'd love to|id love to)[.! ]*$/i.test(text.trim());
}

export function isCancelReply(text: string) {
  return /\b(cancel|never mind|nevermind|not now|maybe later|no thanks|no thank you|forget it)\b/i.test(text);
}
