import { countKana, numberKana, numberValue } from "./counters";
import { digitsToHangul, kanaToHangul, spaceCueWords } from "./hangul";

export type JaToken = {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  reading?: string;
  pronunciation?: string;
};

const JOIN_PREV_POS = new Set(["助詞", "助動詞"]);

/** Words the dictionary reads in a sense that is not meant here. */
const READINGS: Record<string, string> = { 何時: "ナンジ", 額: "ヒタイ" };
/** "家族の方" is a person (かた), "痛い方" a side (ほう). */
const PERSON = /^(ご?家族|患者|保護者|付き添い|お?付添|介護|担当|ほか|他|この|その|あの)$/;

/**
 * Numbers are read with their counter (一人 → ヒトリ) and a few words by their neighbours.
 * Returns tokens whose pronunciation is what is said.
 */
function settle(tokens: JaToken[]): JaToken[] {
  const out: JaToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let text = "";
    let end = i;
    while (end < tokens.length && numberValue(tokens[end].surface_form) !== null && (tokens[end].pos_detail_1 === "数" || /^[\d０-９]+$/.test(tokens[end].surface_form))) {
      text += tokens[end].surface_form;
      end += 1;
    }
    const value = text ? numberValue(text) : null;
    const decimal = /^[.．]$/.test(tokens[end]?.surface_form ?? "") || /^[.．]$/.test(tokens[i - 1]?.surface_form ?? "");
    if (value !== null && !decimal) {
      const next = tokens[end];
      // 分間, か月, 日間 may come as two tokens.
      const pair = next && tokens[end + 1] ? countKana(value, next.surface_form + tokens[end + 1].surface_form) : null;
      const single = next ? countKana(value, next.surface_form) : null;
      const size = pair ? 2 : single && !(next.surface_form === "人" && tokens[end + 1]?.surface_form === "前") ? 1 : 0;
      const kana = size === 2 ? pair : size === 1 ? single : numberKana(value);
      out.push({ surface_form: text + tokens.slice(end, end + size).map((item) => item.surface_form).join(""), pos: "名詞", pos_detail_1: "一般", pronunciation: kana ?? "" });
      i = end + size - 1;
      continue;
    }
    const before = out[out.length - 1]?.surface_form ?? "";
    const beforeThat = out[out.length - 2]?.surface_form ?? "";
    let pronunciation = READINGS[token.surface_form] ?? token.pronunciation;
    if (token.surface_form === "方" && (PERSON.test(before) || (before === "の" && PERSON.test(beforeThat)))) pronunciation = "カタ";
    if (/^空(き|い|く|か)/.test(token.surface_form) && before === "が" && /腹$/.test(beforeThat)) pronunciation = (token.pronunciation ?? "").replace(/^ア/, "ス");
    out.push({ ...token, pronunciation });
  }
  return out;
}

function pronunciationOf(token: JaToken): string {
  const surface = token.surface_form;
  // A word the dictionary does not know is read as written.
  const spoken = token.pronunciation || token.reading || (/^[ぁ-ゖァ-ヶー]+$/.test(surface) ? surface : "");
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
  /** A comma was just passed: the next word starts on its own. */
  let paused = false;
  for (const token of settle(tokens)) {
    const kana = pronunciationOf(token);
    if (token.pos === "記号") {
      paused = /[、，,]/.test(token.surface_form);
      continue;
    }
    if (paused && kana) {
      paused = false;
      chunks.push(kana);
      joinNext = token.pos === "接頭詞";
      continue;
    }
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
