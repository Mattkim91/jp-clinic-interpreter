import { digitsToHangul, kanaToHangul, spaceCueWords } from "./hangul";

export type JaToken = {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  reading?: string;
  pronunciation?: string;
};

const JOIN_PREV_POS = new Set(["助詞", "助動詞"]);

function pronunciationOf(token: JaToken): string {
  const surface = token.surface_form;
  const spoken = token.pronunciation || token.reading || "";
  if (token.pos === "助詞" && (surface === "を" || spoken === "ヲ")) return "オ";
  if (token.pos === "助詞" && surface === "へ" && (spoken === "ヘ" || spoken === "へ")) return "エ";
  if (token.pos === "助詞" && surface === "は" && (spoken === "ハ" || spoken === "")) return "ワ";
  if (spoken && !/^\d+$/.test(spoken)) return spoken;
  if (/^\d+$/.test(surface)) return surface;
  return spoken;
}

function startsChunk(token: JaToken, hasChunk: boolean): boolean {
  if (!hasChunk) return true;
  if (token.pos === "接頭詞") return true;
  if (JOIN_PREV_POS.has(token.pos)) return false;
  if (token.pos_detail_1 === "接尾" || token.pos_detail_1 === "非自立") {
    if (token.surface_form === "ください" || token.surface_form === "下さい") return true;
    if (token.pos_detail_1 === "接尾") return false;
    if (token.pos === "動詞" && token.pos_detail_1 === "非自立") return true;
  }
  return true;
}

/**
 * Group analyzer tokens into words a therapist can breathe between,
 * then read each word. を/は/へ use their spoken sounds. て sticks to the verb
 * so 上げて is one beat, and ください stays its own beat.
 */
export function hangulFromTokens(tokens: JaToken[]): string {
  const chunks: string[] = [];
  let joinNext = false;
  for (const token of tokens) {
    const kana = pronunciationOf(token);
    if (token.pos === "記号") continue;
    if (joinNext && chunks.length) {
      chunks[chunks.length - 1] += kana;
      joinNext = token.pos === "接頭詞";
      continue;
    }
    if (!kana && !/^\d+$/.test(token.surface_form)) continue;
    if (token.pos === "接頭詞") {
      chunks.push(kana);
      joinNext = true;
      continue;
    }
    if (!startsChunk(token, chunks.length > 0)) {
      chunks[chunks.length - 1] += kana;
      continue;
    }
    chunks.push(kana || token.surface_form);
  }
  const hangul = chunks
    .map((chunk) => (/^\d+$/.test(chunk) ? digitsToHangul(chunk) : kanaToHangul(chunk)))
    .filter(Boolean)
    .join(" ");
  return spaceCueWords(hangul);
}
