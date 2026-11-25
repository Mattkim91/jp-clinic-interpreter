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

async function callModel(model: string, key: string, text: string, instruction: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
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
    .split("\n")[0]
    .trim();
  if (!out) throw new Error("Gemini 빈 응답");
  return out;
}

async function runGemini(text: string, instruction: string, key: string): Promise<string> {
  if (!key) throw new Error("Gemini 키 없음");
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let last: unknown;
  for (const model of order) {
    try {
      const out = await callModel(model, key, text, instruction);
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
