import { cleanJa } from "./polite";

const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

async function translateClients5(q: string): Promise<string> {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ko&tl=ja&q=${q}`;
  return parseClients5(await getJson(url));
}

async function translateGtx(q: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=ja&dt=t&dt=rm&dj=1&q=${q}`;
  try {
    return parseGtx(await getJson(url));
  } catch {
    const raw = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=ja&dt=t&dt=rm&q=${q}`;
    return parseGtx(await getJson(raw));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keyless Korean → Japanese. clients5 first, then the public gtx endpoint. */
export async function translateKoToJa(korean: string): Promise<string> {
  const q = encodeURIComponent(korean);
  const attempts = [translateClients5, translateClients5, translateGtx, translateGtx];
  let last: unknown;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const ja = cleanJa(await attempts[i](q));
      if (ja && ja !== korean.trim()) return ja;
      last = new Error("빈 번역");
    } catch (error) {
      last = error;
    }
    await sleep(350 * (i + 1));
  }
  const message = last instanceof Error ? last.message : "번역에 실패했습니다";
  throw new Error(message);
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
