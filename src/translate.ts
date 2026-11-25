import type { PatientLang } from "./lang";
import { cleanJa } from "./polite";

const TIMEOUT_MS = 5000;
/** Whole time for one sentence, retries included. */
const BUDGET_MS = 10000;

async function getJson(url: string, deadline = Date.now() + TIMEOUT_MS): Promise<unknown> {
  const left = deadline - Date.now();
  if (left < 300) throw new Error("연결 시간 초과");
  const response = await fetch(url, {
    headers: { Accept: "application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, left)),
  });
  if (!response.ok) throw new Error(`번역 서버 오류 (${response.status})`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("번역 응답을 읽지 못했습니다");
  }
}

function parseClients5(data: unknown): string {
  if (typeof data === "string") return data;
  if (!Array.isArray(data)) throw new Error("번역 형식이 예상과 다릅니다");
  if (typeof data[0] === "string") return data.filter((item) => typeof item === "string").join("");
  if (Array.isArray(data[0])) {
    return data
      .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
      .join("");
  }
  throw new Error("번역 형식이 예상과 다릅니다");
}

function parseGtx(data: unknown): string {
  if (data && typeof data === "object" && "sentences" in data) {
    const sentences = (data as { sentences?: { trans?: string }[] }).sentences ?? [];
    const text = sentences.map((sentence) => sentence.trans ?? "").join("");
    if (text) return text;
  }
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const text = (data[0] as unknown[])
      .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
      .join("");
    if (text) return text;
  }
  throw new Error("번역 형식이 예상과 다릅니다");
}

function findRomaji(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const row = data[0] as unknown[];
  if (Array.isArray(row[1]) && typeof row[1][3] === "string") return row[1][3];
  return null;
}

async function translateClients5(q: string, tl: PatientLang, deadline: number): Promise<string> {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ko&tl=${tl}&q=${q}`;
  return parseClients5(await getJson(url, deadline));
}

async function translateGtx(q: string, tl: PatientLang, deadline: number): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${tl}&dt=t&dt=rm&dj=1&q=${q}`;
  try {
    return parseGtx(await getJson(url, deadline));
  } catch {
    const raw = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${tl}&dt=t&dt=rm&q=${q}`;
    return parseGtx(await getJson(raw, deadline));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Words Google picks that are wrong in a rehabilitation room. */
function rehabJa(ja: string, korean: string): string {
  let out = ja.replace(/緊張を(癒し|緩め|ほぐし|解い)て/g, "力を抜いて").replace(/病気の(足|脚|腕|手|方)/g, "痛い$1");
  if (/발판/.test(korean)) out = out.replace(/足場/g, "フットレスト");
  return out;
}

/** Keyless Korean → patient language. clients5 first, then the public gtx endpoint. */
export async function translateFromKo(korean: string, lang: PatientLang): Promise<string> {
  const q = encodeURIComponent(korean);
  const attempts = [translateClients5, translateGtx, translateClients5, translateGtx];
  const deadline = Date.now() + BUDGET_MS;
  let last: unknown;
  for (let i = 0; i < attempts.length && Date.now() < deadline - 300; i++) {
    try {
      const raw = await attempts[i](q, lang, deadline);
      const out = lang === "ja" ? rehabJa(cleanJa(raw), korean) : raw.replace(/\s+/g, " ").trim();
      if (out && out !== korean.trim()) return out;
      last = new Error("빈 번역");
    } catch (error) {
      last = error;
    }
    await sleep(350 * (i + 1));
  }
  const message = last instanceof Error ? last.message : "번역에 실패했습니다";
  throw new Error(message);
}

/** Keyless patient language → Korean via the public Google endpoints. No politify. */
export async function translateToKo(spoken: string, lang: PatientLang): Promise<string> {
  const q = encodeURIComponent(spoken);
  const deadline = Date.now() + BUDGET_MS;
  const attempts = [
    async () => parseGtx(await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ko&dt=t&dj=1&q=${q}`, deadline)),
    async () => parseClients5(await getJson(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${lang}&tl=ko&q=${q}`, deadline)),
    async () => parseGtx(await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ko&dt=t&q=${q}`, deadline)),
  ];
  let last: unknown;
  for (let i = 0; i < attempts.length && Date.now() < deadline - 300; i++) {
    try {
      let ko = (await attempts[i]()).replace(/\s+/g, " ").trim();
      // Google takes 息を吸う (breathe in) for smoking.
      if (lang === "ja" && /息を(大きく|深く|ゆっくり)?吸/.test(spoken)) ko = ko.replace(/피우/g, "들이마시").replace(/피워/g, "들이마셔");
      if (ko && ko !== spoken.trim()) return ko;
      last = new Error("빈 번역");
    } catch (error) {
      last = error;
    }
    await sleep(350 * (i + 1));
  }
  throw last instanceof Error ? last : new Error("번역에 실패했습니다");
}

export async function fetchJaRomaji(japanese: string): Promise<string> {
  const q = encodeURIComponent(japanese);
  const urls = [
    `https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=ja&tl=en&dt=rm&dt=t&q=${q}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=rm&dt=t&q=${q}`,
  ];
  let last: unknown;
  for (const url of urls) {
    try {
      const romaji = findRomaji(await getJson(url));
      if (romaji) return romaji;
      last = new Error("발음 표기를 찾지 못했습니다");
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("발음 표기를 찾지 못했습니다");
}

/** Latin transliteration of Arabic (last row of the response). Throws when Google has none. */
export async function fetchArabicLatin(arabic: string): Promise<string> {
  const q = encodeURIComponent(arabic);
  const data = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=rm&dt=t&q=${q}`);
  const rows = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
  const last = rows[rows.length - 1];
  if (Array.isArray(last) && typeof last[3] === "string") return last[3];
  throw new Error("발음 표기를 찾지 못했습니다");
}
