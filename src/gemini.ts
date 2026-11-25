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

async function callModel(model: string, key: string, korean: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: korean }] }],
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
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .replace(/^["「『]|["」』]$/g, "")
    .split("\n")[0]
    .trim();
  if (!text) throw new Error("Gemini 빈 응답");
  return text;
}

/** Korean → Japanese with Gemini. Throws when no key or every model fails. */
export async function translateWithGemini(korean: string, key = getGeminiKey()): Promise<string> {
  if (!key) throw new Error("Gemini 키 없음");
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let last: unknown;
  for (const model of order) {
    try {
      const text = await callModel(model, key, korean);
      workingModel = model;
      return text;
    } catch (error) {
      last = error;
      // Bad key: no point trying other models.
      if ((error as { badKey?: boolean }).badKey) break;
    }
  }
  throw last instanceof Error ? last : new Error("Gemini 번역 실패");
}
