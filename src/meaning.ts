/**
 * Notices when a translation lost something that can hurt a patient: a "don't", a side,
 * a number, or that it was a question. Works on the two texts themselves, without a server.
 * It only warns; it cannot prove a translation right.
 */
import type { PatientLang } from "./lang";
import { isCommand, isQuestion } from "./polite";

export type TextLang = PatientLang | "ko";
export type Problem = { kind: "negation" | "side" | "number" | "question"; text: string };

// No lookbehind here: older Safari cannot even load a file that contains one.

/** yes / no / null when the wording does not tell. `soft` satisfies a source negation but is not one by itself. */
function negation(text: string, lang: TextLang): { yes: boolean | null; soft: boolean } {
  if (lang === "ko") {
    const t = text.replace(/안녕|안전|안쪽|안정|안심|안마|안경|안내|안과|(^|\s)안(에|으로|에서|의)(?=\s|$)/g, " ");
    const yes =
      /지\s*(는|도|를|가)?\s*(마세|마셔|마시|마십|마요|마라|마$|마[\s.,!?]|말|않|못)|면\s*안\s*(돼|되|됩|된)/.test(t) ||
      /(^|\s)(안|못)\s+[가-힣]/.test(t) ||
      /(^|\s)(안아프|안아픈|안돼|안되|안됩|안들어|못하|못해|못합|못했)/.test(t) ||
      /없|아니(에요|예요|요|다|고|라|면)|아닙|금지|금물/.test(t);
    if (/문제\s*없|상관\s*없|괜찮/.test(t)) return { yes: null, soft: true };
    return { yes, soft: /건강한|성한/.test(t) };
  }
  if (lang === "ja") {
    if (/問題(は)?(ない|ありません)|構いません|かまいません|大丈夫/.test(text)) return { yes: null, soft: true };
    const t = text.replace(/すみません|かもしれません|かもしれない|(なければ|なくては|なきゃ|ないと)(なりません|ならない|いけません|いけない|だめ)?|少ない|危ない|きたない|もったいない|だけでなく|まもなく|間もなく|しょうがない/g, "");
    return { yes: /ない|なかっ|なく|ません|ずに|ないで|なし|無し|不要|禁止|だめ|ダメ|無理|いいえ|違い/.test(t), soft: /健康な|健側|良い方|いい方/.test(t) };
  }
  if (lang === "en") {
    const t = text.toLowerCase().replace(/’/g, "'");
    if (/no problem|not a problem|\bokay\b|all right/.test(t)) return { yes: null, soft: true };
    return { yes: /\b(not|no|never|cannot|none|nothing|avoid)\b|n't\b/.test(t), soft: /\b(without|unable|unaffected)\b|pain-free/.test(t) };
  }
  const words = text.split(/[\s،.؟!]+/).map((word) => word.replace(/^[وف](?=لا$|لم$|لن$|ليس|عدم|دون|بدون|غير)/, ""));
  if (/لا بأس|لا مشكلة|بخير/.test(text)) return { yes: null, soft: true };
  const has = (list: string[]) => words.some((word) => list.includes(word));
  return { yes: has(["لا", "لم", "لن", "ليس", "ليست", "لست", "عدم", "ممنوع", "تجنب", "لتجنب"]), soft: has(["دون", "بدون", "غير", "السليمة", "السليم", "بلا"]) };
}

/** Sides in the order they are said. */
function sides(text: string, lang: TextLang): ("L" | "R")[] {
  const t = lang === "en" ? text.toLowerCase().replace(/all right|that's right|right (now|away|here|there)/g, " ") : text;
  const re: Record<TextLang, RegExp> = {
    ko: /(왼|좌측)|(오른(?=쪽|팔|다리|발|손|무릎|어깨|편|엉덩이|\s)|우측)/g,
    ja: /(左)|(右)/g,
    en: /(\bleft\b)|(\bright\b)/g,
    ar: /(يسار|[أا]يسر|يسرى)|(يمين|[أا]يمن|يمنى)/g,
  };
  return [...t.matchAll(re[lang])].map((match) => (match[1] ? "L" : "R"));
}

const NATIVE: Record<string, number> = { 하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const SINO: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const KANJI: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** "삼십이" or "三十二" → 32. */
function positional(text: string, digits: Record<string, number>, ten: string, hundred: string): number {
  let total = 0;
  let unit = 0;
  for (const ch of text) {
    if (ch === hundred) {
      total += (unit || 1) * 100;
      unit = 0;
    } else if (ch === ten) {
      total += (unit || 1) * 10;
      unit = 0;
    } else unit = digits[ch] ?? 0;
  }
  return total + unit;
}

const COUNTER = "번|회|초|걸음|시간|시|분|까지|세트|가지|달|주";
const KO_NATIVE = new RegExp(`(^|[^가-힣])(스물|열)?\\s?(다섯|여섯|일곱|여덟|아홉|하나|한|둘|두|셋|세|넷|네)?\\s?(${COUNTER})`, "g");
const KO_SINO = /(^|[^가-힣])([일이삼사오육칠팔구십백]*[십백][일이삼사오육칠팔구]?)\s?(분|초|회|주|개월|킬로|미터|점|도|층|번)/g;

/** Counts said in Korean, 2 and up ("한 번" is usually "try it"). */
export function koreanNumbers(text: string): number[] {
  const found = (text.match(/\d+/g) ?? []).map(Number);
  for (const [, , ten, unit] of text.matchAll(KO_NATIVE)) found.push((ten === "스물" ? 20 : ten ? 10 : 0) + (unit ? NATIVE[unit] : 0));
  for (const [, , number] of text.matchAll(KO_SINO)) found.push(positional(number, SINO, "십", "백"));
  return [...new Set(found.filter((n) => n >= 2))];
}

const EN_NUMBERS: Record<number, RegExp> = {
  2: /two|twice|second|both|couple/, 3: /three|third/, 4: /four/, 5: /five|fifth/, 6: /six/, 7: /seven/, 8: /eight/, 9: /nine|ninth/,
  10: /\bten/, 11: /eleven/, 12: /twelve|twelfth/, 15: /fifteen|quarter/, 20: /twenty/, 30: /thirty|half/, 60: /sixty|minute|hour/,
};
const AR_NUMBERS: Record<number, RegExp> = {
  2: /اثن|إثن|مرتين|ثاني|تين|ين/, 3: /ثلاث|ثالث/, 4: /[أا]ربع|رابع/, 5: /خمس|خامس/, 6: /ست|سادس/, 7: /سبع|سابع/, 8: /ثمان|ثامن/, 9: /تسع|تاسع/, 10: /عشر/, 20: /عشر/, 30: /ثلاث|نصف/,
};
const JA_WORDS: Record<number, RegExp> = { 2: /ふたつ|二人|両|半分/, 3: /みっつ/, 4: /よっつ/, 5: /いつつ/, 10: /とお/, 30: /半/ };

function hasNumber(text: string, n: number, lang: PatientLang): boolean {
  const t = text.replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10)).replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x660));
  if ((t.match(/\d+/g) ?? []).map(Number).includes(n)) return true;
  if (lang === "ja") {
    return (t.match(/[一二三四五六七八九十百]+/g) ?? []).some((word) => positional(word, KANJI, "十", "百") === n) || (JA_WORDS[n]?.test(t) ?? false);
  }
  const words = lang === "en" ? EN_NUMBERS[n] : AR_NUMBERS[n];
  // A number we cannot spell here is not judged.
  return words ? words.test(t.toLowerCase()) : !/\d/.test(t);
}

function asks(text: string, lang: TextLang): boolean {
  const t = text.trim();
  if (/[?？؟]$/.test(t)) return true;
  if (lang === "ko") return isQuestion(t);
  if (lang === "ja") return /(か|かな|かしら)$/.test(t.replace(/[。．.\s]+$/, ""));
  return lang === "ar" && /^هل\s/.test(t);
}

/** A polite request that merely looks like a question. */
function requestLike(text: string, lang: TextLang): boolean {
  if (lang === "ja") return /(ましょうか|ませんか|もらえますか|いただけますか|くれますか|いいですか)[？?]?$/.test(text.trim());
  return lang === "en" && /^(please,? )?(can|could|would|will|shall|may|shall)\b.*\?\s*$/i.test(text.trim());
}

const SIDE_NAME = { L: "왼쪽", R: "오른쪽" } as const;

function sideProblem(source: ("L" | "R")[], target: ("L" | "R")[], ordered: boolean): string {
  for (const side of ["L", "R"] as const) {
    if (source.includes(side) && !target.includes(side)) return `‘${SIDE_NAME[side]}’이 번역에서 빠졌을 수 있어요`;
    if (!source.includes(side) && target.includes(side)) return `번역에 ‘${SIDE_NAME[side]}’이 새로 들어갔을 수 있어요`;
  }
  if (ordered && source.length === target.length && source.join() !== target.join()) return "왼쪽과 오른쪽이 바뀌었을 수 있어요";
  return "";
}

function negationProblem(source: { yes: boolean | null; soft: boolean }, target: { yes: boolean | null; soft: boolean }): string {
  if (source.yes === null || target.yes === null) return "";
  if (source.yes && !target.yes && !target.soft) return "‘안·하지 마세요’ 뜻이 번역에서 빠졌을 수 있어요";
  if (!source.yes && target.yes && !source.soft) return "번역에 ‘안·하지 않다’ 뜻이 새로 들어갔을 수 있어요";
  return "";
}

/** Therapist's Korean against its translation. */
export function checkTranslation(ko: string, text: string, lang: PatientLang): Problem[] {
  const problems: Problem[] = [];
  const add = (kind: Problem["kind"], message: string) => {
    if (message) problems.push({ kind, text: message });
  };
  const question = asks(ko, "ko") && !/^안녕/.test(ko.trim());
  // "불편하지 않으세요?" may be asked with or without the "not".
  if (!question) add("negation", negationProblem(negation(ko, "ko"), requestLike(text, lang) ? { yes: null, soft: true } : negation(text, lang)));
  add("side", sideProblem(sides(ko, "ko"), sides(text, lang), lang === "ja"));
  const lost = koreanNumbers(ko).filter((n) => !hasNumber(text, n, lang));
  if (lost.length) add("number", `숫자 ${lost.join(", ")}이(가) 번역과 다를 수 있어요`);
  if (question && !asks(text, lang)) add("question", "묻는 말이 번역에서 바뀌었을 수 있어요");
  if (isCommand(ko) && asks(text, lang) && !requestLike(text, lang)) add("question", "부탁이 묻는 말로 바뀌었을 수 있어요");
  return problems;
}

/** Patient's words against their Korean translation. */
export function checkPatient(text: string, lang: PatientLang, ko: string): Problem[] {
  const problems: Problem[] = [];
  if (!asks(text, lang) && !asks(ko, "ko")) {
    const message = negationProblem(negation(text, lang), negation(ko, "ko"));
    if (message) problems.push({ kind: "negation", text: message });
  }
  const side = sideProblem(sides(text, lang), sides(ko, "ko"), lang === "ja");
  if (side) problems.push({ kind: "side", text: side });
  return problems;
}

/** These can hurt: never read aloud by itself. */
export function mustHold(problems: Problem[]): boolean {
  return problems.some((problem) => problem.kind === "negation" || problem.kind === "side");
}
