import type { PatientLang } from "./lang";

const KEY_STORAGE = "chiryo.geminiKey";
const MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 9000;

const INSTRUCTION = [
  "You are an interpreter for a Korean physical therapist treating a Japanese patient in a hospital rehabilitation room.",
  "Translate the therapist's spoken Korean into natural, polite Japanese the patient will read on a screen (です/ます, requests as 〜てください).",
  "The Korean comes from speech recognition and may contain recognition errors, repeated words or missing particles; infer the intended meaning from the rehabilitation context.",
  "Use plain, easy everyday Japanese suitable for elderly patients; avoid rare kanji where a simple word exists.",
  "Output ONLY the Japanese translation, one line, no quotes, no romaji, no explanations.",
].join(" ");

const INSTRUCTION_JA_KO = [
  "You are a medical and rehabilitation interpreter for a Korean physical therapist treating a Japanese patient in a hospital rehabilitation room.",
  "Translate what the Japanese patient said into natural, everyday Korean the therapist will read on a screen.",
  "The Japanese comes from speech recognition and may contain recognition errors, repeated words or missing particles; infer the intended meaning from the rehabilitation context (pain, fatigue, dizziness, body parts, movement).",
  "Keep the patient's meaning and tone; do not add advice or explanations.",
  "Output ONLY the Korean translation, one line, no quotes, no Japanese, no romanization.",
].join(" ");

const RULES: Record<"en" | "ar", string> = {
  en: "natural, polite, plain spoken English (requests start with Please)",
  ar: "polite, simple Modern Standard Arabic that does not assume the patient's gender (for requests use الرجاء plus a verbal noun instead of imperatives, and avoid second-person endings such as ـك)",
};

function instructionTo(lang: "en" | "ar"): string {
  const english = lang === "en" ? "English" : "Arabic";
  return [
    `You are an interpreter for a Korean physical therapist treating a patient who speaks ${english} in a hospital rehabilitation room.`,
    `Translate the therapist's spoken Korean into ${RULES[lang]}. The patient reads it on a screen.`,
    "The Korean comes from speech recognition and may contain recognition errors, repeated words or missing particles; infer the intended meaning from the rehabilitation context.",
    "Never drop or reverse a negation, a side (left/right) or a number.",
    "Use short everyday words suitable for elderly patients.",
    `Output EXACTLY two lines and nothing else. Line 1: the ${english} translation only. Line 2: how to read line 1 aloud, written only in Korean hangul.`,
  ].join(" ");
}

function instructionFrom(lang: "en" | "ar"): string {
  const english = lang === "en" ? "English" : "Arabic";
  return [
    `You are a medical and rehabilitation interpreter for a Korean physical therapist treating a patient who speaks ${english} in a hospital rehabilitation room.`,
    `Translate what the patient said in ${english} into natural, everyday Korean the therapist will read on a screen.`,
    "The text comes from speech recognition and may contain recognition errors or missing words; infer the intended meaning from the rehabilitation context (pain, fatigue, dizziness, body parts, movement).",
    "Keep the patient's meaning and tone; do not add advice or explanations.",
    "Output ONLY the Korean translation, one line, no quotes, no romanization.",
  ].join(" ");
}

export function getGeminiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setGeminiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage blocked */
  }
}

let workingModel = "";

async function callModel(model: string, key: string, text: string, instruction: string, lines = 1): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: lines > 1 ? 512 : 256 },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const badKey = /API key|API_KEY|PERMISSION_DENIED|unregistered callers/i.test(body);
    const err = new Error(badKey ? "Gemini 키가 올바르지 않습니다" : `Gemini 오류 (${response.status})`) as Error & {
      status?: number;
      badKey?: boolean;
    };
    err.status = response.status;
    err.badKey = badKey;
    throw err;
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const out = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .replace(/^["「『]|["」』]$/g, "")
    .split("\n")
    .slice(0, lines)
    .join("\n")
    .trim();
  if (!out) throw new Error("Gemini 빈 응답");
  return out;
}

async function runGemini(text: string, instruction: string, key: string, lines = 1): Promise<string> {
  if (!key) throw new Error("Gemini 키 없음");
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let last: unknown;
  for (const model of order) {
    try {
      const out = await callModel(model, key, text, instruction, lines);
      workingModel = model;
      return out;
    } catch (error) {
      last = error;
      // Bad key: no point trying other models.
      if ((error as { badKey?: boolean }).badKey) break;
    }
  }
  throw last instanceof Error ? last : new Error("Gemini 번역 실패");
}

/** Korean → Japanese with Gemini. Throws when no key or every model fails. */
export function translateWithGemini(korean: string, key = getGeminiKey()): Promise<string> {
  return runGemini(korean, INSTRUCTION, key);
}

/** Japanese (patient) → Korean with Gemini. Throws when no key or every model fails. */
export function translateJaToKoWithGemini(japanese: string, key = getGeminiKey()): Promise<string> {
  return runGemini(japanese, INSTRUCTION_JA_KO, key);
}

/** Korean → English/Arabic with Gemini, plus a hangul reading ("" when the model left it out). */
export async function translateToWithGemini(
  korean: string,
  lang: "en" | "ar",
  key = getGeminiKey(),
): Promise<{ text: string; reading: string }> {
  // Ask for a few spare lines: some models put a blank line between the two.
  const out = await runGemini(korean, instructionTo(lang), key, 4);
  const lines = out.split("\n").map((line) => line.trim()).filter(Boolean);
  const reading = lines[1] ?? "";
  return { text: lines[0], reading: /[가-힣]/.test(reading) && !/[A-Za-z\u0600-\u06ff]/.test(reading) ? reading : "" };
}

/** Patient's language → Korean with Gemini. */
export function translateToKoWithGemini(text: string, lang: PatientLang, key = getGeminiKey()): Promise<string> {
  if (lang === "ja") return translateJaToKoWithGemini(text, key);
  return runGemini(text, instructionFrom(lang), key);
}
