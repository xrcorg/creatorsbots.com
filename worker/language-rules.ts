const NON_LATIN_SCRIPT = /[\u0400-\u052f\u0600-\u06ff\u0750-\u077f\u0900-\u0d7f\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

const NON_ENGLISH_CHAT_WORDS = /(?:^|[^\p{L}])(?:sí|si|oui|ja|nein|sim|evet|hayır|hola|gracias|quiero|puedo|como|donde|bonjour|merci|salut|veux|peux|comment|hallo|danke|bitte|möchte|willst|buongiorno|ciao|grazie|voglio|posso|olá|ola|obrigad[oa]|quero|posso|oi|merhaba|teşekkür|istiyorum|selam|kumusta|salamat|gusto|ako|apni|mera|meri|naam|bhejo|mujhe|chahiye|kya|haan|nahi|acha|accha|main|mein|aap|tum|mujko|dikhao|kitna|kaise|kahan|bhai|yaar)(?:$|[^\p{L}])/iu;

const ENGLISH_SWITCH_WORDS = /\b(?:hello|hey|please|thanks|want|show|send|buy|video|photo|custom|how|what|where|when|can|could|would|yes|no|are|you|doing)\b/giu;

export type DetectedLanguage = {
  code: string;
  name: string;
};

export function isEnglishLanguage(code: string | null | undefined) {
  return !code || /^en(?:-|$)/i.test(code);
}

export function parseDetectedLanguage(value: string | null | undefined): DetectedLanguage | null {
  const cleaned = String(value || "").trim().replace(/^```(?:text)?\s*|\s*```$/gi, "");
  const match = cleaned.match(/^([a-z]{2,3}(?:-[a-z]{2,8})?)\s*\|\s*([^\n|]{2,60})$/i);
  if (!match || /^unknown$/i.test(match[1])) return null;
  return { code: match[1], name: match[2].trim() };
}

export function shouldDetectLanguage(text: string, currentCode = "") {
  const cleaned = text.trim();
  if (!cleaned || !/[\p{L}]/u.test(cleaned)) return false;
  const words = cleaned.match(/[\p{L}']+/gu) || [];
  if (!currentCode) {
    return NON_LATIN_SCRIPT.test(cleaned) || NON_ENGLISH_CHAT_WORDS.test(cleaned) || words.length >= 3;
  }
  if (!isEnglishLanguage(currentCode)) {
    const englishSignals = cleaned.match(ENGLISH_SWITCH_WORDS)?.length || 0;
    return words.length >= 3 && englishSignals >= 2;
  }
  return NON_LATIN_SCRIPT.test(cleaned) || NON_ENGLISH_CHAT_WORDS.test(cleaned);
}
