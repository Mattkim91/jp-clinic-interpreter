/** One spoken turn Gemini heard in auto mode. */
export type Turn = {
  speaker: "ko" | "patient";
  heard: string;
  translation: string;
  /** Hangul reading of a patient-language translation ("" when missing). */
  reading: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Read Gemini's JSON answer; anything that is not a usable turn is dropped. */
export function parseTurns(json: string): Turn[] {
  const body = json.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
  const data = JSON.parse(body) as { turns?: unknown };
  const list = Array.isArray(data) ? data : Array.isArray(data?.turns) ? data.turns : [];
  const turns: Turn[] = [];
  for (const item of list as Record<string, unknown>[]) {
    const speaker = item?.language === "korean" ? "ko" : item?.language === "patient" ? "patient" : null;
    const heard = clean(item?.heard);
    const translation = clean(item?.translation);
    if (!speaker || !heard || !translation) continue;
    // A Korean turn must contain Korean, and a patient turn must be translated into Korean.
    if (!/[가-힣]/.test(speaker === "ko" ? heard : translation)) continue;
    const reading = clean(item?.reading);
    turns.push({ speaker, heard, translation, reading: /[가-힣]/.test(reading) && !/[A-Za-z؀-ۿ]/.test(reading) ? reading : "" });
  }
  return turns;
}

function letters(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Did the microphone just hear the phone's own voice? Short answers ("はい", "yes") are never treated as echo. */
export function isEcho(heard: string, spoken: string[]): boolean {
  const h = letters(heard);
  if (h.length < 6) return false;
  return spoken.some((text) => {
    const s = letters(text);
    return s === h || (s.includes(h) && h.length >= s.length * 0.6);
  });
}
